import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { account } from "./account";
import { golfCourse } from "./golf-course";

/**
 * Journal en ECRITURE SEULE (FR-038).
 *
 * Les droits UPDATE et DELETE sont retires a l'utilisateur applicatif au
 * niveau de PostgreSQL par une migration dediee. L'exigence reste donc vraie
 * meme si le code applicatif est bogue ou compromis.
 *
 * AUCUNE colonne de contenu (FR-037) : ni valeur avant/apres, ni nom, ni
 * commentaire. Uniquement des identifiants internes.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey(),
    golfCourseId: uuid("golf_course_id").references(() => golfCourse.id),
    actorAccountId: uuid("actor_account_id")
      .notNull()
      .references(() => account.id),
    /** ex. "course.update", "pii.read", "account.disable" */
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_audit_course_time").on(t.golfCourseId, t.occurredAt),
    index("idx_audit_actor_time").on(t.actorAccountId, t.occurredAt),
    index("idx_audit_action_time").on(t.action, t.occurredAt),
  ],
);
