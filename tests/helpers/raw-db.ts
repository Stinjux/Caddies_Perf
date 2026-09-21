import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { testDbUrl } from "./reset-db";

/**
 * CONNEXION DE TEST, PROPRIETAIRE DE LA BASE — elle VOIT TOUT.
 *
 * Les tests passent par le role applicatif, soumis au RLS (voir
 * vitest.config.ts). Mais leurs propres fixtures et leurs verifications ne
 * doivent PAS l'etre : un test qui affirme « aucune ligne de l'autre parcours
 * n'a fuite » doit interroger la base sans oeilleres, sinon il constate son
 * propre aveuglement et se declare satisfait.
 *
 * Regle d'usage : `db` de "@/db" = ce que fait l'APPLICATION ;
 *                 `db` d'ici     = ce que contient REELLEMENT la base.
 */

const client = postgres(testDbUrl(), { max: 4 });

export const db = drizzle(client, { schema });
export const fermerDbBrute = () => client.end();
