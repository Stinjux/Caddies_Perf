import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { withScope } from "@/db/scope-tx";
import { account, accountGolfCourse, golfCourse } from "@/db/schema";
import type { Scope } from "../scope";
import { journaliserConsultation } from "../audit/consultation";

/**
 * Depot des comptes.
 *
 * REGLE ABSOLUE : passwordHash n'est JAMAIS selectionne. L'exclusion se fait
 * ici, dans la projection, et non a l'affichage — un champ absent de la
 * requete ne peut fuiter ni dans un journal, ni dans une reponse, ni dans un
 * export (FR-017).
 */

export interface AccountSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: "active" | "disabled";
  /** Niveau general : administrateur de TOUS les parcours. */
  generalAdmin: boolean;
  version: number;
}

const PUBLIC_COLUMNS = {
  id: account.id,
  email: account.email,
  firstName: account.firstName,
  lastName: account.lastName,
  status: account.status,
  generalAdmin: account.generalAdmin,
  version: account.version,
} as const;

/** Comptes rattaches au parcours actif, et eux seuls (FR-023). */
export async function listAccountsInScope(
  scope: Scope,
): Promise<(AccountSummary & { role: "admin" | "starter" })[]> {
  const rows = await withScope(scope, (tx) =>
    tx
      .select({ ...PUBLIC_COLUMNS, role: accountGolfCourse.role })
      .from(accountGolfCourse)
      .innerJoin(account, eq(account.id, accountGolfCourse.accountId))
      .where(eq(accountGolfCourse.golfCourseId, scope.golfCourseId))
      .orderBy(asc(account.lastName), asc(account.firstName)),
  );
  await journaliserConsultation(scope, "account.list", "account");
  return rows;
}

export async function findAccountByEmail(email: string) {
  const rows = await db
    .select({ ...PUBLIC_COLUMNS, passwordHash: account.passwordHash })
    .from(account)
    .where(eq(account.email, email.trim().toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function findAccountInScope(
  scope: Scope,
  accountId: string,
): Promise<AccountSummary | null> {
  const rows = await withScope(scope, (tx) =>
    tx
      .select(PUBLIC_COLUMNS)
      .from(account)
      .innerJoin(accountGolfCourse, eq(accountGolfCourse.accountId, account.id))
      .where(and(eq(account.id, accountId), eq(accountGolfCourse.golfCourseId, scope.golfCourseId)))
      .limit(1),
  );
  return rows[0] ?? null;
}

export interface LienParcours {
  golfCourseId: string;
  name: string;
  timezone: string;
  status: "active" | "archived";
  role: "admin" | "starter";
}

/** Vrai si le compte porte le niveau general. Lecture unique, sans portee. */
export async function estAdminGeneral(accountId: string): Promise<boolean> {
  const rows = await db
    .select({ g: account.generalAdmin })
    .from(account)
    .where(eq(account.id, accountId))
    .limit(1);
  return rows[0]?.g === true;
}

/**
 * Parcours accessibles a un compte.
 *
 * LE TEST DU NIVEAU GENERAL EST FAIT ICI, et nulle part ailleurs. Les ecrans
 * qui listent des parcours appellent cette seule fonction : aucun ne peut
 * oublier le cas, et le prochain l'heritera sans rien savoir.
 */
export async function listLinksForAccount(accountId: string): Promise<LienParcours[]> {
  if (await estAdminGeneral(accountId)) {
    const tous = await db
      .select({
        golfCourseId: golfCourse.id,
        name: golfCourse.name,
        timezone: golfCourse.timezone,
        status: golfCourse.status,
      })
      .from(golfCourse)
      .orderBy(asc(golfCourse.name));
    return tous.map((c) => ({ ...c, role: "admin" as const }));
  }

  return db
    .select({
      golfCourseId: golfCourse.id,
      name: golfCourse.name,
      timezone: golfCourse.timezone,
      status: golfCourse.status,
      role: accountGolfCourse.role,
    })
    .from(accountGolfCourse)
    .innerJoin(golfCourse, eq(golfCourse.id, accountGolfCourse.golfCourseId))
    .where(eq(accountGolfCourse.accountId, accountId))
    .orderBy(asc(golfCourse.name));
}

/**
 * Role du compte SUR ce parcours. Null si aucun rattachement (FR-012).
 *
 * Un administrateur general est « admin » partout — mais seulement sur un
 * parcours QUI EXISTE : sans cette verification, un identifiant invente
 * ouvrirait une portee vide, et l'echec surviendrait plus loin, plus obscur.
 */
export async function roleOnCourse(
  accountId: string,
  golfCourseId: string,
): Promise<"admin" | "starter" | null> {
  if (await estAdminGeneral(accountId)) {
    const existe = await db
      .select({ id: golfCourse.id })
      .from(golfCourse)
      .where(eq(golfCourse.id, golfCourseId))
      .limit(1);
    return existe.length > 0 ? "admin" : null;
  }

  const rows = await db
    .select({ role: accountGolfCourse.role })
    .from(accountGolfCourse)
    .where(
      and(
        eq(accountGolfCourse.accountId, accountId),
        eq(accountGolfCourse.golfCourseId, golfCourseId),
      ),
    )
    .limit(1);
  return rows[0]?.role ?? null;
}
