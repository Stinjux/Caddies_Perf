import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { account, session } from "@/db/schema";
import { genererSecret, codeValide, uriOtpauth, genererCodesDeSecours } from "@/lib/totp";
import { hashPassword, verifyPassword } from "./password";
import { hashToken } from "./session";
import { ValidationError, UnauthenticatedError } from "../errors";

/**
 * SECOND FACTEUR POUR LES ADMINISTRATEURS.
 *
 * Trois moments distincts, et ils ne se confondent pas :
 *  1. PREPARER — un secret est tire et enregistre, mais le compte n'est PAS
 *     encore protege. Tant que l'inscription n'est pas confirmee, la
 *     connexion reste a un facteur : imposer un secret que l'utilisateur n'a
 *     pas reussi a enregistrer dans son telephone l'enfermerait dehors.
 *  2. CONFIRMER — l'utilisateur prouve qu'il detient le secret en tapant un
 *     code. C'est SEULEMENT la que le second facteur devient exigible, et que
 *     les codes de secours sont remis.
 *  3. VERIFIER — a chaque connexion ulterieure.
 *
 * Le secret ne sort de ce module qu'une fois, a l'etape 1. Aucune autre
 * fonction ne le renvoie, et aucun journal ne le contient.
 */

export interface Inscription {
  secret: string;
  uri: string;
}

export async function preparerInscription(accountId: string): Promise<Inscription> {
  const [compte] = await db
    .select({
      email: account.email,
      secret: account.totpSecret,
      enrolledAt: account.totpEnrolledAt,
    })
    .from(account)
    .where(eq(account.id, accountId))
    .limit(1);

  if (!compte) throw new UnauthenticatedError();
  if (compte.enrolledAt) {
    throw new ValidationError("mfa", "Un second facteur est déjà en place sur ce compte.");
  }

  /**
   * LE SECRET EN ATTENTE EST REUTILISE, JAMAIS REMPLACE.
   *
   * Cette fonction est appelee a CHAQUE affichage de l'ecran d'inscription.
   * En tirer un nouveau secret a chaque fois rendait l'inscription
   * impossible : l'utilisateur scanne un secret, la page se reaffiche — un
   * rafraichissement, un retour arriere, un message d'erreur suffisent — et
   * le code qu'il tape est celui d'un secret que la base a deja oublie. Il
   * n'aurait jamais pu terminer, sans comprendre pourquoi.
   *
   * Le secret n'est remplace qu'apres un retrait explicite du second facteur.
   */
  const secret = compte.secret ?? genererSecret();
  if (!compte.secret) {
    await db.update(account).set({ totpSecret: secret }).where(eq(account.id, accountId));
  }

  return { secret, uri: uriOtpauth(secret, compte.email) };
}

/** Confirme l'inscription et rend les codes de secours, EN CLAIR et une fois. */
export async function confirmerInscription(
  accountId: string,
  code: string,
  maintenant: Date = new Date(),
): Promise<string[]> {
  const [compte] = await db
    .select({ secret: account.totpSecret, enrolledAt: account.totpEnrolledAt })
    .from(account)
    .where(eq(account.id, accountId))
    .limit(1);

  if (!compte?.secret) {
    throw new ValidationError("mfa", "Aucune inscription en cours. Recommencez.");
  }
  if (compte.enrolledAt) {
    throw new ValidationError("mfa", "Un second facteur est déjà en place sur ce compte.");
  }
  if (!codeValide(compte.secret, code, maintenant)) {
    throw new ValidationError("code", "Code incorrect. Vérifiez l'heure de votre téléphone.");
  }

  const codes = genererCodesDeSecours();
  const haches = await Promise.all(codes.map((c) => hashPassword(c)));

  await db
    .update(account)
    .set({ totpEnrolledAt: maintenant, recoveryCodes: haches })
    .where(eq(account.id, accountId));

  // Rendus EN CLAIR ici et nulle part ailleurs : la base n'en garde que les
  // haches. Un utilisateur qui ne les note pas ne pourra pas les retrouver.
  return codes;
}

export async function secondFacteurActif(accountId: string): Promise<boolean> {
  const [compte] = await db
    .select({ enrolledAt: account.totpEnrolledAt })
    .from(account)
    .where(eq(account.id, accountId))
    .limit(1);
  return compte?.enrolledAt != null;
}

/**
 * Verifie le code d'une session en attente. Accepte aussi un code de secours,
 * qui est alors CONSOMME.
 */
export async function verifierSecondFacteur(
  jetonSession: string,
  code: string,
  maintenant: Date = new Date(),
): Promise<void> {
  const [ligne] = await db
    .select({
      sessionId: session.id,
      accountId: account.id,
      secret: account.totpSecret,
      codesDeSecours: account.recoveryCodes,
    })
    .from(session)
    .innerJoin(account, eq(account.id, session.accountId))
    .where(and(eq(session.tokenHash, hashToken(jetonSession)), gt(session.expiresAt, maintenant)))
    .limit(1);

  if (!ligne?.secret) throw new UnauthenticatedError();

  const erreur = new ValidationError("code", "Code incorrect.");
  const saisi = code.trim().toUpperCase();

  if (codeValide(ligne.secret, saisi, maintenant)) {
    await db.update(session).set({ mfaPending: false }).where(eq(session.id, ligne.sessionId));
    return;
  }

  // Code de secours. Tous les candidats sont compares, sans court-circuit,
  // pour ne pas reveler par la duree combien de codes restent valables.
  const restants = ligne.codesDeSecours ?? [];
  let indexUtilise = -1;
  for (const [i, hache] of restants.entries()) {
    if (await verifyPassword(saisi, hache)) indexUtilise = i;
  }
  if (indexUtilise < 0) throw erreur;

  await db
    .update(account)
    .set({ recoveryCodes: restants.filter((_, i) => i !== indexUtilise) })
    .where(eq(account.id, ligne.accountId));

  await db.update(session).set({ mfaPending: false }).where(eq(session.id, ligne.sessionId));
}

/**
 * Retire le second facteur d'un compte. Sert au depannage — un telephone
 * perdu et des codes de secours egares — et DETRUIT toutes les sessions du
 * compte : laisser vivre une session ouverte avant la reinitialisation
 * reviendrait a garder une porte que l'on croit avoir fermee.
 */
export async function retirerSecondFacteur(accountId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(account)
      .set({ totpSecret: null, totpEnrolledAt: null, recoveryCodes: null })
      .where(eq(account.id, accountId));
    await tx.delete(session).where(eq(session.accountId, accountId));
  });
}

/** Nombre de codes de secours encore utilisables. Jamais les codes eux-memes. */
export async function codesDeSecoursRestants(accountId: string): Promise<number> {
  const [compte] = await db
    .select({ codes: account.recoveryCodes })
    .from(account)
    .where(eq(account.id, accountId))
    .limit(1);
  return compte?.codes?.length ?? 0;
}
