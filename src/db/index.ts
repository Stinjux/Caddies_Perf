import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Le RLS ne s'applique qu'a un role qui n'est ni superutilisateur ni
 * proprietaire des tables. APP_DATABASE_URL designe ce role et l'emporte donc
 * des qu'elle existe ; DATABASE_URL reste la connexion proprietaire, reservee
 * aux migrations et au peuplement, qui doivent pouvoir tout faire.
 */
const url = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("APP_DATABASE_URL et DATABASE_URL sont absentes de l'environnement.");

const client = postgres(url, { max: 10 });

export const db = drizzle(client, { schema });
export type Db = typeof db;
export { schema };
