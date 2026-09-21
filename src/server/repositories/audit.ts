import { eq, and, desc, gte, lte, type SQL } from "drizzle-orm";
import { withScope } from "@/db/scope-tx";
import { auditLog, account } from "@/db/schema";
import type { Scope } from "../scope";
import { journaliserConsultation } from "../audit/consultation";

/**
 * Lecture du journal, TOUJOURS limitee au parcours de la portee (FR-039).
 * Aucune fonction n'expose le journal d'un autre parcours.
 */

export interface AuditFilters {
  actorAccountId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

export async function listAuditInScope(scope: Scope, filters: AuditFilters = {}) {
  const conditions: SQL[] = [eq(auditLog.golfCourseId, scope.golfCourseId)];
  if (filters.actorAccountId) conditions.push(eq(auditLog.actorAccountId, filters.actorAccountId));
  if (filters.action) conditions.push(eq(auditLog.action, filters.action));
  if (filters.from) conditions.push(gte(auditLog.occurredAt, filters.from));
  if (filters.to) conditions.push(lte(auditLog.occurredAt, filters.to));

  const entrees = await withScope(scope, (tx) =>
    tx
      .select({
        id: auditLog.id,
        action: auditLog.action,
        targetType: auditLog.targetType,
        targetId: auditLog.targetId,
        occurredAt: auditLog.occurredAt,
        actorFirstName: account.firstName,
        actorLastName: account.lastName,
      })
      .from(auditLog)
      .innerJoin(account, eq(account.id, auditLog.actorAccountId))
      .where(and(...conditions))
      .orderBy(desc(auditLog.occurredAt))
      .limit(filters.limit ?? 200),
  );

  // Consulter le journal est une consultation comme une autre. L'entree
  // apparaitra au rafraichissement suivant, jamais dans la liste qu'elle
  // decrit : c'est la seule facon d'eviter qu'un regard sur le journal
  // s'auto-signale et brouille ce qu'il montre.
  await journaliserConsultation(scope, "audit.read", "golf_course", scope.golfCourseId);

  return entrees;
}
