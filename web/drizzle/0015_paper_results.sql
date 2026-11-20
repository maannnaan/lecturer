CREATE TYPE "public"."paper_result_source" AS ENUM('manual', 'scanner');--> statement-breakpoint
CREATE TABLE "paper_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"paper_id" uuid NOT NULL,
	"roll" text NOT NULL,
	"set_code" integer NOT NULL,
	"marks" text DEFAULT '' NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"wrong" integer DEFAULT 0 NOT NULL,
	"blank" integer DEFAULT 0 NOT NULL,
	"doubled" integer DEFAULT 0 NOT NULL,
	"score_hundredths" integer DEFAULT 0 NOT NULL,
	"written_hundredths" integer,
	"source" "paper_result_source" DEFAULT 'manual' NOT NULL,
	"scanned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "papers" ADD COLUMN "results_published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "paper_results" ADD CONSTRAINT "paper_results_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_results" ADD CONSTRAINT "paper_results_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "paper_results_paper_roll_key" ON "paper_results" USING btree ("paper_id","roll");--> statement-breakpoint
CREATE INDEX "paper_results_teacher_idx" ON "paper_results" USING btree ("teacher_id");