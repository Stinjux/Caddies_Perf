import { eq, and, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { Scope } from "../scope";
import { ConflictError } from "../errors";

/**
 * Base des depots.
 *
 * PRINCIPE IV — toute fonction d'acces aux donnees prend un Scope en PREMIER
 * parametre. Un appel qui l'omet est une erreur de compilation, pas un oubli
 * a reperer en revue (FR-023).
 */

/** Filtre obligatoire par terrain. A combiner avec toute autre condition. */
export function scoped(scope: Scope, courseColumn: PgColumn, ...extra: (SQL | undefined)[]): SQL {
  const conditions = [eq(courseColumn, scope.golfCourseId), ...extra.filter(Boolean)];
  return and(...(conditions as SQL[]))!;
}

/**
 * Verrouillage optimiste (FR-045). Une ecriture portant une version perimee
 * n'ecrit rien et leve ConflictError, plutot que d'ecraser en silence.
 */
export function assertWritten(rowCount: number): void {
  if (rowCount === 0) throw new ConflictError();
}

export function nextVersion(current: number): number {
  return current + 1;
}
