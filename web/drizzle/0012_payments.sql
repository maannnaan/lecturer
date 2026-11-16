CREATE TYPE "public"."payment_kind" AS ENUM('monthly', 'one_time', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'bkash', 'nagad', 'rocket', 'bank', 'other', 'bkash_gateway');--> statement-breakpoint
CREATE TYPE "public"."payment_recorder" AS ENUM('teacher', 'student');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'verified', 'rejected', 'failed');--> statement-breakpoint
CREATE TABLE "payment_months" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"month" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"enrollment_id" uuid,
	"kind" "payment_kind" DEFAULT 'monthly' NOT NULL,
	"amount" integer NOT NULL,
	"method" "payment_method" DEFAULT 'cash' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"txn_id" text DEFAULT '' NOT NULL,
	"sender_number" text DEFAULT '' NOT NULL,
	"gateway_payment_id" text DEFAULT '' NOT NULL,
	"receipt_no" integer,
	"note" text DEFAULT '' NOT NULL,
	"recorded_by" "payment_recorder" DEFAULT 'teacher' NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN "receipt_counter" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN "payment_info" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_months" ADD CONSTRAINT "payment_months_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_months" ADD CONSTRAINT "payment_months_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_months_enrollment_month_key" ON "payment_months" USING btree ("enrollment_id","month");--> statement-breakpoint
CREATE INDEX "payment_months_payment_idx" ON "payment_months" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payments_teacher_status_idx" ON "payments" USING btree ("teacher_id","status","paid_at");--> statement-breakpoint
CREATE INDEX "payments_student_idx" ON "payments" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_teacher_txn_key" ON "payments" USING btree ("teacher_id","method","txn_id") WHERE "payments"."txn_id" <> '' and "payments"."status" in ('pending', 'verified');--> statement-breakpoint
CREATE UNIQUE INDEX "payments_teacher_receipt_key" ON "payments" USING btree ("teacher_id","receipt_no") WHERE "payments"."receipt_no" is not null;