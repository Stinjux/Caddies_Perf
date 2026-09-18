import { and, lt, isNotNull, eq } from "drizzle-orm";
import { db } from "@/db";
import { caddie, caddiePersonalData, evaluation, auditLog } from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";

/**
 * PURGE A ECHEANCE (FR-034, FR-034b, FR-034c).
 *
 * Durees arretees par le proprietaire du produit le 2026-09-18 :
 *  - annee de naissance : effacee 2 ans apres la desactivation du caddie
 *  - commentaires clients : effaces 2 ans apres leur depot
 *  - evaluations chiffrees : conservees SANS LIMITE (anonymes)
 *
 * REGLE CRITIQUE (FR-034b, FR-034c) : la purge ne doit JAMAIS alterer les
 * moyennes ni les statistiques historiques. Un commentaire est donc VIDE,
 * jamais supprime avec sa ligne : l'evaluation chiffree subsiste.
 */

export const RETENTION_YEARS_BIRTH_YEAR = 2;
export const RETENTION_YEARS_COMMENT = 2;

export interface PurgeReport {
  birthYearsErased: number;
  commentsCleared: number;
}

/**
 * Efface les annees de naissance des caddies desactives depuis plus de deux
 * ans. Le caddie et tout son historique demeurent (FR-042).
 *
 * `systemAccountId` identifie l'auteur de la purge dans le journal : une
 * purge automatique reste une modification de donnees sensibles et doit
 * etre imputable (FR-036).
 */
async function purgeBirthYears(now: Date, systemAccountId: string): Promise<number> {
  const seuil = new Date(now);
  seuil.setFullYear(seuil.getFullYear() - RETENTION_YEARS_BIRTH_YEAR);

  const expires = await db
    .select({ caddieId: caddie.id, golfCourseId: caddie.golfCourseId })
    .from(caddie)
    .innerJoin(caddiePersonalData, eq(caddiePersonalData.caddieId, caddie.id))
    .where(and(eq(caddie.status, "disabled"), lt(caddie.updatedAt, seuil)));

  for (const row of expires) {
    await db.transaction(async (tx) => {
      await tx.delete(caddiePersonalData).where(eq(caddiePersonalData.caddieId, row.caddieId));
      await tx.insert(auditLog).values({
        id: uuidv7(),
        golfCourseId: row.golfCourseId,
        actorAccountId: systemAccountId,
        action: "retention.purge",
        targetType: "caddie",
        targetId: row.caddieId,
      });
    });
  }

  return expires.length;
}

/**
 * Vide les commentaires arrives a echeance. La LIGNE d'evaluation subsiste,
 * avec ses notes chiffrees : sans cela, les statistiques historiques
 * s'effaceraient d'elles-memes (FR-034c).
 */
async function purgeComments(now: Date): Promise<number> {
  const vides = await db
    .update(evaluation)
    .set({ comment: null })
    .where(and(isNotNull(evaluation.comment), lt(evaluation.commentPurgeAt, now)))
    .returning({ id: evaluation.id });

  return vides.length;
}

export async function runRetentionPurge(
  systemAccountId: string,
  now: Date = new Date(),
): Promise<PurgeReport> {
  return {
    birthYearsErased: await purgeBirthYears(now, systemAccountId),
    commentsCleared: await purgeComments(now),
  };
}

/** Echeance de purge d'un commentaire, calculee a la soumission. */
export function commentPurgeDate(submittedAt: Date): Date {
  const d = new Date(submittedAt);
  d.setFullYear(d.getFullYear() + RETENTION_YEARS_COMMENT);
  return d;
}
