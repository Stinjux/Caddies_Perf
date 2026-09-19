import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { withScope } from "@/db/scope-tx";
import { caddie, assignment } from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";
import { requireAdmin, type Scope } from "../scope";
import { requireRole } from "../auth/require-role";
import { writeAudit } from "../audit/write";
import { ValidationError, ConflictError, NotFoundError } from "../errors";

/** Cycle de vie du caddie (spéc. 2, FR-141 a FR-155). */

export interface CaddieInput {
  internalRef: string;
  firstName: string;
  lastName: string;
  seniorityYears?: number | null;
}

function valider(input: CaddieInput): void {
  if (!input.internalRef?.trim())
    throw new ValidationError("internalRef", "L'identifiant interne est obligatoire.");
  if (!input.firstName?.trim())
    throw new ValidationError("firstName", "Le prénom est obligatoire.");
  if (!input.lastName?.trim()) throw new ValidationError("lastName", "Le nom est obligatoire.");
  if (
    input.seniorityYears !== null &&
    input.seniorityYears !== undefined &&
    (!Number.isInteger(input.seniorityYears) || input.seniorityYears < 0)
  ) {
    throw new ValidationError(
      "seniorityYears",
      "L'ancienneté doit être un nombre entier d'années.",
    );
  }
}

export async function createCaddie(scope: Scope, input: CaddieInput): Promise<string> {
  requireAdmin(scope);
  valider(input);

  const id = uuidv7();
  const ref = input.internalRef.trim();

  await withScope(scope, async (tx) => {
    const existe = await tx
      .select({ id: caddie.id })
      .from(caddie)
      .where(and(eq(caddie.golfCourseId, scope.golfCourseId), eq(caddie.internalRef, ref)))
      .limit(1);
    if (existe.length > 0) {
      throw new ValidationError("internalRef", `L'identifiant « ${ref} » est déjà utilisé.`);
    }

    await tx.insert(caddie).values({
      id,
      golfCourseId: scope.golfCourseId,
      internalRef: ref,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      seniorityYears: input.seniorityYears ?? null,
      seniorityRecordedOn:
        input.seniorityYears !== null && input.seniorityYears !== undefined
          ? new Date().toISOString().slice(0, 10)
          : null,
    });

    await writeAudit(tx, scope, { action: "caddie.create", targetType: "caddie", targetId: id });
  });

  return id;
}

export async function updateCaddie(
  scope: Scope,
  id: string,
  input: CaddieInput,
  expectedVersion: number,
): Promise<void> {
  requireAdmin(scope);
  valider(input);

  await withScope(scope, async (tx) => {
    const maj = await tx
      .update(caddie)
      .set({
        internalRef: input.internalRef.trim(),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        seniorityYears: input.seniorityYears ?? null,
        seniorityRecordedOn:
          input.seniorityYears !== null && input.seniorityYears !== undefined
            ? new Date().toISOString().slice(0, 10)
            : null,
        updatedAt: new Date(),
        version: expectedVersion + 1,
      })
      .where(
        and(
          eq(caddie.id, id),
          eq(caddie.golfCourseId, scope.golfCourseId),
          eq(caddie.version, expectedVersion),
        ),
      )
      .returning({ id: caddie.id });

    if (maj.length === 0) {
      const existe = await tx
        .select({ id: caddie.id })
        .from(caddie)
        .where(and(eq(caddie.id, id), eq(caddie.golfCourseId, scope.golfCourseId)))
        .limit(1);
      throw existe.length === 0 ? new NotFoundError() : new ConflictError();
    }

    await writeAudit(tx, scope, { action: "caddie.update", targetType: "caddie", targetId: id });
  });
}

/** FR-042 : un caddie désactivé conserve l'intégralité de son historique. */
export async function setCaddieStatus(
  scope: Scope,
  id: string,
  status: "active" | "disabled",
  expectedVersion: number,
): Promise<void> {
  requireAdmin(scope);

  await withScope(scope, async (tx) => {
    const maj = await tx
      .update(caddie)
      .set({ status, updatedAt: new Date(), version: expectedVersion + 1 })
      .where(
        and(
          eq(caddie.id, id),
          eq(caddie.golfCourseId, scope.golfCourseId),
          eq(caddie.version, expectedVersion),
        ),
      )
      .returning({ id: caddie.id });

    if (maj.length === 0) throw new ConflictError();

    await writeAudit(tx, scope, {
      action: status === "disabled" ? "caddie.disable" : "caddie.update",
      targetType: "caddie",
      targetId: id,
    });
  });
}

/**
 * DÉPART D'UN CADDIE (archivage).
 *
 * Désactiver ne suffit pas : un caddie parti peut être affecté à une partie
 * en cours. Le laisser ainsi, c'est laisser son nom s'afficher au 18e trou
 * sur le questionnaire d'un client, pour un service qu'il n'a pas rendu.
 * L'archivage clôt donc d'abord ses affectations du jour.
 *
 * Son HISTORIQUE demeure intégralement (FR-042) : les évaluations passées
 * nourrissent la moyenne du parcours, et les effacer fausserait les
 * comparaisons de tous les autres caddies. L'année de naissance, elle, est
 * purgée deux ans après le départ — durée arrêtée le 18 septembre 2026.
 */
export async function archiverCaddie(
  scope: Scope,
  id: string,
  expectedVersion: number,
): Promise<number> {
  requireAdmin(scope);

  return withScope(scope, async (tx) => {
    const closes = await tx
      .update(assignment)
      .set({ status: "cancelled", endedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(assignment.caddieId, id),
          eq(assignment.golfCourseId, scope.golfCourseId),
          eq(assignment.status, "active"),
        ),
      )
      .returning({ id: assignment.id });

    const maj = await tx
      .update(caddie)
      .set({
        status: "disabled",
        availability: "unavailable",
        updatedAt: new Date(),
        version: expectedVersion + 1,
      })
      .where(
        and(
          eq(caddie.id, id),
          eq(caddie.golfCourseId, scope.golfCourseId),
          eq(caddie.version, expectedVersion),
        ),
      )
      .returning({ id: caddie.id });

    if (maj.length === 0) throw new ConflictError();

    await writeAudit(tx, scope, {
      action: "caddie.disable",
      targetType: "caddie",
      targetId: id,
    });

    return closes.length;
  });
}

/**
 * FR-049 : disponibilité OPÉRATIONNELLE, distincte du cycle de vie.
 * Le Starter y a droit — c'est le seul champ du caddie qu'il peut modifier.
 */
export async function setCaddieAvailability(
  scope: Scope,
  id: string,
  availability: "available" | "unavailable",
): Promise<void> {
  requireRole(scope, "admin", "starter");

  const maj = await withScope(scope, (tx) =>
    tx
      .update(caddie)
      .set({ availability, updatedAt: new Date() })
      .where(and(eq(caddie.id, id), eq(caddie.golfCourseId, scope.golfCourseId)))
      .returning({ id: caddie.id }),
  );

  if (maj.length === 0) throw new NotFoundError();
}
