import { withScope } from "@/db/scope-tx";
import { writeAudit, type AuditAction, type AuditEntry } from "./write";
import type { Scope } from "../scope";

/**
 * JOURNAL DES CONSULTATIONS.
 *
 * Une modification laisse une trace dans les donnees ; une LECTURE n'en
 * laisse aucune. Sans entree explicite, savoir qui a consulte la liste des
 * caddies, un rapport ou le journal lui-meme serait impossible apres coup.
 *
 * Journalise APRES coup, et seulement si la lecture a reussi : consigner une
 * consultation qui n'a rien montre donnerait un journal trompeur.
 *
 * Comme pour les modifications, une entree ne porte QUE des identifiants
 * internes — jamais ce qui a ete lu (FR-037).
 */

export type ActionConsultation = Extract<
  AuditAction,
  "caddie.list" | "caddie.read" | "account.list" | "report.read" | "report.export" | "audit.read"
>;

export async function journaliserConsultation(
  scope: Scope,
  action: ActionConsultation,
  targetType: AuditEntry["targetType"],
  targetId: string | null = null,
): Promise<void> {
  await withScope(scope, (tx) => writeAudit(tx, scope, { action, targetType, targetId }));
}
