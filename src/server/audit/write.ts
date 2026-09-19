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
  | "retention.purge"
  // CONSULTATIONS. Une lecture ne laisse aucune trace naturelle : sans ces
  // entrees, savoir QUI a regarde QUOI serait impossible apres coup.
  //
  // Toutes les lectures ne sont pas journalisees, et c'est deliberé : l'ecran
  // du Starter, qui n'affiche qu'une liste blanche de champs sans donnee
  // personnelle ni note, est rafraichi des dizaines de fois par jour. L'y
  // inclure noierait le journal, et un journal que personne ne lit ne protege
  // rien. Sont journalisees les consultations qui revelent plus que le strict
  // necessaire operationnel.
  | "caddie.list"
  | "caddie.read"
  | "account.list"
  | "report.read"
  | "report.export"
  | "audit.read";

export interface AuditEntry {
  readonly action: AuditAction;
  readonly targetType: "golf_course" | "account" | "caddie" | "cart" | "evaluation" | "report";
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
