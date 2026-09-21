import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
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
  /**
   * DEUXIEME NIVEAU D'ADMINISTRATION.
   *
   * Un administrateur general a la portee « admin » sur TOUS les parcours,
   * y compris ceux crees apres lui. Cela ne peut pas se representer par des
   * rattachements : il en faudrait un par parcours, et le parcours de demain
   * naitrait hors de sa portee.
   *
   * Le cloisonnement reste entier — il demeure, a chaque instant, dans la
   * portee d'UN SEUL parcours. Le privilege porte sur le choix, pas sur la
   * simultaneite.
   */
  generalAdmin: boolean("general_admin").notNull().default(false),
  /**
   * SECOND FACTEUR (TOTP). Le secret n'est JAMAIS selectionne par les depots
   * publics : comme passwordHash, il vit hors de PUBLIC_COLUMNS.
   * Nul tant que le compte n'a pas termine son inscription.
   */
  totpSecret: text("totp_secret"),
  totpEnrolledAt: timestamp("totp_enrolled_at", { withTimezone: true }),
  /**
   * Codes de secours, HACHES comme un mot de passe. Un code consomme est
   * retire du tableau : sans cela, un papier photographie resterait valable
   * indefiniment.
   */
  recoveryCodes: text("recovery_codes").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
});

/**
 * Le role ORDINAIRE est porte par le rattachement, non par le compte : une
 * meme personne peut etre administrateur sur un parcours et Starter sur un
 * autre. Seul le niveau general (account.generalAdmin) echappe a cette regle,
 * precisement parce qu'il ne vise aucun parcours en particulier.
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
