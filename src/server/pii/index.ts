import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { withScope } from "@/db/scope-tx";
import { caddie, caddiePersonalData } from "@/db/schema";
import { requireAdmin, type Scope } from "../scope";
import { writeAudit } from "../audit/write";
import { NotFoundError, ValidationError } from "../errors";

/**
 * POINT D'ENTREE UNIQUE DES RENSEIGNEMENTS PERSONNELS (principe I, FR-030).
 *
 * Aucun autre module du code ne lit caddie_personal_data.
 *
 * Garanties structurelles :
 *  - Lecture UNITAIRE seulement. Aucune operation en lot n'est exposee :
 *    un export massif est donc impossible, pas seulement decourage.
 *  - Chaque acces ecrit une entree de journal dans la MEME transaction :
 *    la journalisation n'est pas contournable (FR-036).
 *  - Un Starter recoit NotFoundError, indiscernable d'un caddie inexistant,
 *    pour ne pas reveler l'existence de la donnee (FR-020, FR-025).
 */

async function assertCaddieInScope(scope: Scope, caddieId: string): Promise<void> {
  const rows = await withScope(scope, (tx) =>
    tx
      .select({ id: caddie.id })
      .from(caddie)
      .where(and(eq(caddie.id, caddieId), eq(caddie.golfCourseId, scope.golfCourseId)))
      .limit(1),
  );
  if (rows.length === 0) throw new NotFoundError();
}

/** Lit l'annee de naissance d'UN caddie. Journalise systematiquement. */
export async function readBirthYear(scope: Scope, caddieId: string): Promise<number | null> {
  requireAdmin(scope);
  await assertCaddieInScope(scope, caddieId);

  return withScope(scope, async (tx) => {
    const rows = await tx
      .select({ birthYear: caddiePersonalData.birthYear })
      .from(caddiePersonalData)
      .where(eq(caddiePersonalData.caddieId, caddieId))
      .limit(1);

    await writeAudit(tx, scope, { action: "pii.read", targetType: "caddie", targetId: caddieId });
    return rows[0]?.birthYear ?? null;
  });
}

/** Ecrit ou corrige l'annee de naissance. Journalise systematiquement. */
export async function writeBirthYear(
  scope: Scope,
  caddieId: string,
  birthYear: number,
): Promise<void> {
  requireAdmin(scope);
  await assertCaddieInScope(scope, caddieId);

  const maxYear = new Date().getFullYear() - 15;
  if (!Number.isInteger(birthYear) || birthYear < 1940 || birthYear > maxYear) {
    throw new ValidationError(
      "birthYear",
      `L'année de naissance doit être comprise entre 1940 et ${maxYear}.`,
    );
  }

  await withScope(scope, async (tx) => {
    await tx
      .insert(caddiePersonalData)
      .values({ caddieId, birthYear })
      .onConflictDoUpdate({
        target: caddiePersonalData.caddieId,
        set: { birthYear, updatedAt: new Date() },
      });

    await writeAudit(tx, scope, { action: "pii.write", targetType: "caddie", targetId: caddieId });
  });
}

/**
 * Efface les renseignements personnels SANS toucher a l'historique du caddie
 * ni aux statistiques du parcours (FR-033, SC-009).
 */
export async function eraseBirthYear(scope: Scope, caddieId: string): Promise<void> {
  requireAdmin(scope);
  await assertCaddieInScope(scope, caddieId);

  await withScope(scope, async (tx) => {
    await tx.delete(caddiePersonalData).where(eq(caddiePersonalData.caddieId, caddieId));
    await writeAudit(tx, scope, { action: "pii.erase", targetType: "caddie", targetId: caddieId });
  });
}
