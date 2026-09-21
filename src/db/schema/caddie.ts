import { pgTable, uuid, text, integer, date, timestamp, unique, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { caddieStatus, caddieAvailability } from "./enums";
import { golfCourse } from "./golf-course";

/**
 * Identite professionnelle d'un caddie.
 *
 * PRINCIPE I — AUCUNE colonne pour la taille d'habits, l'adresse du domicile,
 * l'age ou la force. Le schema est structurellement incapable de les recevoir
 * (FR-028, FR-028b). L'annee de naissance vit dans caddie_personal_data.
 */
export const caddie = pgTable(
  "caddie",
  {
    id: uuid("id").primaryKey(),
    golfCourseId: uuid("golf_course_id")
      .notNull()
      .references(() => golfCourse.id),
    /** Unique au parcours, jamais reattribue, meme apres desactivation (FR-041). */
    internalRef: text("internal_ref").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    /** Nombre entier d'annees, tel que fourni a l'import (FR-041b). */
    seniorityYears: integer("seniority_years"),
    /** Date de saisie de l'anciennete : sans elle, la valeur devient illisible. */
    seniorityRecordedOn: date("seniority_recorded_on"),
    /** Cycle de vie : un caddie desactive conserve son historique (FR-042). */
    status: caddieStatus("status").notNull().default("active"),
    /** Disponibilite du moment, signalee par le Starter (FR-049). */
    availability: caddieAvailability("availability").notNull().default("available"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique("uq_caddie_course_ref").on(t.golfCourseId, t.internalRef),
    /** Cible des cles etrangeres composites venant de assignment (FR-026). */
    unique("uq_caddie_course_id").on(t.golfCourseId, t.id),
    check("ck_caddie_seniority", sql`${t.seniorityYears} IS NULL OR ${t.seniorityYears} >= 0`),
    check(
      "ck_caddie_seniority_dated",
      sql`${t.seniorityYears} IS NULL OR ${t.seniorityRecordedOn} IS NOT NULL`,
    ),
  ],
);
