CREATE TYPE "public"."account_role" AS ENUM('admin', 'starter');--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."booking_source" AS ENUM('csv_import', 'manual');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('scheduled', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."caddie_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."cart_status" AS ENUM('available', 'assigned', 'maintenance', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."course_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."evaluation_criterion" AS ENUM('accueil', 'regles_etiquette', 'connaissance_parcours', 'lecture_verts', 'communication', 'experience_generale');--> statement-breakpoint
CREATE TYPE "public"."evaluation_language" AS ENUM('fr', 'en', 'ar', 'de', 'es');--> statement-breakpoint
CREATE TYPE "public"."price_perception" AS ENUM('beaucoup_trop_bas', 'plutot_bas', 'juste_et_raisonnable', 'plutot_eleve', 'beaucoup_trop_eleve');--> statement-breakpoint
CREATE TABLE "golf_course" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"timezone" text NOT NULL,
	"logo_path" text,
	"brand_color_primary" text,
	"brand_color_secondary" text,
	"google_review_url" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "course_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "account_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "account_golf_course" (
	"account_id" uuid NOT NULL,
	"golf_course_id" uuid NOT NULL,
	"role" "account_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_golf_course_account_id_golf_course_id_pk" PRIMARY KEY("account_id","golf_course_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"account_id" uuid NOT NULL,
	"active_golf_course_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "caddie" (
	"id" uuid PRIMARY KEY NOT NULL,
	"golf_course_id" uuid NOT NULL,
	"internal_ref" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"seniority_years" integer,
	"seniority_recorded_on" date,
	"status" "caddie_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "uq_caddie_course_ref" UNIQUE("golf_course_id","internal_ref"),
	CONSTRAINT "uq_caddie_course_id" UNIQUE("golf_course_id","id"),
	CONSTRAINT "ck_caddie_seniority" CHECK ("caddie"."seniority_years" IS NULL OR "caddie"."seniority_years" >= 0),
	CONSTRAINT "ck_caddie_seniority_dated" CHECK ("caddie"."seniority_years" IS NULL OR "caddie"."seniority_recorded_on" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "caddie_personal_data" (
	"caddie_id" uuid PRIMARY KEY NOT NULL,
	"birth_year" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_birth_year_range" CHECK ("caddie_personal_data"."birth_year" >= 1940 AND "caddie_personal_data"."birth_year" <= EXTRACT(YEAR FROM CURRENT_DATE) - 15)
);
--> statement-breakpoint
CREATE TABLE "cart" (
	"id" uuid PRIMARY KEY NOT NULL,
	"golf_course_id" uuid NOT NULL,
	"visible_number" text NOT NULL,
	"qr_token" text NOT NULL,
	"status" "cart_status" DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "cart_qr_token_unique" UNIQUE("qr_token"),
	CONSTRAINT "uq_cart_course_number" UNIQUE("golf_course_id","visible_number"),
	CONSTRAINT "uq_cart_course_id" UNIQUE("golf_course_id","id")
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY NOT NULL,
	"golf_course_id" uuid NOT NULL,
	"external_ref" text NOT NULL,
	"tee_time" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'scheduled' NOT NULL,
	"source" "booking_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "uq_booking_course_ref" UNIQUE("golf_course_id","external_ref"),
	CONSTRAINT "uq_booking_course_id" UNIQUE("golf_course_id","id")
);
--> statement-breakpoint
CREATE TABLE "assignment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"golf_course_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"cart_id" uuid NOT NULL,
	"caddie_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"status" "assignment_status" DEFAULT 'active' NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"golf_course_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"language" "evaluation_language" NOT NULL,
	"comment" text,
	"course_rating" smallint,
	"value_for_money" smallint,
	"price_perception" "price_perception",
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"comment_purge_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ck_course_rating" CHECK ("evaluation"."course_rating" IS NULL OR "evaluation"."course_rating" BETWEEN 1 AND 5),
	CONSTRAINT "ck_value_money" CHECK ("evaluation"."value_for_money" IS NULL OR "evaluation"."value_for_money" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "evaluation_criterion_answer" (
	"evaluation_id" uuid NOT NULL,
	"criterion" "evaluation_criterion" NOT NULL,
	"rating" smallint,
	CONSTRAINT "evaluation_criterion_answer_evaluation_id_criterion_pk" PRIMARY KEY("evaluation_id","criterion"),
	CONSTRAINT "ck_criterion_rating" CHECK ("evaluation_criterion_answer"."rating" IS NULL OR "evaluation_criterion_answer"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "google_review_click" (
	"id" uuid PRIMARY KEY NOT NULL,
	"golf_course_id" uuid NOT NULL,
	"evaluation_id" uuid,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"golf_course_id" uuid,
	"actor_account_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_golf_course" ADD CONSTRAINT "account_golf_course_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_golf_course" ADD CONSTRAINT "account_golf_course_golf_course_id_golf_course_id_fk" FOREIGN KEY ("golf_course_id") REFERENCES "public"."golf_course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_active_golf_course_id_golf_course_id_fk" FOREIGN KEY ("active_golf_course_id") REFERENCES "public"."golf_course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caddie" ADD CONSTRAINT "caddie_golf_course_id_golf_course_id_fk" FOREIGN KEY ("golf_course_id") REFERENCES "public"."golf_course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caddie_personal_data" ADD CONSTRAINT "caddie_personal_data_caddie_id_caddie_id_fk" FOREIGN KEY ("caddie_id") REFERENCES "public"."caddie"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_golf_course_id_golf_course_id_fk" FOREIGN KEY ("golf_course_id") REFERENCES "public"."golf_course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_golf_course_id_golf_course_id_fk" FOREIGN KEY ("golf_course_id") REFERENCES "public"."golf_course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_golf_course_id_golf_course_id_fk" FOREIGN KEY ("golf_course_id") REFERENCES "public"."golf_course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_created_by_account_id_account_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "fk_assignment_booking_same_course" FOREIGN KEY ("golf_course_id","booking_id") REFERENCES "public"."booking"("golf_course_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "fk_assignment_cart_same_course" FOREIGN KEY ("golf_course_id","cart_id") REFERENCES "public"."cart"("golf_course_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "fk_assignment_caddie_same_course" FOREIGN KEY ("golf_course_id","caddie_id") REFERENCES "public"."caddie"("golf_course_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation" ADD CONSTRAINT "evaluation_golf_course_id_golf_course_id_fk" FOREIGN KEY ("golf_course_id") REFERENCES "public"."golf_course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "uq_assignment_course_id" UNIQUE("golf_course_id","id");--> statement-breakpoint
ALTER TABLE "evaluation" ADD CONSTRAINT "fk_evaluation_assignment_same_course" FOREIGN KEY ("golf_course_id","assignment_id") REFERENCES "public"."assignment"("golf_course_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_criterion_answer" ADD CONSTRAINT "evaluation_criterion_answer_evaluation_id_evaluation_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_review_click" ADD CONSTRAINT "google_review_click_golf_course_id_golf_course_id_fk" FOREIGN KEY ("golf_course_id") REFERENCES "public"."golf_course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_review_click" ADD CONSTRAINT "google_review_click_evaluation_id_evaluation_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_golf_course_id_golf_course_id_fk" FOREIGN KEY ("golf_course_id") REFERENCES "public"."golf_course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_account_id_account_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agc_course_role" ON "account_golf_course" USING btree ("golf_course_id","role");--> statement-breakpoint
CREATE INDEX "idx_session_account" ON "session" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_assignment_caddie_date" ON "assignment" USING btree ("caddie_id","local_date","status");--> statement-breakpoint
CREATE INDEX "idx_assignment_course_date" ON "assignment" USING btree ("golf_course_id","local_date");--> statement-breakpoint
CREATE INDEX "idx_evaluation_course_date" ON "evaluation" USING btree ("golf_course_id","submitted_at");--> statement-breakpoint
CREATE INDEX "idx_evaluation_purge" ON "evaluation" USING btree ("comment_purge_at");--> statement-breakpoint
CREATE INDEX "idx_grc_course_date" ON "google_review_click" USING btree ("golf_course_id","clicked_at");--> statement-breakpoint
CREATE INDEX "idx_audit_course_time" ON "audit_log" USING btree ("golf_course_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_audit_actor_time" ON "audit_log" USING btree ("actor_account_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_audit_action_time" ON "audit_log" USING btree ("action","occurred_at");