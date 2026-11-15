ALTER TYPE "public"."question_visibility" ADD VALUE 'enrolled';--> statement-breakpoint
-- Columns the code stopped reading a release ago (0010): no running deployment selects them now.
ALTER TABLE "bank_subjects" DROP COLUMN IF EXISTS "grade";--> statement-breakpoint
ALTER TABLE "courses" DROP COLUMN IF EXISTS "level";--> statement-breakpoint
ALTER TABLE "courses" DROP COLUMN IF EXISTS "subject";--> statement-breakpoint
ALTER TABLE "questions" DROP COLUMN IF EXISTS "course_id";
