CREATE TYPE "public"."gateway_mode" AS ENUM('sandbox', 'live');--> statement-breakpoint
CREATE TABLE "teacher_gateways" (
	"teacher_id" uuid PRIMARY KEY NOT NULL,
	"mode" "gateway_mode" DEFAULT 'sandbox' NOT NULL,
	"username" text NOT NULL,
	"app_key" text NOT NULL,
	"password_sealed" text NOT NULL,
	"app_secret_sealed" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"id_token_sealed" text,
	"token_expires_at" timestamp with time zone,
	"refresh_token_sealed" text,
	"refresh_expires_at" timestamp with time zone,
	"token_calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "gateway_state" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_gateways" ADD CONSTRAINT "teacher_gateways_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;