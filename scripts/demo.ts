import postgres from "postgres";
import { uuidv7 } from "../src/lib/uuid.ts";

/**
 * JEU DE DEMONSTRATION — DONNEES FICTIVES UNIQUEMENT.
 *
 * Le QR appartient au TERRAIN, et la migration lui en donne un d'office. Il
 * ne manque donc qu'une chose pour que le parcours client soit montrable :
 * des caddies dans la liste. Sans eux, l'adresse repond « aucun caddie ».
 *
 * NE CREE RIEN DEUX FOIS : il s'arrete si ses caddies de demonstration
 * existent deja, et se contente alors de redonner l'adresse.
 *
 * PRINCIPE II — tout ici est fictif et assume comme tel : la reference du
 * caddie porte « DEMO », son nom est « Fictif ». Rien de ce fichier ne doit
 * servir a un terrain reel.
 *
 * Ecrit en SQL brut, comme amorcer.ts : les services applicatifs importent
 * par l'alias @/, que --experimental-strip-types ne resout pas.
 */

if (process.env.DEMO !== "1") {
  console.log("  * demonstration : non demandee (DEMO absente)");
  process.exit(0);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL est absente : impossible de creer la demonstration.");
  process.exit(1);
}

const base = process.env.PUBLIC_BASE_URL;
const DEMO_REFS = ["07", "12", "23"] as const;

const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  const [terrain] = await sql<{ id: string; name: string; timezone: string; qr_token: string }[]>`
    SELECT id, name, timezone, qr_token FROM golf_course ORDER BY created_at LIMIT 1
  `;
  if (!terrain) {
    console.error("Aucun terrain : lancez d'abord l'amorcage.");
    process.exit(1);
  }


  /**
   * Menage des caddies de l'ANCIEN jeu de demonstration, du temps ou le QR
   * appartenait a la voiturette. Ils portaient une reference « DEMO-… » et
   * font desormais doublon dans la liste que le client voit. On les archive
   * plutot que de les supprimer : leurs evaluations doivent survivre.
   */
  const archives = await sql`
    UPDATE caddie SET status = 'disabled', availability = 'unavailable'
    WHERE golf_course_id = ${terrain.id} AND internal_ref LIKE 'DEMO-%' AND status = 'active'
    RETURNING id
  `;
  if (archives.length > 0) {
    console.log(`  * demonstration : ${archives.length} caddie(s) de l'ancien modele archive(s)`);
  }

  const [deja] = await sql<{ n: string }[]>`
    SELECT count(*) AS n FROM caddie
    WHERE golf_course_id = ${terrain.id} AND internal_ref = ANY(${DEMO_REFS as unknown as string[]})
  `;
  if (Number(deja?.n ?? 0) > 0) {
    console.log("  * demonstration : deja en place");
    if (base) console.log(`  * apercu client : ${base}/e/${terrain.qr_token}`);
    await sql.end();
    process.exit(0);
  }

  // Trois caddies fictifs, assumes comme tels : le client les verra dans la
  // liste sous la forme « 12 — Hassan F. ».
  /** L'anciennete va avec sa date de releve (ck_caddie_seniority_dated). */
  const jourLocal = new Intl.DateTimeFormat("en-CA", {
    timeZone: terrain.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const fictifs: [string, string, string][] = [
    ["07", "Omar", "Benali"],
    ["12", "Hassan", "Fictif"],
    ["23", "Youssef", "Tazi"],
  ];

  await sql.begin(async (tx) => {
    for (const [ref, prenom, nom] of fictifs) {
      await tx`
        INSERT INTO caddie (id, golf_course_id, internal_ref, first_name, last_name,
                            seniority_years, seniority_recorded_on)
        VALUES (${uuidv7()}, ${terrain.id}, ${ref}, ${prenom}, ${nom}, 6, ${jourLocal})
      `;
    }
  });

  console.log(`  * demonstration : 3 caddies fictifs crees sur ${terrain.name}`);
  if (base) {
    console.log(`  * apercu client : ${base}/e/${terrain.qr_token}`);
  } else {
    console.log("  * PUBLIC_BASE_URL absente : adresse d'apercu introuvable");
  }
} finally {
  await sql.end();
}
