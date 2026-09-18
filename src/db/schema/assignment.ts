import {
  pgTable,
  uuid,
  date,
  timestamp,
  integer,
  foreignKey,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { assignmentStatus } from "./enums";
import { golfCourse } from "./golf-course";
import { booking } from "./booking";
import { cart } from "./cart";
import { caddie } from "./caddie";
import { account } from "./account";

/**
 * Pivot du produit : relie terrain, reservation, voiturette et caddie.
 *
 * PRINCIPE IV — les cles etrangeres COMPOSITES (golf_course_id, id)
 * rendent structurellement impossible qu'une affectation relie une
 * reservation du terrain A a un caddie du terrain B : PostgreSQL
 * refuse l'ecriture (FR-026).
 */
export const assignment = pgTable(
  "assignment",
  {
    id: uuid("id").primaryKey(),
    golfCourseId: uuid("golf_course_id")
      .notNull()
      .references(() => golfCourse.id),
    bookingId: uuid("booking_id").notNull(),
    cartId: uuid("cart_id").notNull(),
    caddieId: uuid("caddie_id").notNull(),
    /** Date locale du terrain, figee a la creation. Cle du decompte des jours travailles (FR-044). */
    localDate: date("local_date").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    status: assignmentStatus("status").notNull().default("active"),
    createdByAccountId: uuid("created_by_account_id")
      .notNull()
      .references(() => account.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    foreignKey({
      columns: [t.golfCourseId, t.bookingId],
      foreignColumns: [booking.golfCourseId, booking.id],
      name: "fk_assignment_booking_same_course",
    }),
    foreignKey({
      columns: [t.golfCourseId, t.cartId],
      foreignColumns: [cart.golfCourseId, cart.id],
      name: "fk_assignment_cart_same_course",
    }),
    foreignKey({
      columns: [t.golfCourseId, t.caddieId],
      foreignColumns: [caddie.golfCourseId, caddie.id],
      name: "fk_assignment_caddie_same_course",
    }),
    /** Cible de la cle etrangere composite venant de evaluation (FR-026). */
    unique("uq_assignment_course_id").on(t.golfCourseId, t.id),
    /** Sert le decompte des jours travailles : dates distinctes par caddie. */
    index("idx_assignment_caddie_date").on(t.caddieId, t.localDate, t.status),
    index("idx_assignment_course_date").on(t.golfCourseId, t.localDate),
  ],
);
