import { eq, and, asc } from "drizzle-orm";
import { withScope } from "@/db/scope-tx";
import { caddie } from "@/db/schema";
import type { Scope } from "../scope";
import { toStarterCaddie, type StarterCaddieView } from "../serializers/starter";
import { journaliserConsultation } from "../audit/consultation";

/**
 * Depot des caddies.
 *
 * PRINCIPE I — aucune fonction ici ne touche caddie_personal_data. L'annee
 * de naissance ne s'obtient QUE par src/server/pii/, qui journalise.
 */

export type CaddieRow = typeof caddie.$inferSelect;

export async function listCaddies(scope: Scope): Promise<CaddieRow[]> {
  const rows = await withScope(scope, (tx) =>
    tx
      .select()
      .from(caddie)
      .where(eq(caddie.golfCourseId, scope.golfCourseId))
      .orderBy(asc(caddie.internalRef)),
  );
  await journaliserConsultation(scope, "caddie.list", "caddie");
  return rows;
}

/** Vue RESTREINTE destinee au Starter : liste blanche de champs (FR-020). */
export async function listCaddiesForStarter(scope: Scope): Promise<StarterCaddieView[]> {
  const rows = await withScope(scope, (tx) =>
    tx
      .select({
        id: caddie.id,
        internalRef: caddie.internalRef,
        firstName: caddie.firstName,
        lastName: caddie.lastName,
        status: caddie.status,
        availability: caddie.availability,
      })
      .from(caddie)
      .where(and(eq(caddie.golfCourseId, scope.golfCourseId), eq(caddie.status, "active")))
      .orderBy(asc(caddie.internalRef)),
  );

  return rows.map((r) =>
    toStarterCaddie({ ...r, status: r.availability === "available" ? "active" : "unavailable" }),
  );
}

export async function findCaddie(scope: Scope, id: string): Promise<CaddieRow | null> {
  const rows = await withScope(scope, (tx) =>
    tx
      .select()
      .from(caddie)
      .where(and(eq(caddie.id, id), eq(caddie.golfCourseId, scope.golfCourseId)))
      .limit(1),
  );
  if (rows[0]) await journaliserConsultation(scope, "caddie.read", "caddie", id);
  return rows[0] ?? null;
}
