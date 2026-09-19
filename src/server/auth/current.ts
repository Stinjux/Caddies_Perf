import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { account, session, accountGolfCourse } from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";
import { createScopeFromVerifiedSession, type Scope } from "../scope";
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
  scope: Scope | null;
}

export async function login(email: string, password: string): Promise<string> {
  const rows = await db
    .select({
      id: account.id,
      passwordHash: account.passwordHash,
      status: account.status,
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

  const links = await db
    .select({ golfCourseId: accountGolfCourse.golfCourseId, role: accountGolfCourse.role })
    .from(accountGolfCourse)
    .where(eq(accountGolfCourse.accountId, found.id));

  if (links.length === 0) {
    throw new ValidationError(
      "account",
      "Votre compte n'est rattaché à aucun terrain. Contactez un administrateur.",
    );
  }

  // FR-012 : un seul rattachement, le terrain est choisi d'office.
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

  return token;
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
    const link = await db
      .select({ role: accountGolfCourse.role })
      .from(accountGolfCourse)
      .where(
        and(
          eq(accountGolfCourse.accountId, row.accountId),
          eq(accountGolfCourse.golfCourseId, row.activeGolfCourseId),
        ),
      )
      .limit(1);

    // Le rattachement a pu etre retire : la portee devient invalide (P-1).
    scope = link[0]
      ? createScopeFromVerifiedSession({
          accountId: row.accountId,
          golfCourseId: row.activeGolfCourseId,
          role: link[0].role,
        })
      : null;
  }

  return {
    accountId: row.accountId,
    firstName: row.firstName,
    lastName: row.lastName,
    activeGolfCourseId: row.activeGolfCourseId,
    scope,
  };
}

/** FR-012 : changer de terrain actif, apres verification du rattachement. */
export async function selectCourse(token: string, golfCourseId: string): Promise<void> {
  const ctx = await resolveSession(token);
  if (!ctx) throw new UnauthenticatedError();

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

  await db
    .update(session)
    .set({ activeGolfCourseId: golfCourseId, lastSeenAt: new Date() })
    .where(eq(session.tokenHash, hashToken(token)));
}

export async function logout(token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(session).where(eq(session.tokenHash, hashToken(token)));
}
