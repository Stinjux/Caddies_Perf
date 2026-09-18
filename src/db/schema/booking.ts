import { pgTable, uuid, text, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { bookingStatus, bookingSource } from "./enums";
import { golfCourse } from "./golf-course";

export const booking = pgTable(
  "booking",
  {
    id: uuid("id").primaryKey(),
    golfCourseId: uuid("golf_course_id")
      .notNull()
      .references(() => golfCourse.id),
    /** Numero de reservation du systeme existant du terrain. */
    externalRef: text("external_ref").notNull(),
    teeTime: timestamp("tee_time", { withTimezone: true }).notNull(),
    status: bookingStatus("status").notNull().default("scheduled"),
    source: bookingSource("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique("uq_booking_course_ref").on(t.golfCourseId, t.externalRef),
    unique("uq_booking_course_id").on(t.golfCourseId, t.id),
  ],
);
