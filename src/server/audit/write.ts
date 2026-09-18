import { auditLog } from "@/db/schema";
import type { Db } from "@/db";
import { uuidv7 } from "@/lib/uuid";
import type { Scope } from "../scope";

/**
 * Journal en ecriture seule (FR-035 a FR-038).
 *
 * PRINCIPE I — une entree ne porte QUE des identifiants internes. Aucune
 * valeur metier, aucun nom, aucun commentaire, aucune annee de naissance
 * (FR-037). Le type ci-dessous rend l'ajout d'un champ libre impossible.
 *
 * L'ecriture se fait dans la MEME transaction que l'action journalisee :
 * les deux reussissent ou echouent ensemble.
 */

export type AuditAction =
  | "course.create"
  | "course.update"
  | "course.archive"
  | "account.create"
  | "account.update"
  | "account.disable"
  | "account.enable"
  | "account.attach"
  | "account.detach"
  | "account.password_reset"
  | "caddie.create"
  | "caddie.update"
  | "caddie.disable"
  | "pii.read"
  | "pii.write"
  | "pii.erase"
  | "retention.purge";

export interface AuditEntry {
  readonly action: AuditAction;
  readonly targetType: "golf_course" | "account" | "caddie" | "cart" | "evaluation";
  readonly targetId: string | null;
}

/** La transaction en cours, ou la connexion elle-meme hors transaction. */
export type AuditTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function writeAudit(tx: AuditTx, scope: Scope, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLog).values({
    id: uuidv7(),
    golfCourseId: scope.golfCourseId,
    actorAccountId: scope.accountId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
  });
}
