import { pgTable, uuid, integer, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { caddie } from "./caddie";

/**
 * RENSEIGNEMENTS PERSONNELS — ACCES RESTREINT (principe I, FR-029, FR-030).
 *
 * Fichier deliberement separe de caddie.ts pour rendre la frontiere visible
 * en revue de code. Une seule colonne de donnee : l'annee de naissance.
 *
 * Cette table n'est lue QUE par src/server/pii/. Aucune requete de liste,
 * aucune jointure generale ne la traverse. Chaque acces est journalise.
 */
export const caddiePersonalData = pgTable(
  "caddie_personal_data",
  {
    caddieId: uuid("caddie_id")
      .primaryKey()
      .references(() => caddie.id),
    birthYear: integer("birth_year").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "ck_birth_year_range",
      sql`${t.birthYear} >= 1940 AND ${t.birthYear} <= EXTRACT(YEAR FROM CURRENT_DATE) - 15`,
    ),
  ],
);
