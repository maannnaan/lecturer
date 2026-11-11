-- Teachers name their own classes now (দশম শ্রেণি, এইচএসসি ২০২৬ ব্যাচ…) instead of picking them from
-- a fixed list. Hand-ordered: each class gets an id, a number (its website address) and a name
-- before those are required, then each subject the id of its class. The classes made so far keep
-- their fixed-list key in "grade", so old website addresses such as /bank/hsc still find them.
ALTER TABLE "teachers" ADD COLUMN "class_counter" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_classes" DROP CONSTRAINT "bank_classes_teacher_id_grade_pk";--> statement-breakpoint
ALTER TABLE "bank_classes" ALTER COLUMN "grade" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_classes" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_classes" ADD COLUMN "number" integer;--> statement-breakpoint
ALTER TABLE "bank_classes" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "bank_classes" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- A subject whose class has no row yet (made by an older deployment while 0006 went live) gets one.
INSERT INTO "bank_classes" ("teacher_id", "grade", "created_at")
SELECT s."teacher_id", s."grade", min(s."created_at") FROM "bank_subjects" s
WHERE NOT EXISTS (SELECT 1 FROM "bank_classes" c WHERE c."teacher_id" = s."teacher_id" AND c."grade" = s."grade")
GROUP BY s."teacher_id", s."grade";--> statement-breakpoint
-- The classes so far are numbered in the old list's order and named as the list called them, in
-- the language the teacher's website opens in.
UPDATE "bank_classes" c SET
  "number" = o."n",
  "position" = o."n" - 1,
  "name" = CASE WHEN t."locale" = 'en' THEN
    CASE c."grade" WHEN 'class-6' THEN 'Class 6' WHEN 'class-7' THEN 'Class 7' WHEN 'class-8' THEN 'Class 8'
      WHEN 'ssc' THEN 'SSC' WHEN 'hsc' THEN 'HSC' WHEN 'admission' THEN 'Admission tests' ELSE 'Other' END
  ELSE
    CASE c."grade" WHEN 'class-6' THEN 'ষষ্ঠ শ্রেণি' WHEN 'class-7' THEN 'সপ্তম শ্রেণি' WHEN 'class-8' THEN 'অষ্টম শ্রেণি'
      WHEN 'ssc' THEN 'এসএসসি' WHEN 'hsc' THEN 'এইচএসসি' WHEN 'admission' THEN 'ভর্তি পরীক্ষা' ELSE 'অন্যান্য' END
  END
FROM (
  SELECT "id", (row_number() OVER (
    PARTITION BY "teacher_id"
    ORDER BY array_position(ARRAY['class-6', 'class-7', 'class-8', 'ssc', 'hsc', 'admission', 'other']::text[], "grade") NULLS LAST, "grade"
  ))::int AS "n"
  FROM "bank_classes"
) o, "teachers" t
WHERE o."id" = c."id" AND t."id" = c."teacher_id";--> statement-breakpoint
ALTER TABLE "bank_classes" ALTER COLUMN "number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_classes" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
UPDATE "teachers" t SET "class_counter" = c."n"
FROM (SELECT "teacher_id", max("number") AS "n" FROM "bank_classes" GROUP BY "teacher_id") c
WHERE c."teacher_id" = t."id";--> statement-breakpoint
CREATE UNIQUE INDEX "bank_classes_teacher_number_key" ON "bank_classes" USING btree ("teacher_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_classes_teacher_grade_key" ON "bank_classes" USING btree ("teacher_id","grade");--> statement-breakpoint
-- Each subject belongs to the class its old key became.
ALTER TABLE "bank_subjects" ADD COLUMN "class_id" uuid;--> statement-breakpoint
UPDATE "bank_subjects" s SET "class_id" = c."id"
FROM "bank_classes" c
WHERE c."teacher_id" = s."teacher_id" AND c."grade" = s."grade";--> statement-breakpoint
ALTER TABLE "bank_subjects" ALTER COLUMN "class_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_subjects" ADD CONSTRAINT "bank_subjects_class_id_bank_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."bank_classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_subjects_class_idx" ON "bank_subjects" USING btree ("class_id");
