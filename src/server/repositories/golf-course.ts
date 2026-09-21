import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { withScope } from "@/db/scope-tx";
import { golfCourse, accountGolfCourse } from "@/db/schema";
import type { Scope } from "../scope";

/**
 * Depot des parcours.
 *
 * PRINCIPE IV — chaque fonction prend un Scope en PREMIER parametre. Le
 * filtrage par parcours est applique ici, cote serveur, et ne depend d'aucune
 * information fournie par le navigateur (FR-023, FR-024).
 */

export type GolfCourseRow = typeof golfCourse.$inferSelect;

/**
 * Parcours auxquels le compte est RATTACHE. Jamais les autres (FR-023).
 *
 * ATTENTION — ce n'est PAS « les parcours accessibles ». Un administrateur
 * general n'est rattache a aucun parcours et n'en verrait donc aucun ici.
 * Pour decider ce qu'un ecran affiche, c'est listLinksForAccount (depot des
 * comptes) qu'il faut appeler : lui tient compte des deux niveaux.
 *
 * Cette fonction-ci sert a prouver le cloisonnement par rattachement, et rien
 * d'autre.
 */
export async function listCoursesForAccount(accountId: string): Promise<GolfCourseRow[]> {
  const rows = await db
    .select({ course: golfCourse })
    .from(accountGolfCourse)
    .innerJoin(golfCourse, eq(golfCourse.id, accountGolfCourse.golfCourseId))
    .where(eq(accountGolfCourse.accountId, accountId))
    .orderBy(asc(golfCourse.name));
  return rows.map((r) => r.course);
}

/**
 * Le parcours actif de la portee, et lui seul. Un identifiant appartenant a un
 * autre parcours ne remonte rien : indiscernable d'une ressource inexistante
 * (FR-025).
 */
export async function findCourseInScope(scope: Scope, id: string): Promise<GolfCourseRow | null> {
  const rows = await withScope(scope, (tx) =>
    tx
      .select()
      .from(golfCourse)
      .where(and(eq(golfCourse.id, id), eq(golfCourse.id, scope.golfCourseId)))
      .limit(1),
  );
  return rows[0] ?? null;
}

export async function getActiveCourse(scope: Scope): Promise<GolfCourseRow | null> {
  const rows = await withScope(scope, (tx) =>
    tx.select().from(golfCourse).where(eq(golfCourse.id, scope.golfCourseId)).limit(1),
  );
  return rows[0] ?? null;
}
