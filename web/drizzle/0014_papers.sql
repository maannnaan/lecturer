CREATE TYPE "public"."paper_section" AS ENUM('mcq', 'written');--> statement-breakpoint
CREATE TYPE "public"."paper_status" AS ENUM('draft', 'final');--> statement-breakpoint
CREATE TABLE "paper_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" uuid NOT NULL,
	"question_id" uuid,
	"section" "paper_section" NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"snapshot" jsonb
);
--> statement-breakpoint
CREATE TABLE "papers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"batch_id" uuid,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"header" jsonb NOT NULL,
	"set_count" integer DEFAULT 1 NOT NULL,
	"first_set" integer DEFAULT 101 NOT NULL,
	"seed" integer NOT NULL,
	"shuffle_questions" boolean DEFAULT true NOT NULL,
	"shuffle_options" boolean DEFAULT false NOT NULL,
	"mark_hundredths" integer DEFAULT 100 NOT NULL,
	"negative_hundredths" integer DEFAULT 0 NOT NULL,
	"status" "paper_status" DEFAULT 'draft' NOT NULL,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN "paper_counter" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "paper_questions" ADD CONSTRAINT "paper_questions_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_questions" ADD CONSTRAINT "paper_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "papers" ADD CONSTRAINT "papers_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "papers" ADD CONSTRAINT "papers_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "papers" ADD CONSTRAINT "papers_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paper_questions_paper_idx" ON "paper_questions" USING btree ("paper_id","section","position");--> statement-breakpoint
CREATE UNIQUE INDEX "paper_questions_paper_question_key" ON "paper_questions" USING btree ("paper_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "papers_teacher_number_key" ON "papers" USING btree ("teacher_id","number");--> statement-breakpoint
CREATE INDEX "papers_course_idx" ON "papers" USING btree ("course_id");