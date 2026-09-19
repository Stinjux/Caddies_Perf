CREATE TYPE "public"."caddie_availability" AS ENUM('available', 'unavailable');--> statement-breakpoint
CREATE TABLE "wrong_caddie_report" (
	"id" uuid PRIMARY KEY NOT NULL,
	"golf_course_id" uuid NOT NULL,
	"assignment_id" uuid,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "golf_course" ADD COLUMN "evaluation_window_hours" integer;--> statement-breakpoint
ALTER TABLE "caddie" ADD COLUMN "availability" "caddie_availability" DEFAULT 'available' NOT NULL;--> statement-breakpoint
ALTER TABLE "evaluation" ADD COLUMN "price_shown_mad" integer DEFAULT 200 NOT NULL;--> statement-breakpoint
ALTER TABLE "wrong_caddie_report" ADD CONSTRAINT "wrong_caddie_report_golf_course_id_golf_course_id_fk" FOREIGN KEY ("golf_course_id") REFERENCES "public"."golf_course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wrong_caddie_report" ADD CONSTRAINT "fk_wrong_caddie_assignment_same_course" FOREIGN KEY ("golf_course_id","assignment_id") REFERENCES "public"."assignment"("golf_course_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_wrong_caddie_course_date" ON "wrong_caddie_report" USING btree ("golf_course_id","reported_at");