import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import { db, type Db } from "./index";
import type { Scope } from "@/server/scope";

/**
 * PORTEE TRANSMISE A POSTGRESQL (FR-023b).
 *
 * Le RLS ne peut cloisonner que s'il sait de quel parcours il s'agit. Ce
 * reglage est LOCAL a la transaction : il disparait au commit, et ne peut
 * donc pas fuir vers la requete suivante qui reutiliserait la connexion.
 * C'est la raison d'etre de la transaction ici — pas l'atomicite.
 *
 * Reentrant : un service qui a deja ouvert sa portee et appelle un depot ne
 * cree pas une seconde transaction, il partage la sienne. Deux parcours
 * differents dans une meme pile est un defaut de programmation, pas un cas
 * d'usage : on leve plutot que de laisser passer.
 */

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

interface Ambiante {
  readonly tx: Tx;
  readonly golfCourseId: string;
}

const ambiante = new AsyncLocalStorage<Ambiante>();

/**
 * GARDE-FOU : un superutilisateur contourne le RLS EN SILENCE.
 *
 * Deployer l'application avec le compte proprietaire de la base annulerait
 * toutes les politiques sans le moindre message. La verification a lieu une
 * fois, a la premiere requete portee, et refuse de servir en production.
 */
let verification: Promise<void> | null = null;

interface RoleCourant {
  nom: string;
  superutilisateur: boolean;
  dispense: boolean;
}

function verifierRoleApplicatif(tx: Tx): Promise<void> {
  verification ??= (async () => {
    const r = await tx.execute(
      sql`SELECT current_user AS nom,
                (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superutilisateur,
                (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS dispense`,
    );
    const ligne = (r as unknown as RoleCourant[])[0];
    if (!ligne?.superutilisateur && !ligne?.dispense) return;

    const message =
      `Connexion a la base sous le role « ${ligne.nom} », qui contourne le RLS. ` +
      "Utiliser le role applicatif (voir APP_DATABASE_URL dans .env.example).";

    if (process.env.NODE_ENV === "production") throw new Error(message);
    console.warn(`[caddieperf] ${message} Tolere hors production.`);
  })();

  return verification;
}

export function withScope<T>(scope: Scope, fn: (tx: Tx) => PromiseLike<T>): Promise<T> {
  return withCourse(scope.golfCourseId, fn);
}

/**
 * Variante pour le parcours client, ou le parcours n'est connu qu'APRES la
 * resolution du jeton : il n'y a pas de compte, donc pas de Scope.
 */
export function withCourse<T>(golfCourseId: string, fn: (tx: Tx) => PromiseLike<T>): Promise<T> {
  const courante = ambiante.getStore();
  if (courante) {
    if (courante.golfCourseId !== golfCourseId) {
      throw new Error("Deux parcours dans une meme transaction : le cloisonnement serait rompu.");
    }
    return Promise.resolve(fn(courante.tx));
  }

  return db.transaction(async (tx) => {
    await verifierRoleApplicatif(tx);
    await tx.execute(sql`SELECT set_config('app.golf_course_id', ${golfCourseId}, true)`);
    return ambiante.run({ tx, golfCourseId }, () => Promise.resolve(fn(tx)));
  });
}
