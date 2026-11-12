import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@/server/db";
import { media } from "@/server/db/schema";
import { isUuid } from "@/lib/ids";
import { type RichDoc, type RichText, richImageIds, withImageUrls } from "@/lib/rich-text";
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

/**
 * The stored file of each of these uploads (media id → URL), once every one is found to be this
 * teacher's. Null when one isn't: someone else's picture, or a made-up id.
 */
export async function ownImageUrls(db: Database, teacherId: string, mediaIds: string[]): Promise<Map<string, string> | null> {
  const ids = [...new Set(mediaIds)];
  if (ids.length === 0) return new Map();
  if (!ids.every((id) => isUuid(id))) return null;
  const rows = await db
    .select({ id: media.id, url: media.url })
    .from(media)
    .where(and(eq(media.teacherId, teacherId), inArray(media.id, ids)));
  return rows.length === ids.length ? new Map(rows.map((row) => [row.id, row.url])) : null;
}

/**
 * Rich text ready to store: every picture in it checked to be the teacher's own upload, and
 * pointed at its stored file (whatever `src` came in with the form is ignored). False when a
 * picture isn't the teacher's.
 */
export async function withOwnImages(db: Database, teacherId: string, value: RichText): Promise<RichText | false> {
  const urls = await ownImageUrls(db, teacherId, richImageIds(value));
  return urls ? withImageUrls(value, urls) : false;
}

/** The same for a website text's document, which may be absent (null stays null). */
export async function docWithOwnImages(db: Database, teacherId: string, doc: RichDoc | null | undefined): Promise<RichDoc | null | false> {
  if (!doc) return null;
  const checked = await withOwnImages(db, teacherId, doc);
  return checked === false ? false : (checked as RichDoc);
}
