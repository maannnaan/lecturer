-- Hand-written (drizzle-kit would drop and recreate the enum, which fails on rows saying 'problem').
-- Numerical problems become textbook problems; 'practice' is the new kind of problem.
ALTER TYPE "public"."question_type" RENAME VALUE 'problem' TO 'textbook';--> statement-breakpoint
ALTER TYPE "public"."question_type" ADD VALUE 'practice';--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "grade" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "subject" text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Courses so far had only a free-text level ("এইচএসসি", "Class 8"): read the class from it, or
-- from the title. Anything unclear stays 'other' for the teacher to set in the course form.
UPDATE "courses" SET "grade" = CASE
  WHEN ("level" || ' ' || "title") ~* '(এইচএসসি|hsc|একাদশ|দ্বাদশ|আলিম|class\s*1[12])' THEN 'hsc'
  WHEN ("level" || ' ' || "title") ~* '(এসএসসি|ssc|নবম|দশম|দাখিল|class\s*(9|10))' THEN 'ssc'
  WHEN ("level" || ' ' || "title") ~* '(অষ্টম|৮ম|class\s*8)' THEN 'class-8'
  WHEN ("level" || ' ' || "title") ~* '(সপ্তম|৭ম|class\s*7)' THEN 'class-7'
  WHEN ("level" || ' ' || "title") ~* '(ষষ্ঠ|৬ষ্ঠ|class\s*6)' THEN 'class-6'
  WHEN ("level" || ' ' || "title") ~* '(ভর্তি|admission)' THEN 'admission'
  ELSE 'other'
END;
