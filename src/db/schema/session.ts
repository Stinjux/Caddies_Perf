import { pgTable, uuid, text, timestamp, index, boolean } from "drizzle-orm/pg-core";
import { account } from "./account";
import { golfCourse } from "./golf-course";

export const session = pgTable(
  "session",
  {
    id: uuid("id").primaryKey(),
    /** Seul le hache du jeton est stocke ; le jeton en clair ne vit que dans le cookie. */
    tokenHash: text("token_hash").notNull().unique(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id),
    /** NULL tant qu'aucun terrain n'a ete choisi (FR-012). */
    activeGolfCourseId: uuid("active_golf_course_id").references(() => golfCourse.id),
    /**
     * SECOND FACTEUR EN ATTENTE. Le mot de passe a ete verifie, le code ne
     * l'est pas encore. Une session dans cet etat n'authentifie RIEN :
     * resolveSession la refuse. Elle existe pour que le deuxieme ecran sache
     * de qui il parle, sans faire transiter l'identifiant du compte par
     * l'adresse ou un champ cache, ou il serait modifiable.
     */
    mfaPending: boolean("mfa_pending").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_session_account").on(t.accountId)],
);
