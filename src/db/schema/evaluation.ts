import {
  pgTable,
  uuid,
  text,
  smallint,
  timestamp,
  primaryKey,
  index,
  check,
  foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { evaluationLanguage, evaluationCriterion, pricePerception } from "./enums";
import { golfCourse } from "./golf-course";
import { assignment } from "./assignment";

/**
 * Evaluation ANONYME (FR-032).
 * Aucune colonne identifiant le joueur : ni nom, ni courriel, ni adresse IP,
 * ni empreinte de navigateur.
 *
 * SEPARATION DES MESURES (FR-043) : course_rating appartient au terrain,
 * value_for_money et price_perception a la perception du prix. Aucune
 * n'entre dans le score du caddie, calcule uniquement depuis les criteres.
 */
export const evaluation = pgTable(
  "evaluation",
  {
    id: uuid("id").primaryKey(),
    golfCourseId: uuid("golf_course_id")
      .notNull()
      .references(() => golfCourse.id),
    assignmentId: uuid("assignment_id").notNull(),
    language: evaluationLanguage("language").notNull(),
    comment: text("comment"),
    courseRating: smallint("course_rating"),
    valueForMoney: smallint("value_for_money"),
    pricePerception: pricePerception("price_perception"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    /** Echeance de purge du commentaire seul : la note chiffree subsiste (FR-034c). */
    commentPurgeAt: timestamp("comment_purge_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.golfCourseId, t.assignmentId],
      foreignColumns: [assignment.golfCourseId, assignment.id],
      name: "fk_evaluation_assignment_same_course",
    }),
    check("ck_course_rating", sql`${t.courseRating} IS NULL OR ${t.courseRating} BETWEEN 1 AND 5`),
    check("ck_value_money", sql`${t.valueForMoney} IS NULL OR ${t.valueForMoney} BETWEEN 1 AND 5`),
    index("idx_evaluation_course_date").on(t.golfCourseId, t.submittedAt),
    index("idx_evaluation_purge").on(t.commentPurgeAt),
  ],
);

/**
 * Reponse par critere. rating NULL signifie "non applicable" : exclue des
 * moyennes, elle ne les abaisse JAMAIS.
 */
export const evaluationCriterionAnswer = pgTable(
  "evaluation_criterion_answer",
  {
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => evaluation.id),
    criterion: evaluationCriterion("criterion").notNull(),
    rating: smallint("rating"),
  },
  (t) => [
    primaryKey({ columns: [t.evaluationId, t.criterion] }),
    check("ck_criterion_rating", sql`${t.rating} IS NULL OR ${t.rating} BETWEEN 1 AND 5`),
  ],
);

/** Mesure le clic, jamais la publication d'un avis. Aucune donnee identifiante. */
export const googleReviewClick = pgTable(
  "google_review_click",
  {
    id: uuid("id").primaryKey(),
    golfCourseId: uuid("golf_course_id")
      .notNull()
      .references(() => golfCourse.id),
    evaluationId: uuid("evaluation_id").references(() => evaluation.id),
    clickedAt: timestamp("clicked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_grc_course_date").on(t.golfCourseId, t.clickedAt)],
);
