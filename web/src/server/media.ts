import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/server/db";
import { media } from "@/server/db/schema";
import { isUuid } from "@/lib/ids";
import { MAX_IMAGE_BYTES, sniffImage, storageMode, storeImage } from "./storage";

export type Media = typeof media.$inferSelect;
export type SaveImageResult =
  | { ok: true; id: string; url: string }
  | { ok: false; reason: "size" | "type" | "unavailable" };

/** Checks, stores and records one image for a teacher. */
export async function saveImage(db: Database, teacherId: string, bytes: Uint8Array): Promise<SaveImageResult> {
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return { ok: false, reason: "size" };
  const type = sniffImage(bytes);
  if (!type) return { ok: false, reason: "type" };
  if (!storageMode()) return { ok: false, reason: "unavailable" };
  const id = randomUUID();
  const stored = await storeImage(teacherId, id, bytes, type);
  await db.insert(media).values({ id, teacherId, ...stored, contentType: type, bytes: bytes.length });
  return { ok: true, id, url: stored.url };
}

/** One of this teacher's own images; another teacher's image id isn't found. */
export async function getMedia(db: Database, teacherId: string, mediaId: string): Promise<Media | null> {
  if (!isUuid(mediaId)) return null;
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, mediaId), eq(media.teacherId, teacherId)))
    .limit(1);
  return row ?? null;
}
