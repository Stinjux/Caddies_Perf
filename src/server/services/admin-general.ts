import { eq, and, asc } from "drizzle-orm";
import { withScope } from "@/db/scope-tx";
import { account, accountGolfCourse } from "@/db/schema";
import { requireGeneralAdmin, type Scope } from "../scope";
import { writeAudit } from "../audit/write";
import { NotFoundError, ValidationError } from "../errors";

/**
 * NIVEAU GENERAL D'ADMINISTRATION.
 *
 * Deux niveaux, et deux seulement :
 *   - administrateur          : un parcours, celui auquel il est rattache ;
 *   - administrateur general  : tous les parcours, y compris a venir.
 *
 * Seul un administrateur general peut accorder ou retirer ce niveau. Un
 * administrateur ordinaire, meme irreprochable sur son parcours, ne peut pas
 * s'elever lui-meme — sans quoi la distinction ne serait qu'un affichage.
 *
 * ON N'AGIT QUE SUR QUELQU'UN DE SON PROPRE PARCOURS. La regle a une raison
 * humaine — on ne modifie les droits que de quelqu'un que l'on cotoie — et
 * une raison technique, consignee dans la migration 0007 : PostgreSQL refuse
 * une ecriture qui rendrait la ligne invisible a son auteur, ce qui est
 * exactement ce qu'est la retrogradation d'un compte non rattache.
 */

/** Le compte est-il rattache au parcours de la portee ? */
async function rattacheAuParcours(
  tx: Parameters<Parameters<typeof withScope>[1]>[0],
  scope: Scope,
  accountId: string,
): Promise<boolean> {
  const lien = await tx
    .select({ role: accountGolfCourse.role })
    .from(accountGolfCourse)
    .where(
      and(
        eq(accountGolfCourse.accountId, accountId),
        eq(accountGolfCourse.golfCourseId, scope.golfCourseId),
      ),
    )
    .limit(1);
  return lien.length > 0;
}

const HORS_PARCOURS =
  "Ce compte n'est pas rattaché au parcours courant. Passez sur l'un de ses parcours pour modifier son niveau.";

export interface CompteGeneral {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: "active" | "disabled";
}

/** Tous les administrateurs generaux de la plateforme. */
export async function listerAdminsGeneraux(scope: Scope): Promise<CompteGeneral[]> {
  requireGeneralAdmin(scope);
  return withScope(scope, (tx) =>
    tx
      .select({
        id: account.id,
        email: account.email,
        firstName: account.firstName,
        lastName: account.lastName,
        status: account.status,
      })
      .from(account)
      .where(eq(account.generalAdmin, true))
      .orderBy(asc(account.lastName), asc(account.firstName)),
  );
}

export async function accorderNiveauGeneral(scope: Scope, accountId: string): Promise<void> {
  requireGeneralAdmin(scope);

  await withScope(scope, async (tx) => {
    const cible = await tx
      .select({ id: account.id, general: account.generalAdmin })
      .from(account)
      .where(eq(account.id, accountId))
      .limit(1);
    // Pas de controle de rattachement ici, et ce n'est pas un oubli : sous
    // portee, un compte qui n'est ni rattache au parcours courant ni deja
    // general n'est tout simplement PAS VISIBLE (RLS). Il est donc
    // indiscernable d'un compte inexistant — exactement ce que prescrit
    // FR-025 — et la requete ci-dessus est deja le controle.
    if (cible.length === 0) throw new NotFoundError();
    if (cible[0]!.general) return;

    await tx
      .update(account)
      .set({ generalAdmin: true, updatedAt: new Date() })
      .where(eq(account.id, accountId));

    await writeAudit(tx, scope, {
      action: "account.grant_general",
      targetType: "account",
      targetId: accountId,
    });
  });
}

export async function retirerNiveauGeneral(scope: Scope, accountId: string): Promise<void> {
  requireGeneralAdmin(scope);

  // Se retirer son propre niveau reviendrait a se fermer la porte au nez, et
  // possiblement la derniere. Le refus est immediat et explicite.
  if (accountId === scope.accountId) {
    throw new ValidationError(
      "account",
      "Vous ne pouvez pas retirer votre propre niveau général. Demandez-le à un autre administrateur général.",
    );
  }

  await withScope(scope, async (tx) => {
    const restants = await tx
      .select({ id: account.id })
      .from(account)
      .where(eq(account.generalAdmin, true));

    const cible = restants.find((r) => r.id === accountId);
    if (!cible) throw new NotFoundError();

    // Une plateforme sans administrateur general n'a plus personne pour creer
    // un parcours ni reparer les droits : l'etat serait irreversible depuis
    // l'application elle-meme.
    if (restants.length <= 1) {
      throw new ValidationError(
        "account",
        "C'est le dernier administrateur général : en désigner un autre d'abord.",
      );
    }

    if (!(await rattacheAuParcours(tx, scope, accountId))) {
      throw new ValidationError("account", HORS_PARCOURS);
    }

    await tx
      .update(account)
      .set({ generalAdmin: false, updatedAt: new Date() })
      .where(eq(account.id, accountId));

    await writeAudit(tx, scope, {
      action: "account.revoke_general",
      targetType: "account",
      targetId: accountId,
    });
  });
}
