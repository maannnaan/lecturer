CREATE TYPE "public"."chapter_status" AS ENUM('upcoming', 'ongoing', 'done');--> statement-breakpoint
CREATE TYPE "public"."course_access" AS ENUM('free', 'approval', 'paid');--> statement-breakpoint
CREATE TYPE "public"."media_storage" AS ENUM('cloudinary', 'local');--> statement-breakpoint
CREATE TYPE "public"."price_period" AS ENUM('one_time', 'monthly');--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"status" "chapter_status" DEFAULT 'upcoming' NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"level" text DEFAULT '' NOT NULL,
	"session" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT 'book-open' NOT NULL,
	"cover" integer DEFAULT 1 NOT NULL,
	"access" "course_access" DEFAULT 'approval' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"price_period" "price_period" DEFAULT 'monthly' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"chapter_counter" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"storage" "media_storage" NOT NULL,
	"key" text NOT NULL,
	"url" text NOT NULL,
	"content_type" text NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN "course_counter" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chapters_course_number_key" ON "chapters" USING btree ("course_id","number");--> statement-breakpoint
CREATE INDEX "chapters_course_position_idx" ON "chapters" USING btree ("course_id","position");--> statement-breakpoint
CREATE INDEX "chapters_teacher_idx" ON "chapters" USING btree ("teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_teacher_number_key" ON "courses" USING btree ("teacher_id","number");--> statement-breakpoint
CREATE INDEX "courses_teacher_position_idx" ON "courses" USING btree ("teacher_id","position");--> statement-breakpoint
CREATE INDEX "media_teacher_idx" ON "media" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "notices_teacher_published_idx" ON "notices" USING btree ("teacher_id","published_at");