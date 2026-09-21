import { pgTable, uuid, text, jsonb, timestamp, integer } from "drizzle-orm/pg-core";
import { courseStatus } from "./enums";

export const golfCourse = pgTable("golf_course", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  /** Identifiant IANA, ex. "Africa/Casablanca" (FR-005). */
  timezone: text("timezone").notNull(),
  /**
   * QR UNIQUE DU PARCOURS, affiche au depart. Opaque et permanent : il ne
   * contient ni nom, ni reservation, ni donnee personnelle. Le client le
   * scanne puis choisit son caddie dans la liste.
   */
  qrToken: text("qr_token").notNull(),
  logoPath: text("logo_path"),
  brandColorPrimary: text("brand_color_primary"),
  brandColorSecondary: text("brand_color_secondary"),
  googleReviewUrl: text("google_review_url"),
  /**
   * Duree, en heures apres la fin d'une partie, pendant laquelle le QR code
   * accepte encore une evaluation (FR-050). NULL signifie « jusqu'a la fin
   * de la journee locale du parcours ».
   */
  evaluationWindowHours: integer("evaluation_window_hours"),
  settings: jsonb("settings").notNull().default({}),
  status: courseStatus("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
});
