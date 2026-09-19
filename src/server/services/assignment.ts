import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { withScope } from "@/db/scope-tx";
import { assignment, booking, cart, caddie } from "@/db/schema";
import { uuidv7 } from "@/lib/uuid";
import { localDateFor } from "@/lib/timezone";
import { type Scope } from "../scope";
import { requireRole } from "../auth/require-role";
import { getActiveCourse } from "../repositories/golf-course";
import { ValidationError, NotFoundError, ConflictError } from "../errors";

/**
 * RÉSERVATIONS ET AFFECTATIONS (spéc. 3, FR-201 a FR-261).
 *
 * L'import CSV des réservations est HORS PÉRIMÈTRE du pilote : le Starter
 * saisit lui-même le numéro de réservation et l'heure de départ, et
 * `booking.source` vaut alors `manual`.
 *
 * FR-052 : un caddie PEUT servir plusieurs voiturettes. Deux voiturettes,
 * un caddie = DEUX affectations, même caddie. Scanner l'une ou l'autre mène
 * au même caddie.
 */

export interface AffectationInput {
  bookingRef: string;
  teeTime: Date;
  cartId: string;
  caddieId: string;
}

/** Crée la réservation si besoin, puis l'affectation, en une transaction. */
export async function creerAffectation(scope: Scope, input: AffectationInput): Promise<string> {
  requireRole(scope, "starter", "admin");

  const ref = input.bookingRef?.trim();
  if (!ref) throw new ValidationError("bookingRef", "Le numéro de réservation est obligatoire.");
  if (!(input.teeTime instanceof Date) || Number.isNaN(input.teeTime.getTime())) {
    throw new ValidationError("teeTime", "L'heure de départ est invalide.");
  }

  const terrain = await getActiveCourse(scope);
  if (!terrain) throw new NotFoundError();

  const id = uuidv7();

  await withScope(scope, async (tx) => {
    // La voiturette et le caddie doivent appartenir au terrain actif. Les
    // clés composites le garantiraient de toute façon, mais un message clair
    // vaut mieux qu'une erreur de base de données.
    const v = await tx
      .select({ id: cart.id, status: cart.status })
      .from(cart)
      .where(and(eq(cart.id, input.cartId), eq(cart.golfCourseId, scope.golfCourseId)))
      .limit(1);
    if (v.length === 0) throw new NotFoundError();
    if (v[0]!.status === "maintenance" || v[0]!.status === "inactive") {
      throw new ValidationError("cartId", "Cette voiturette n'est pas disponible.");
    }

    const c = await tx
      .select({ id: caddie.id, status: caddie.status, availability: caddie.availability })
      .from(caddie)
      .where(and(eq(caddie.id, input.caddieId), eq(caddie.golfCourseId, scope.golfCourseId)))
      .limit(1);
    if (c.length === 0) throw new NotFoundError();
    if (c[0]!.status !== "active") {
      throw new ValidationError("caddieId", "Ce caddie n'est plus actif.");
    }
    if (c[0]!.availability !== "available") {
      throw new ValidationError("caddieId", "Ce caddie est signalé indisponible.");
    }

    // Une voiturette ne peut porter qu'UNE affectation active à la fois.
    const occupee = await tx
      .select({ id: assignment.id })
      .from(assignment)
      .where(
        and(
          eq(assignment.golfCourseId, scope.golfCourseId),
          eq(assignment.cartId, input.cartId),
          eq(assignment.status, "active"),
        ),
      )
      .limit(1);
    if (occupee.length > 0) {
      throw new ConflictError();
    }

    // Réservation : réutilisée si elle existe déjà, créée sinon (source manuelle).
    let bookingId: string;
    const existante = await tx
      .select({ id: booking.id })
      .from(booking)
      .where(and(eq(booking.golfCourseId, scope.golfCourseId), eq(booking.externalRef, ref)))
      .limit(1);

    if (existante.length > 0) {
      bookingId = existante[0]!.id;
    } else {
      bookingId = uuidv7();
      await tx.insert(booking).values({
        id: bookingId,
        golfCourseId: scope.golfCourseId,
        externalRef: ref,
        teeTime: input.teeTime,
        source: "manual",
      });
    }

    const debut = new Date();
    await tx.insert(assignment).values({
      id,
      golfCourseId: scope.golfCourseId,
      bookingId,
      cartId: input.cartId,
      caddieId: input.caddieId,
      localDate: localDateFor(debut, terrain.timezone),
      startedAt: debut,
      createdByAccountId: scope.accountId,
    });

    await tx
      .update(cart)
      .set({ status: "assigned", updatedAt: new Date() })
      .where(eq(cart.id, input.cartId));
  });

  return id;
}

