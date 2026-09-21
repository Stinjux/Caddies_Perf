import { auditLog } from "@/db/schema";
import type { Db } from "@/db";
import { uuidv7 } from "@/lib/uuid";

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
  | "account.grant_general"
  | "account.revoke_general"
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

/**
 * Qui agit, et sur quel parcours.
 *
 * Une portee satisfait ce contrat, mais l'inverse n'est pas vrai — et c'est
 * le point. La creation d'un parcours journalise un evenement AVANT qu'une
 * portee existe : le parcours vient de naitre. Exiger ici une portee
 * complete obligeait a en fabriquer une de toutes pieces, par une conversion
 * forcee qui contournait justement le garde-fou cense l'interdire.
 *
 * En demandant le strict necessaire, le journal cesse d'etre une raison de
 * forger des portees.
 */
export interface Auteur {
  readonly accountId: string;
  readonly golfCourseId: string;
}

export interface AuditEntry {
  readonly action: AuditAction;
  readonly targetType: "golf_course" | "account" | "caddie" | "cart" | "evaluation" | "report";
  readonly targetId: string | null;
}

/** La transaction en cours, ou la connexion elle-meme hors transaction. */
export type AuditTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function writeAudit(tx: AuditTx, auteur: Auteur, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLog).values({
    id: uuidv7(),
    golfCourseId: auteur.golfCourseId,
    actorAccountId: auteur.accountId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
  });
}
