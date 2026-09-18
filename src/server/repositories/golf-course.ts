import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { golfCourse, accountGolfCourse } from "@/db/schema";
import type { Scope } from "../scope";

/**
 * Depot des terrains.
 *
 * PRINCIPE IV — chaque fonction prend un Scope en PREMIER parametre. Le
 * filtrage par terrain est applique ici, cote serveur, et ne depend d'aucune
 * information fournie par le navigateur (FR-023, FR-024).
 */

export type GolfCourseRow = typeof golfCourse.$inferSelect;

/** Terrains auxquels le compte est rattache. Jamais les autres (FR-023). */
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
 * Le terrain actif de la portee, et lui seul. Un identifiant appartenant a un
 * autre terrain ne remonte rien : indiscernable d'une ressource inexistante
 * (FR-025).
 */
export async function findCourseInScope(scope: Scope, id: string): Promise<GolfCourseRow | null> {
  const rows = await db
    .select()
    .from(golfCourse)
    .where(and(eq(golfCourse.id, id), eq(golfCourse.id, scope.golfCourseId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getActiveCourse(scope: Scope): Promise<GolfCourseRow | null> {
  const rows = await db
    .select()
    .from(golfCourse)
    .where(eq(golfCourse.id, scope.golfCourseId))
    .limit(1);
  return rows[0] ?? null;
}
