CREATE TABLE "bank_classes" (
	"teacher_id" uuid NOT NULL,
	"grade" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_classes_teacher_id_grade_pk" PRIMARY KEY("teacher_id","grade")
);
--> statement-breakpoint
ALTER TABLE "bank_classes" ADD CONSTRAINT "bank_classes_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- The bank's classes were the classes its subjects are in: those stay, added when their first subject was.
INSERT INTO "bank_classes" ("teacher_id", "grade", "created_at")
SELECT "teacher_id", "grade", min("created_at") FROM "bank_subjects" GROUP BY "teacher_id", "grade";
