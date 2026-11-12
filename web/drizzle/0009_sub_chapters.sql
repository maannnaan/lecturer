CREATE TABLE "bank_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"chapter_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_chapters" ADD COLUMN "topic_counter" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "topic_id" uuid;--> statement-breakpoint
ALTER TABLE "bank_topics" ADD CONSTRAINT "bank_topics_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_topics" ADD CONSTRAINT "bank_topics_chapter_id_bank_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."bank_chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_topics_chapter_number_key" ON "bank_topics" USING btree ("chapter_id","number");--> statement-breakpoint
CREATE INDEX "bank_topics_chapter_position_idx" ON "bank_topics" USING btree ("chapter_id","position");--> statement-breakpoint
CREATE INDEX "bank_topics_teacher_idx" ON "bank_topics" USING btree ("teacher_id");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_topic_id_bank_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."bank_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "questions_topic_idx" ON "questions" USING btree ("topic_id");