/** Corriger une erreur de saisie : changer le caddie ou la voiturette. */
export async function corrigerAffectation(
  scope: Scope,
  id: string,
  champs: { cartId?: string; caddieId?: string },
): Promise<void> {
  requireRole(scope, "starter", "admin");

  await withScope(scope, async (tx) => {
    const a = await tx
      .select()
      .from(assignment)
      .where(and(eq(assignment.id, id), eq(assignment.golfCourseId, scope.golfCourseId)))
      .limit(1);
    if (a.length === 0) throw new NotFoundError();
    if (a[0]!.status !== "active") {
      throw new ValidationError("statut", "Cette affectation est déjà terminée ou annulée.");
    }

    const ancienneVoiturette = a[0]!.cartId;

    await tx
      .update(assignment)
      .set({
        cartId: champs.cartId ?? a[0]!.cartId,
        caddieId: champs.caddieId ?? a[0]!.caddieId,
        updatedAt: new Date(),
        version: a[0]!.version + 1,
      })
      .where(eq(assignment.id, id));

    if (champs.cartId && champs.cartId !== ancienneVoiturette) {
      await tx.update(cart).set({ status: "available" }).where(eq(cart.id, ancienneVoiturette));
      await tx.update(cart).set({ status: "assigned" }).where(eq(cart.id, champs.cartId));
    }
  });
}

/** FR-044 : seule une affectation TERMINÉE alimente le jour travaillé. */
export async function terminerAffectation(scope: Scope, id: string): Promise<void> {
  requireRole(scope, "starter", "admin");

  await withScope(scope, async (tx) => {
    const a = await tx
      .select()
      .from(assignment)
      .where(and(eq(assignment.id, id), eq(assignment.golfCourseId, scope.golfCourseId)))
      .limit(1);
    if (a.length === 0) throw new NotFoundError();
    if (a[0]!.status !== "active") {
      throw new ValidationError("statut", "Cette affectation n'est plus active.");
    }

    await tx
      .update(assignment)
      .set({ status: "completed", endedAt: new Date(), updatedAt: new Date() })
      .where(eq(assignment.id, id));

    await tx.update(cart).set({ status: "available" }).where(eq(cart.id, a[0]!.cartId));
  });
}

export async function annulerAffectation(scope: Scope, id: string): Promise<void> {
  requireRole(scope, "starter", "admin");

  await withScope(scope, async (tx) => {
    const a = await tx
      .select()
      .from(assignment)
      .where(and(eq(assignment.id, id), eq(assignment.golfCourseId, scope.golfCourseId)))
      .limit(1);
    if (a.length === 0) throw new NotFoundError();

    await tx
      .update(assignment)
      .set({ status: "cancelled", endedAt: new Date(), updatedAt: new Date() })
      .where(eq(assignment.id, id));

    await tx.update(cart).set({ status: "available" }).where(eq(cart.id, a[0]!.cartId));
  });
}

/** Affectations du jour, vue restreinte du Starter (FR-020). */
export async function affectationsDuJour(scope: Scope) {
  const terrain = await getActiveCourse(scope);
  if (!terrain) return [];

  const aujourdhui = localDateFor(new Date(), terrain.timezone);

  return withScope(scope, (tx) =>
    tx
      .select({
        id: assignment.id,
        bookingRef: booking.externalRef,
        teeTime: booking.teeTime,
        cartNumber: cart.visibleNumber,
        caddieRef: caddie.internalRef,
        caddieFirstName: caddie.firstName,
        caddieLastName: caddie.lastName,
        status: assignment.status,
      })
      .from(assignment)
      .innerJoin(booking, eq(booking.id, assignment.bookingId))
      .innerJoin(cart, eq(cart.id, assignment.cartId))
      .innerJoin(caddie, eq(caddie.id, assignment.caddieId))
      .where(
        and(eq(assignment.golfCourseId, scope.golfCourseId), eq(assignment.localDate, aujourdhui)),
      )
      .orderBy(desc(assignment.startedAt)),
  );
}

/**
 * FR-044 — JOURS TRAVAILLÉS : nombre de dates locales DISTINCTES comportant
 * au moins une affectation terminée. Plusieurs réservations le même jour ne
 * comptent qu'une seule fois.
 */
export async function joursTravailles(scope: Scope, caddieId: string): Promise<number> {
  const rows = await withScope(scope, (tx) =>
    tx
      .select({ n: sql<string>`count(distinct ${assignment.localDate})` })
      .from(assignment)
      .where(
        and(
          eq(assignment.golfCourseId, scope.golfCourseId),
          eq(assignment.caddieId, caddieId),
          eq(assignment.status, "completed"),
        ),
      ),
  );
  return Number(rows[0]?.n ?? 0);
}
