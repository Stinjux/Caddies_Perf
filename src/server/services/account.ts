import { eq, and, ne, count } from "drizzle-orm";
import { db } from "@/db";
import { account, accountGolfCourse, session } from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";
import { hashPassword } from "../auth/password";
import { requireAdmin, type Scope } from "../scope";
import { writeAudit } from "../audit/write";
import { ValidationError, ConflictError, NotFoundError, LastAdminError } from "../errors";

/**
 * Service des comptes (FR-008 a FR-017).
 *
 * L'INVARIANT DU DERNIER ADMINISTRATEUR (FR-015) est verifie DANS la
 * transaction, juste avant l'ecriture : un controle fait avant la transaction
 * laisserait une fenetre ou deux desactivations simultanees videraient le
 * terrain de ses administrateurs.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AccountInput {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: "admin" | "starter";
}

function validate(input: AccountInput): void {
  if (!EMAIL.test(input.email?.trim() ?? "")) {
    throw new ValidationError("email", "L'adresse de courriel n'est pas valide.");
  }
  if (!input.firstName?.trim())
    throw new ValidationError("firstName", "Le prénom est obligatoire.");
  if (!input.lastName?.trim()) throw new ValidationError("lastName", "Le nom est obligatoire.");
  if ((input.password?.length ?? 0) < 12) {
    throw new ValidationError("password", "Le mot de passe doit compter au moins 12 caractères.");
  }
}

/** Compte les administrateurs actifs restants, en excluant un compte donne. */
async function countOtherActiveAdmins(
  tx: Tx,
  golfCourseId: string,
  excludingAccountId: string,
): Promise<number> {
  const rows = await tx
    .select({ n: count() })
    .from(accountGolfCourse)
    .innerJoin(account, eq(account.id, accountGolfCourse.accountId))
    .where(
      and(
        eq(accountGolfCourse.golfCourseId, golfCourseId),
        eq(accountGolfCourse.role, "admin"),
        eq(account.status, "active"),
        ne(account.id, excludingAccountId),
      ),
    );
  return Number(rows[0]?.n ?? 0);
}

export async function createAccount(scope: Scope, input: AccountInput): Promise<string> {
  requireAdmin(scope);
  validate(input);

  const email = input.email.trim().toLowerCase();
  const id = uuidv7();
  const passwordHash = await hashPassword(input.password);

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: account.id })
      .from(account)
      .where(eq(account.email, email))
      .limit(1);
    if (existing.length > 0) {
      throw new ValidationError("email", "Cette adresse de courriel est déjà utilisée.");
    }

    await tx.insert(account).values({
      id,
      email,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      passwordHash,
    });

    await tx.insert(accountGolfCourse).values({
      accountId: id,
      golfCourseId: scope.golfCourseId,
      role: input.role,
    });

    await writeAudit(tx, scope, { action: "account.create", targetType: "account", targetId: id });
  });

  return id;
}

/** FR-014, FR-015, FR-016 : desactive un compte et detruit ses sessions. */
export async function disableAccount(
  scope: Scope,
  accountId: string,
  expectedVersion: number,
): Promise<void> {
  requireAdmin(scope);

  await db.transaction(async (tx) => {
    const role = await tx
      .select({ role: accountGolfCourse.role })
      .from(accountGolfCourse)
      .where(
        and(
          eq(accountGolfCourse.accountId, accountId),
          eq(accountGolfCourse.golfCourseId, scope.golfCourseId),
        ),
      )
      .limit(1);
    if (role.length === 0) throw new NotFoundError();

    if (role[0]!.role === "admin") {
      const remaining = await countOtherActiveAdmins(tx, scope.golfCourseId, accountId);
      if (remaining === 0) throw new LastAdminError();
    }

    const updated = await tx
      .update(account)
      .set({ status: "disabled", updatedAt: new Date(), version: expectedVersion + 1 })
      .where(and(eq(account.id, accountId), eq(account.version, expectedVersion)))
      .returning({ id: account.id });
    if (updated.length === 0) throw new ConflictError();

    // FR-016 : la session ne survit pas a la desactivation.
    await tx.delete(session).where(eq(session.accountId, accountId));

    await writeAudit(tx, scope, {
      action: "account.disable",
      targetType: "account",
      targetId: accountId,
    });
  });
}

export async function enableAccount(
  scope: Scope,
  accountId: string,
  expectedVersion: number,
): Promise<void> {
  requireAdmin(scope);

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(account)
      .set({ status: "active", updatedAt: new Date(), version: expectedVersion + 1 })
      .where(and(eq(account.id, accountId), eq(account.version, expectedVersion)))
      .returning({ id: account.id });
    if (updated.length === 0) throw new ConflictError();

    await writeAudit(tx, scope, {
      action: "account.enable",
      targetType: "account",
      targetId: accountId,
    });
  });
}

export { countOtherActiveAdmins };
