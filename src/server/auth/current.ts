import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { account, session, accountGolfCourse, golfCourse } from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";
import { createScopeFromVerifiedSession, type Scope } from "../scope";
import { listLinksForAccount, estAdminGeneral } from "../repositories/account";
import { verifyPassword } from "./password";
import { createSessionToken, hashToken, sessionExpiry } from "./session";
import { UnauthenticatedError, ValidationError } from "../errors";

/**
 * Verification de session, seule source possible d'une portee (FR-024).
 *
 * Le statut du compte est reverifie a CHAQUE requete : une session dont le
 * compte est passe a "disabled" est detruite immediatement, sans attendre
 * l'expiration (FR-016).
 */

/** Leurre sans materiel cryptographique, pour egaliser le temps de reponse. */
const LEURRE_TEMPS_CONSTANT = ["scrypt", "16384", "8", "1", "AAAA", "AAAA"].join("$");

export interface SessionContext {
  accountId: string;
  firstName: string;
  lastName: string;
  activeGolfCourseId: string | null;
  /** Niveau general : « admin » sur tous les parcours, presents et a venir. */
  generalAdmin: boolean;
  scope: Scope | null;
}

export interface Connexion {
  token: string;
}

export async function login(email: string, password: string): Promise<Connexion> {
  const rows = await db
    .select({
      id: account.id,
      passwordHash: account.passwordHash,
      status: account.status,
      generalAdmin: account.generalAdmin,
    })
    .from(account)
    .where(eq(account.email, email.trim().toLowerCase()))
    .limit(1);

  const found = rows[0];
  // Message IDENTIQUE que l'adresse soit inconnue ou le mot de passe faux :
  // ne jamais reveler quels comptes existent.
  const generic = new ValidationError("credentials", "Adresse ou mot de passe incorrect.");

  if (!found || found.status !== "active") {
    // Cout de verification maintenu meme sans compte, pour ne rien reveler
    // par le temps de reponse. Ce leurre ne contient AUCUN materiel
    // cryptographique : sel et cle sont des octets nuls.
    await verifyPassword(password, LEURRE_TEMPS_CONSTANT);
    throw generic;
  }
  if (!(await verifyPassword(password, found.passwordHash))) throw generic;

  // Pour un administrateur general, « rattachements » veut dire TOUS les
  // parcours : c'est la meme fonction qui repond, afin que la connexion et
  // les ecrans ne puissent jamais diverger sur ce qui est accessible.
  const links = await listLinksForAccount(found.id);

  if (links.length === 0) {
    // Un administrateur general sans aucun parcours n'est pas un compte mal
    // configure : c'est une plateforme encore vide. Le message le dit, sans
    // quoi le premier administrateur resterait a la porte de sa propre
    // installation.
    throw new ValidationError(
      "account",
      found.generalAdmin
        ? "Aucun parcours n'existe encore. Créez-en un pour commencer."
        : "Votre compte n'est rattaché à aucun parcours. Contactez un administrateur.",
    );
  }

  // FR-012 : un seul parcours accessible, il est choisi d'office.
  const sole = links.length === 1 ? links[0]!.golfCourseId : null;
  const role = links.length === 1 ? links[0]!.role : "starter";

  const { token, tokenHash } = createSessionToken();
  await db.insert(session).values({
    id: uuidv7(),
    tokenHash,
    accountId: found.id,
    activeGolfCourseId: sole,
    expiresAt: sessionExpiry(role),
  });

  return { token };
}

export async function resolveSession(token: string | undefined): Promise<SessionContext | null> {
  if (!token) return null;

  const rows = await db
    .select({
      sessionId: session.id,
      accountId: account.id,
      firstName: account.firstName,
      lastName: account.lastName,
      status: account.status,
      generalAdmin: account.generalAdmin,
      activeGolfCourseId: session.activeGolfCourseId,
    })
    .from(session)
    .innerJoin(account, eq(account.id, session.accountId))
    .where(and(eq(session.tokenHash, hashToken(token)), gt(session.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // FR-016 : compte desactive depuis l'ouverture de session.
  if (row.status !== "active") {
    await db.delete(session).where(eq(session.id, row.sessionId));
    return null;
  }

  let scope: Scope | null = null;
  if (row.activeGolfCourseId) {
    // Un administrateur general est « admin » partout : la question du
    // rattachement ne se pose pas pour lui. Pour tous les autres, elle est
    // reposee A CHAQUE REQUETE — un rattachement retire pendant la session
    // doit invalider la portee sans attendre l'expiration (P-1).
    const role = row.generalAdmin
      ? "admin"
      : ((
          await db
            .select({ role: accountGolfCourse.role })
            .from(accountGolfCourse)
            .where(
              and(
                eq(accountGolfCourse.accountId, row.accountId),
                eq(accountGolfCourse.golfCourseId, row.activeGolfCourseId),
              ),
            )
            .limit(1)
        )[0]?.role ?? null);

    scope = role
      ? createScopeFromVerifiedSession({
          accountId: row.accountId,
          golfCourseId: row.activeGolfCourseId,
          role,
          generalAdmin: row.generalAdmin,
        })
      : null;
  }

  return {
    accountId: row.accountId,
    firstName: row.firstName,
    lastName: row.lastName,
    activeGolfCourseId: row.activeGolfCourseId,
    generalAdmin: row.generalAdmin,
    scope,
  };
}

/** FR-012 : changer de parcours actif, apres verification de l'acces. */
export async function selectCourse(token: string, golfCourseId: string): Promise<void> {
  const ctx = await resolveSession(token);
  if (!ctx) throw new UnauthenticatedError();

  // Le niveau general est relu en base, jamais pris dans le contexte : c'est
  // la seule lecture qui fasse foi si le privilege vient d'etre retire.
  if (!(await estAdminGeneral(ctx.accountId))) {
    const link = await db
      .select({ role: accountGolfCourse.role })
      .from(accountGolfCourse)
      .where(
        and(
          eq(accountGolfCourse.accountId, ctx.accountId),
          eq(accountGolfCourse.golfCourseId, golfCourseId),
        ),
      )
      .limit(1);
    if (link.length === 0) throw new UnauthenticatedError();
  } else {
    // Meme pour lui, le parcours doit exister : sans ce controle, une portee
    // pointerait vers un identifiant fantome.
    const existe = await db
      .select({ id: golfCourse.id })
      .from(golfCourse)
      .where(eq(golfCourse.id, golfCourseId))
      .limit(1);
    if (existe.length === 0) throw new UnauthenticatedError();
  }

  await db
    .update(session)
    .set({ activeGolfCourseId: golfCourseId, lastSeenAt: new Date() })
    .where(eq(session.tokenHash, hashToken(token)));
}

export async function logout(token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(session).where(eq(session.tokenHash, hashToken(token)));
}
