import { randomBytes } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { withScope, withCourse } from "@/db/scope-tx";
import { golfCourse, accountGolfCourse } from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";
import { isValidTimezone } from "@/lib/timezone";
import { requireAdmin, type Scope } from "../scope";
import { estAdminGeneral } from "../repositories/account";
import { writeAudit } from "../audit/write";
import { ValidationError, ConflictError, NotFoundError, ForbiddenError } from "../errors";

/**
 * Service des parcours (FR-001 a FR-007).
 *
 * Chaque mutation est journalisee dans la MEME transaction que l'ecriture,
 * et protegee par verrouillage optimiste (FR-045).
 */

export interface CourseInput {
  name: string;
  address?: string | null;
  timezone: string;
  logoPath?: string | null;
  brandColorPrimary?: string | null;
  brandColorSecondary?: string | null;
  googleReviewUrl?: string | null;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function validate(input: CourseInput): void {
  if (!input.name?.trim()) {
    throw new ValidationError("name", "Le nom du parcours est obligatoire.");
  }
  if (!input.timezone?.trim()) {
    throw new ValidationError("timezone", "Le fuseau horaire est obligatoire.");
  }
  if (!isValidTimezone(input.timezone)) {
    throw new ValidationError("timezone", `Fuseau horaire inconnu : « ${input.timezone} ».`);
  }
  for (const [field, value] of [
    ["brandColorPrimary", input.brandColorPrimary],
    ["brandColorSecondary", input.brandColorSecondary],
  ] as const) {
    if (value && !HEX.test(value)) {
      throw new ValidationError(field, "La couleur doit être au format hexadécimal, ex. #1b4d3e.");
    }
  }
  if (input.googleReviewUrl) {
    try {
      const u = new URL(input.googleReviewUrl);
      if (u.protocol !== "https:") throw new Error();
    } catch {
      throw new ValidationError("googleReviewUrl", "Le lien d'avis doit être une adresse https.");
    }
  }
}

/**
 * La creation d'un parcours precede toute portee : elle rattache d'office son
 * createur comme administrateur, sans quoi le parcours naitrait orphelin (FR-015).
 *
 * RESERVEE A L'ADMINISTRATEUR GENERAL. Creer un parcours ne se fait depuis
 * aucun parcours : c'est un acte de plateforme. Un administrateur ordinaire
 * qui le pourrait se fabriquerait un domaine a lui, hors de toute surveillance.
 */
export async function createCourse(actorAccountId: string, input: CourseInput): Promise<string> {
  // L'autorisation AVANT la validation : a qui n'a pas le droit d'agir, on ne
  // dit meme pas si sa saisie etait correcte.
  if (!(await estAdminGeneral(actorAccountId))) throw new ForbiddenError();

  validate(input);
  const id = uuidv7();

  // Le parcours n'existe pas encore, mais son identifiant est deja tire : on
  // ouvre la portee AVANT l'insertion, faute de quoi le RLS refuserait la
  // ligne qui inaugure le parcours — et son entree de journal avec elle.
  await withCourse(id, async (tx) => {
    await tx.insert(golfCourse).values({
      id,
      name: input.name.trim(),
      // Jeton opaque et PERMANENT : il vit sur une affiche, au depart.
      qrToken: randomBytes(32).toString("base64url"),
      address: input.address ?? null,
      timezone: input.timezone,
      logoPath: input.logoPath ?? null,
      brandColorPrimary: input.brandColorPrimary ?? null,
      brandColorSecondary: input.brandColorSecondary ?? null,
      googleReviewUrl: input.googleReviewUrl ?? null,
    });

    await tx
      .insert(accountGolfCourse)
      .values({ accountId: actorAccountId, golfCourseId: id, role: "admin" });

    // Ni portee ni conversion forcee : le journal ne demande que l'auteur et
    // le parcours, qui sont l'un et l'autre etablis ici.
    await writeAudit(
      tx,
      { accountId: actorAccountId, golfCourseId: id },
      {
        action: "course.create",
        targetType: "golf_course",
        targetId: id,
      },
    );
  });

  return id;
}

/** FR-045 : une ecriture portant une version perimee n'ecrit rien. */
export async function updateCourse(
  scope: Scope,
  input: CourseInput,
  expectedVersion: number,
): Promise<void> {
  requireAdmin(scope);
  validate(input);

  await withScope(scope, async (tx) => {
    const updated = await tx
      .update(golfCourse)
      .set({
        name: input.name.trim(),
        address: input.address ?? null,
        timezone: input.timezone,
        logoPath: input.logoPath ?? null,
        brandColorPrimary: input.brandColorPrimary ?? null,
        brandColorSecondary: input.brandColorSecondary ?? null,
        googleReviewUrl: input.googleReviewUrl ?? null,
        updatedAt: new Date(),
        version: expectedVersion + 1,
      })
      .where(and(eq(golfCourse.id, scope.golfCourseId), eq(golfCourse.version, expectedVersion)))
      .returning({ id: golfCourse.id });

    if (updated.length === 0) {
      const exists = await tx
        .select({ id: golfCourse.id })
        .from(golfCourse)
        .where(eq(golfCourse.id, scope.golfCourseId))
        .limit(1);
      throw exists.length === 0 ? new NotFoundError() : new ConflictError();
    }

    await writeAudit(tx, scope, {
      action: "course.update",
      targetType: "golf_course",
      targetId: scope.golfCourseId,
    });
  });
}

/** FR-006 : un parcours porteur d'historique est archive, jamais supprime. */
export async function archiveCourse(scope: Scope, expectedVersion: number): Promise<void> {
  requireAdmin(scope);

  await withScope(scope, async (tx) => {
    const updated = await tx
      .update(golfCourse)
      .set({ status: "archived", updatedAt: new Date(), version: expectedVersion + 1 })
      .where(and(eq(golfCourse.id, scope.golfCourseId), eq(golfCourse.version, expectedVersion)))
      .returning({ id: golfCourse.id });

    if (updated.length === 0) throw new ConflictError();

    await writeAudit(tx, scope, {
      action: "course.archive",
      targetType: "golf_course",
      targetId: scope.golfCourseId,
    });
  });
}
