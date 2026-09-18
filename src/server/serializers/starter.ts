/**
 * PROJECTIONS DESTINEES AU STARTER (principe I, FR-019, FR-020).
 *
 * LISTE BLANCHE, jamais liste noire. Une liste noire oublie le champ ajoute
 * demain ; une liste blanche ignore par construction tout ce qui n'a pas ete
 * explicitement autorise.
 *
 * Le contrat exact figure dans specs/001-socle-comptes-terrains/contracts/.
 */

export interface StarterCaddieView {
  id: string;
  internalRef: string;
  firstName: string;
  lastName: string;
  available: boolean;
}

export interface StarterCartView {
  id: string;
  visibleNumber: string;
  status: "available" | "assigned" | "maintenance" | "inactive";
}

export interface StarterBookingView {
  id: string;
  externalRef: string;
  teeTime: Date;
}

export interface StarterAssignmentView {
  id: string;
  bookingRef: string;
  teeTime: Date;
  cartNumber: string;
  caddieRef: string;
  caddieName: string;
  status: "active" | "completed" | "cancelled";
}

/** Champs autorises, un par vue. Sert aussi de reference aux tests. */
export const STARTER_ALLOWED_FIELDS = {
  caddie: ["id", "internalRef", "firstName", "lastName", "available"],
  cart: ["id", "visibleNumber", "status"],
  booking: ["id", "externalRef", "teeTime"],
  assignment: ["id", "bookingRef", "teeTime", "cartNumber", "caddieRef", "caddieName", "status"],
} as const;

/**
 * Champs qui ne doivent JAMAIS atteindre un Starter, sous aucune forme.
 * Cette liste est celle que les tests de bout en bout recherchent dans le
 * trafic reseau reel.
 */
export const STARTER_FORBIDDEN_FIELDS = [
  "birthYear",
  "birth_year",
  "passwordHash",
  "password_hash",
  "qrToken",
  "qr_token",
  "comment",
  "rating",
  "courseRating",
  "valueForMoney",
  "pricePerception",
  "seniorityYears",
] as const;

export function toStarterCaddie(row: {
  id: string;
  internalRef: string;
  firstName: string;
  lastName: string;
  status: string;
}): StarterCaddieView {
  return {
    id: row.id,
    internalRef: row.internalRef,
    firstName: row.firstName,
    lastName: row.lastName,
    available: row.status === "active",
  };
}

export function toStarterCart(row: {
  id: string;
  visibleNumber: string;
  status: StarterCartView["status"];
}): StarterCartView {
  return { id: row.id, visibleNumber: row.visibleNumber, status: row.status };
}

export function toStarterBooking(row: {
  id: string;
  externalRef: string;
  teeTime: Date;
}): StarterBookingView {
  return { id: row.id, externalRef: row.externalRef, teeTime: row.teeTime };
}
