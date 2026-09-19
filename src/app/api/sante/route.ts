import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/**
 * POINT D'APTITUDE, interroge par l'hebergeur.
 *
 * Il INTERROGE LA BASE. Un point qui se contente de repondre « je suis la »
 * declare l'application saine alors qu'elle ne peut servir aucune page :
 * l'hebergeur laisse alors passer le trafic vers une version morte.
 *
 * Il ne revele RIEN : ni version, ni nom de base, ni message d'erreur. Une
 * page d'aptitude est publique par nature, et bavarder ici reviendrait a
 * documenter l'installation pour qui la sonde.
 */
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({ etat: "ok" });
  } catch {
    return Response.json({ etat: "indisponible" }, { status: 503 });
  }
}
