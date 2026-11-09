CREATE TYPE "public"."question_type" AS ENUM('mcq', 'mcq_multi', 'short', 'creative', 'problem');--> statement-breakpoint
CREATE TYPE "public"."question_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"chapter_id" uuid,
	"type" "question_type" NOT NULL,
	"visibility" "question_visibility" DEFAULT 'public' NOT NULL,
	"body" jsonb NOT NULL,
	"board" text DEFAULT '' NOT NULL,
	"year" integer,
	"source" text DEFAULT '' NOT NULL,
	"video_url" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "questions_teacher_course_chapter_idx" ON "questions" USING btree ("teacher_id","course_id","chapter_id","position");--> statement-breakpoint
CREATE INDEX "questions_teacher_type_idx" ON "questions" USING btree ("teacher_id","type");--> statement-breakpoint
CREATE INDEX "questions_chapter_visibility_idx" ON "questions" USING btree ("chapter_id","visibility");