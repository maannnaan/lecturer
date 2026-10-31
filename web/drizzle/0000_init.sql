CREATE TYPE "public"."locale_name" AS ENUM('bn', 'en');--> statement-breakpoint
CREATE TYPE "public"."session_kind" AS ENUM('admin', 'teacher', 'student');--> statement-breakpoint
CREATE TYPE "public"."teacher_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."theme_name" AS ENUM('ink', 'mist', 'sage');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handles" (
	"handle" text PRIMARY KEY NOT NULL,
	"teacher_id" uuid NOT NULL,
	"current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "session_kind" NOT NULL,
	"admin_id" uuid,
	"teacher_id" uuid,
	"student_id" uuid,
	"user_agent" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_owner_matches_kind" CHECK (("sessions"."kind" = 'admin' and "sessions"."admin_id" is not null and "sessions"."teacher_id" is null and "sessions"."student_id" is null)
        or ("sessions"."kind" = 'teacher' and "sessions"."teacher_id" is not null and "sessions"."admin_id" is null and "sessions"."student_id" is null)
        or ("sessions"."kind" = 'student' and "sessions"."student_id" is not null and "sessions"."teacher_id" is not null and "sessions"."admin_id" is null))
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" text NOT NULL,
	"name_bn" text NOT NULL,
	"name_en" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"password_hash" text NOT NULL,
	"status" "teacher_status" DEFAULT 'pending' NOT NULL,
	"status_note" text DEFAULT '' NOT NULL,
	"subjects" text DEFAULT '' NOT NULL,
	"institution" text DEFAULT '' NOT NULL,
	"theme" "theme_name" DEFAULT 'ink' NOT NULL,
	"locale" "locale_name" DEFAULT 'bn' NOT NULL,
	"site" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"approved_at" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "handles" ADD CONSTRAINT "handles_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admins_email_key" ON "admins" USING btree ("email");--> statement-breakpoint
CREATE INDEX "handles_teacher_idx" ON "handles" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "sessions_admin_idx" ON "sessions" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "sessions_teacher_idx" ON "sessions" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "sessions_student_idx" ON "sessions" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "students_teacher_phone_key" ON "students" USING btree ("teacher_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "teachers_handle_key" ON "teachers" USING btree ("handle");--> statement-breakpoint
CREATE UNIQUE INDEX "teachers_phone_key" ON "teachers" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "teachers_email_key" ON "teachers" USING btree ("email") WHERE "teachers"."email" is not null;--> statement-breakpoint
CREATE INDEX "teachers_status_created_idx" ON "teachers" USING btree ("status","created_at");