#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

/**
 * MIGRATIONS AU DEPLOIEMENT.
 *
 * Ecrit en JavaScript simple, sans TypeScript ni etape de construction : ce
 * script doit demarrer sur n'importe quelle version de Node, avant que
 * l'application ne soit compilee. Un outil de migration qui ne demarre pas
 * laisse la base a moitie faite.
 *
 * Chaque fichier est applique UNE FOIS, dans une transaction : soit il passe
 * en entier, soit il ne laisse aucune trace. Une migration a moitie appliquee
 * est le pire etat possible — elle ne se rejoue pas et ne se repare pas.
 *
 * Se connecte avec DATABASE_URL, le compte PROPRIETAIRE. Le role applicatif,
 * lui, ne peut rien modifier du schema — c'est tout l'interet.
 */

const dossier = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "db", "migrations");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL est absente : impossible de migrer.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nom text PRIMARY KEY,
      applique_le timestamptz NOT NULL DEFAULT now()
    )
  `;

  const deja = new Set((await sql`SELECT nom FROM schema_migrations`).map((r) => r.nom));

  const fichiers = readdirSync(dossier)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let appliquees = 0;
  for (const fichier of fichiers) {
    if (deja.has(fichier)) {
      console.log(`  = ${fichier} (deja appliquee)`);
      continue;
    }

    const contenu = readFileSync(join(dossier, fichier), "utf8");

    await sql.begin(async (tx) => {
      // Drizzle separe ses instructions par ce marqueur ; les migrations
      // ecrites a la main n'en ont pas et passent alors en un seul bloc.
      for (const instruction of contenu.split("--> statement-breakpoint")) {
        const propre = instruction.trim();
        if (propre) await tx.unsafe(propre);
      }
      await tx`INSERT INTO schema_migrations (nom) VALUES (${fichier})`;
    });

    console.log(`  + ${fichier}`);
    appliquees++;
  }

  /**
   * MOT DE PASSE DU ROLE APPLICATIF.
   *
   * Il n'est jamais dans le depot. Sans lui, l'application se rabattrait sur
   * DATABASE_URL — le compte proprietaire — qui CONTOURNE LE RLS en silence.
   * Le garde-fou de src/db/scope-tx.ts refuse alors de servir en production,
   * mais mieux vaut echouer ici, pendant le deploiement.
   */
  const motDePasse = process.env.APP_DB_PASSWORD;
  if (motDePasse) {
    await sql.unsafe(
      "ALTER ROLE caddieperf_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS " +
        `PASSWORD '${motDePasse.replace(/'/g, "''")}'`,
    );
    await sql`GRANT USAGE ON SCHEMA public TO caddieperf_app`;
    await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO caddieperf_app`;
    await sql`REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_log FROM caddieperf_app`;
    console.log("  * role applicatif pret");
  } else if (process.env.NODE_ENV === "production") {
    console.error(
      "\nAPP_DB_PASSWORD est absente. L'application se connecterait en superutilisateur,\n" +
        "qui contourne le RLS SANS AUCUN MESSAGE. Deploiement interrompu.",
    );
    process.exit(1);
  }

  console.log(`\n${appliquees} migration(s) appliquee(s), ${fichiers.length} au total.`);

  /**
   * DERNIERE VERIFICATION, ET LA PLUS IMPORTANTE : la connexion applicative
   * est-elle REELLEMENT soumise au RLS ?
   *
   * Un superutilisateur contourne le RLS EN SILENCE. Les quatorze politiques
   * de cloisonnement par terrain seraient alors decoratives, et rien ne le
   * dirait : les pages s'afficheraient, les tests distants passeraient, et le
   * defaut ne se verrait que le jour ou un terrain lirait les donnees d'un
   * autre.
   *
   * On l'eprouve ici, dans le deploiement, ou le reseau prive de la base est
   * joignable — et non depuis un poste de developpement, qui ne l'atteint pas.
   */
  const urlApp = process.env.APP_DATABASE_URL;
  if (urlApp) {
    const app = postgres(urlApp, { max: 1, onnotice: () => {} });
    try {
      const [role] = await app`
        SELECT current_user AS nom, rolsuper, rolbypassrls
        FROM pg_roles WHERE rolname = current_user
      `;
      const contourne = role?.rolsuper || role?.rolbypassrls;
      console.log(
        `  * connexion applicative : ${role?.nom}` +
          (contourne ? " — CONTOURNE LE RLS" : " (soumise au RLS)"),
      );
      if (contourne) {
        console.error(
          "\nLa connexion applicative contourne le RLS. Le cloisonnement entre\n" +
            "terrains ne s'appliquerait pas. Deploiement interrompu.",
        );
        process.exit(1);
      }
    } finally {
      await app.end();
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error("\nAPP_DATABASE_URL est absente en production. Deploiement interrompu.");
    process.exit(1);
  }
} finally {
  await sql.end();
}
