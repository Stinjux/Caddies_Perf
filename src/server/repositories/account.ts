import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { withScope } from "@/db/scope-tx";
import { account, accountGolfCourse, golfCourse } from "@/db/schema";
import type { Scope } from "../scope";

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
  version: number;
}

const PUBLIC_COLUMNS = {
  id: account.id,
  email: account.email,
  firstName: account.firstName,
  lastName: account.lastName,
  status: account.status,
  version: account.version,
} as const;

/** Comptes rattaches au terrain actif, et eux seuls (FR-023). */
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

/** Rattachements d'un compte, avec le terrain et le role. */
export async function listLinksForAccount(accountId: string) {
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

/** Role du compte SUR ce terrain. Null si aucun rattachement (FR-012). */
export async function roleOnCourse(
  accountId: string,
  golfCourseId: string,
): Promise<"admin" | "starter" | null> {
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
