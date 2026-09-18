import { pgTable, uuid, text, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { cartStatus } from "./enums";
import { golfCourse } from "./golf-course";

export const cart = pgTable(
  "cart",
  {
    id: uuid("id").primaryKey(),
    golfCourseId: uuid("golf_course_id")
      .notNull()
      .references(() => golfCourse.id),
    visibleNumber: text("visible_number").notNull(),
    /**
     * 32 octets aleatoires en base64url. Opaque et non devinable.
     * Permanent : survit aux changements de statut et d'affectation.
     * Ne contient AUCUNE donnee (FR-031).
     */
    qrToken: text("qr_token").notNull().unique(),
    status: cartStatus("status").notNull().default("available"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique("uq_cart_course_number").on(t.golfCourseId, t.visibleNumber),
    unique("uq_cart_course_id").on(t.golfCourseId, t.id),
  ],
);
