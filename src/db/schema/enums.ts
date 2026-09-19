import { pgEnum } from "drizzle-orm/pg-core";

/** Statuts et enumerations du domaine — voir specs/001-socle-comptes-terrains/data-model.md */

export const courseStatus = pgEnum("course_status", ["active", "archived"]);
export const accountStatus = pgEnum("account_status", ["active", "disabled"]);
export const accountRole = pgEnum("account_role", ["admin", "starter"]);
export const caddieStatus = pgEnum("caddie_status", ["active", "disabled"]);

/**
 * Disponibilite OPERATIONNELLE, distincte du statut de cycle de vie.
 * « Parti dejeuner » n'est ni actif ni desactive : le Starter doit pouvoir
 * le signaler sans toucher au cycle de vie du caddie.
 */
export const caddieAvailability = pgEnum("caddie_availability", [
  "available",
  "unavailable",
]);
export const cartStatus = pgEnum("cart_status", [
  "available",
  "assigned",
  "maintenance",
  "inactive",
]);
export const bookingStatus = pgEnum("booking_status", ["scheduled", "cancelled", "completed"]);
export const bookingSource = pgEnum("booking_source", ["csv_import", "manual"]);
export const assignmentStatus = pgEnum("assignment_status", ["active", "completed", "cancelled"]);
export const evaluationLanguage = pgEnum("evaluation_language", ["fr", "en", "ar", "de", "es"]);

/** Les cinq premiers forment les competences ; experience_generale est distinct. */
export const evaluationCriterion = pgEnum("evaluation_criterion", [
  "accueil",
  "regles_etiquette",
  "connaissance_parcours",
  "lecture_verts",
  "communication",
  "experience_generale",
]);

export const pricePerception = pgEnum("price_perception", [
  "beaucoup_trop_bas",
  "plutot_bas",
  "juste_et_raisonnable",
  "plutot_eleve",
  "beaucoup_trop_eleve",
]);
