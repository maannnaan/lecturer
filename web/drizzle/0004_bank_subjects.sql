-- The question bank gets its own subjects and chapters; courses are only what the website
-- advertises. Hand-ordered: the generated version added questions.subject_id as NOT NULL before
-- there was anything to fill it with.
CREATE TABLE "bank_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"grade" text DEFAULT 'other' NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"chapter_counter" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_chapters" ADD CONSTRAINT "bank_chapters_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_chapters" ADD CONSTRAINT "bank_chapters_subject_id_bank_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."bank_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_subjects" ADD CONSTRAINT "bank_subjects_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_chapters_subject_number_key" ON "bank_chapters" USING btree ("subject_id","number");--> statement-breakpoint
CREATE INDEX "bank_chapters_subject_position_idx" ON "bank_chapters" USING btree ("subject_id","position");--> statement-breakpoint
CREATE INDEX "bank_chapters_teacher_idx" ON "bank_chapters" USING btree ("teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_subjects_teacher_number_key" ON "bank_subjects" USING btree ("teacher_id","number");--> statement-breakpoint
CREATE INDEX "bank_subjects_teacher_position_idx" ON "bank_subjects" USING btree ("teacher_id","position");--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN "subject_counter" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Questions leave their courses: deleting a course must no longer delete its questions.
ALTER TABLE "questions" DROP CONSTRAINT "questions_course_id_courses_id_fk";--> statement-breakpoint
ALTER TABLE "questions" DROP CONSTRAINT "questions_chapter_id_chapters_id_fk";--> statement-breakpoint
DROP INDEX "questions_teacher_course_chapter_idx";--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "course_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "subject_id" uuid;--> statement-breakpoint
-- Each course that has questions becomes a bank subject with the same id, named by its subject
-- (or title) and in its class; its chapters become the subject's chapters, also keeping their
-- ids. So every question's course and chapter ids are already its subject and chapter ids.
INSERT INTO "bank_subjects" ("id", "teacher_id", "number", "grade", "name", "position", "chapter_counter", "created_at")
SELECT
  c."id",
  c."teacher_id",
  (row_number() OVER (PARTITION BY c."teacher_id" ORDER BY c."position", c."number"))::int,
  c."grade",
  coalesce(nullif(c."subject", ''), c."title"),
  (row_number() OVER (PARTITION BY c."teacher_id" ORDER BY c."position", c."number"))::int - 1,
  c."chapter_counter",
  c."created_at"
FROM "courses" c
WHERE EXISTS (SELECT 1 FROM "questions" q WHERE q."course_id" = c."id");--> statement-breakpoint
UPDATE "teachers" t SET "subject_counter" = s."n"
FROM (SELECT "teacher_id", count(*)::int AS "n" FROM "bank_subjects" GROUP BY "teacher_id") s
WHERE s."teacher_id" = t."id";--> statement-breakpoint
INSERT INTO "bank_chapters" ("id", "teacher_id", "subject_id", "number", "label", "title", "position", "created_at")
SELECT ch."id", ch."teacher_id", ch."course_id", ch."number", ch."label", ch."title", ch."position", ch."created_at"
FROM "chapters" ch
WHERE ch."course_id" IN (SELECT "id" FROM "bank_subjects");--> statement-breakpoint
UPDATE "questions" SET "subject_id" = "course_id";--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "subject_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_subject_id_bank_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."bank_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_chapter_id_bank_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."bank_chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "questions_teacher_subject_chapter_idx" ON "questions" USING btree ("teacher_id","subject_id","chapter_id","position");
