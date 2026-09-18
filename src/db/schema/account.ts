import { pgTable, uuid, text, timestamp, integer, primaryKey, index } from "drizzle-orm/pg-core";
import { accountStatus, accountRole } from "./enums";
import { golfCourse } from "./golf-course";

export const account = pgTable("account", {
  id: uuid("id").primaryKey(),
  /** Unique sur toute la plateforme (FR-011). Type citext : insensible a la casse. */
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  /** scrypt. N'est jamais renvoye par une lecture (FR-017). */
  passwordHash: text("password_hash").notNull(),
  status: accountStatus("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
});

/**
 * Le role est porte par le rattachement, non par le compte : une meme personne
 * peut etre administrateur sur un terrain et Starter sur un autre.
 */
export const accountGolfCourse = pgTable(
  "account_golf_course",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id),
    golfCourseId: uuid("golf_course_id")
      .notNull()
      .references(() => golfCourse.id),
    role: accountRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.golfCourseId] }),
    index("idx_agc_course_role").on(t.golfCourseId, t.role),
  ],
);
