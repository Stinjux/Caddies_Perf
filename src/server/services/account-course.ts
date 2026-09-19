import { eq, and, ne, count } from "drizzle-orm";
import { db } from "@/db";
import { withScope } from "@/db/scope-tx";
import { account, accountGolfCourse, session } from "@/db/schema";
import { requireAdmin, type Scope } from "../scope";
import { writeAudit } from "../audit/write";
import { ValidationError, NotFoundError, LastAdminError } from "../errors";

/**
 * Rattachements compte - terrain (FR-010, FR-015).
 *
 * Un detachement qui laisserait un terrain sans administrateur actif est
 * REFUSE, comme une desactivation. Le controle vit dans la transaction.
 */

export async function attachAccount(
  scope: Scope,
  accountId: string,
  role: "admin" | "starter",
): Promise<void> {
  requireAdmin(scope);

  // Verification HORS portee, et c'est necessaire : rattacher quelqu'un a ce
  // terrain suppose precisement qu'il n'y est pas encore rattache. Sous portee,
  // le RLS ne le verrait pas, et l'operation serait impossible par nature.
  // Aucune information n'est divulguee au-dela de « cet identifiant existe » —
  // que l'appelant tient deja, puisqu'il le fournit.
  const exists = await db
    .select({ id: account.id })
    .from(account)
    .where(eq(account.id, accountId))
    .limit(1);
  if (exists.length === 0) throw new NotFoundError();

  await withScope(scope, async (tx) => {
    const already = await tx
      .select({ role: accountGolfCourse.role })
      .from(accountGolfCourse)
      .where(
        and(
          eq(accountGolfCourse.accountId, accountId),
          eq(accountGolfCourse.golfCourseId, scope.golfCourseId),
        ),
      )
      .limit(1);
    if (already.length > 0) {
      throw new ValidationError("account", "Ce compte est déjà rattaché à ce terrain.");
    }

    await tx
      .insert(accountGolfCourse)
      .values({ accountId, golfCourseId: scope.golfCourseId, role });

    await writeAudit(tx, scope, {
      action: "account.attach",
      targetType: "account",
      targetId: accountId,
    });
  });
}

export async function detachAccount(scope: Scope, accountId: string): Promise<void> {
  requireAdmin(scope);

  await withScope(scope, async (tx) => {
    const link = await tx
      .select({ role: accountGolfCourse.role })
      .from(accountGolfCourse)
      .where(
        and(
          eq(accountGolfCourse.accountId, accountId),
          eq(accountGolfCourse.golfCourseId, scope.golfCourseId),
        ),
      )
      .limit(1);
    if (link.length === 0) throw new NotFoundError();

    if (link[0]!.role === "admin") {
      const remaining = await tx
        .select({ n: count() })
        .from(accountGolfCourse)
        .innerJoin(account, eq(account.id, accountGolfCourse.accountId))
        .where(
          and(
            eq(accountGolfCourse.golfCourseId, scope.golfCourseId),
            eq(accountGolfCourse.role, "admin"),
            eq(account.status, "active"),
            ne(account.id, accountId),
          ),
        );
      if (Number(remaining[0]?.n ?? 0) === 0) throw new LastAdminError();
    }

    await tx
      .delete(accountGolfCourse)
      .where(
        and(
          eq(accountGolfCourse.accountId, accountId),
          eq(accountGolfCourse.golfCourseId, scope.golfCourseId),
        ),
      );

    // Une session pointant vers un terrain desormais non rattache est invalide.
    await tx
      .update(session)
      .set({ activeGolfCourseId: null })
      .where(
        and(eq(session.accountId, accountId), eq(session.activeGolfCourseId, scope.golfCourseId)),
      );

    await writeAudit(tx, scope, {
      action: "account.detach",
      targetType: "account",
      targetId: accountId,
    });
  });
}
