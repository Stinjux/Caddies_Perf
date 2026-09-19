import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { assignment, booking, cart, caddie, golfCourse } from "@/db/schema";
import { localDateFor } from "@/lib/timezone";
import { findCartByToken } from "./cart";

/**
 * RÉSOLUTION D'UN QR CODE SCANNÉ (spéc. 3, FR-250 a FR-261).
 *
 * Le client scanne une voiturette. Le SERVEUR SEUL traduit le jeton en
 * affectation active, puis en caddie. Aucune donnée ne transite par le QR.
 *
 * Tous les cas d'échec sont nommés : ils déterminent ce que le client voit,
 * et se ressemblent trop pour être traités par un message unique.
 */

export type EchecResolution =
  | "jeton_inconnu"
  | "aucune_affectation"
  | "plusieurs_affectations"
  | "reservation_annulee"
  | "partie_trop_ancienne";

export interface ResolutionReussie {
  ok: true;
  assignmentId: string;
  caddieFirstName: string;
  caddieLastName: string;
  caddieRef: string;
  cartNumber: string;
  golfCourseId: string;
  courseName: string;
  brandColorPrimary: string | null;
  logoPath: string | null;
  googleReviewUrl: string | null;
  priceMad: number;
}

export type Resolution = ResolutionReussie | { ok: false; raison: EchecResolution };

/** Tarif en vigueur : 200 MAD par caddie pour 18 trous (FR-048). */
export const TARIF_CADDIE_MAD = 200;

/**
 * Fenêtre d'acceptation (FR-050). En l'absence de valeur sur le terrain, la
 * limite est la fin de la journée locale — simple à expliquer à un client.
 */
function encoreDansLaFenetre(
  finPartie: Date | null,
  localDate: string,
  timezone: string,
  fenetreHeures: number | null,
  maintenant: Date,
): boolean {
  if (fenetreHeures !== null && finPartie) {
    return maintenant.getTime() - finPartie.getTime() <= fenetreHeures * 3_600_000;
  }
  return localDateFor(maintenant, timezone) === localDate;
}

/**
 * @public-client-path — EXCEPTION ASSUMEE a la regle de portee obligatoire,
 * pour la meme raison que findCartByToken. En contrepartie, cette fonction
 * ne renvoie QUE le prenom et le nom du caddie, le numero de voiturette et
 * l'identite visuelle du terrain. Jamais d'annee de naissance, jamais de
 * note, jamais de jeton — un test le verifie.
 */
export async function resoudreJeton(token: string, maintenant = new Date()): Promise<Resolution> {
  const voiturette = await findCartByToken(token);
  if (!voiturette) return { ok: false, raison: "jeton_inconnu" };

  const lignes = await db
    .select({
      assignmentId: assignment.id,
      status: assignment.status,
      localDate: assignment.localDate,
      endedAt: assignment.endedAt,
      bookingStatus: booking.status,
      caddieFirstName: caddie.firstName,
      caddieLastName: caddie.lastName,
      caddieRef: caddie.internalRef,
      cartNumber: cart.visibleNumber,
      golfCourseId: golfCourse.id,
      courseName: golfCourse.name,
      timezone: golfCourse.timezone,
      brandColorPrimary: golfCourse.brandColorPrimary,
      logoPath: golfCourse.logoPath,
      googleReviewUrl: golfCourse.googleReviewUrl,
      fenetre: golfCourse.evaluationWindowHours,
    })
    .from(assignment)
    .innerJoin(booking, eq(booking.id, assignment.bookingId))
    .innerJoin(cart, eq(cart.id, assignment.cartId))
    .innerJoin(caddie, eq(caddie.id, assignment.caddieId))
    .innerJoin(golfCourse, eq(golfCourse.id, assignment.golfCourseId))
    .where(and(eq(assignment.cartId, voiturette.id)))
    .orderBy(assignment.startedAt);

  // Seules comptent les affectations encore évaluables : active ou terminée
  // aujourd'hui, réservation non annulée.
  const candidates = lignes.filter(
    (l) =>
      l.status !== "cancelled" &&
      l.bookingStatus !== "cancelled" &&
      encoreDansLaFenetre(l.endedAt, l.localDate, l.timezone, l.fenetre, maintenant),
  );

  if (candidates.length === 0) {
    const annulee = lignes.some((l) => l.status === "cancelled" || l.bookingStatus === "cancelled");
    if (lignes.length === 0) return { ok: false, raison: "aucune_affectation" };
    return { ok: false, raison: annulee ? "reservation_annulee" : "partie_trop_ancienne" };
  }

  if (candidates.length > 1) return { ok: false, raison: "plusieurs_affectations" };

  const l = candidates[0]!;
  return {
    ok: true,
    assignmentId: l.assignmentId,
    caddieFirstName: l.caddieFirstName,
    caddieLastName: l.caddieLastName,
    caddieRef: l.caddieRef,
    cartNumber: l.cartNumber,
    golfCourseId: l.golfCourseId,
    courseName: l.courseName,
    brandColorPrimary: l.brandColorPrimary,
    logoPath: l.logoPath,
    googleReviewUrl: l.googleReviewUrl,
    priceMad: TARIF_CADDIE_MAD,
  };
}
