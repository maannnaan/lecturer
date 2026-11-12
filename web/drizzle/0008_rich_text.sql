-- Course descriptions and notices as the rich text editor writes them (src/lib/rich-text.ts).
-- The plain text columns stay: older rows' only copy, and what previews and page descriptions use.
ALTER TABLE "courses" ADD COLUMN "description_rich" jsonb;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN "body_rich" jsonb;
