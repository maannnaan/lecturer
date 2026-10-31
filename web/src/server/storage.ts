import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { cloudinarySignature } from "./cloudinary";

export type ImageType = "image/jpeg" | "image/png" | "image/webp";
export const IMAGE_EXTENSION: Record<ImageType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** The browser shrinks photos before sending them, so anything near this is a mistake or abuse. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** What an upload really is, read from its first bytes rather than trusting the browser's label. */
export function sniffImage(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export type StorageMode = "cloudinary" | "local";

/**
 * Where uploads go: Cloudinary once its three settings exist; otherwise a folder on this machine,
 * but only in development or when LOCAL_UPLOADS=1 (a server's own disk doesn't survive deploys).
 * Null means uploads are off.
 */
export function storageMode(): StorageMode | null {
  const env = process.env;
  if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) return "cloudinary";
  if (env.LOCAL_UPLOADS === "1" || env.NODE_ENV === "development") return "local";
  return null;
}

// The local folder is for development only, so the build mustn't trace (and ship) what's in it:
// hence the turbopackIgnore comments on the paths built from it below.
export function uploadsDir(): string {
  return process.env.UPLOADS_DIR ?? path.join(process.cwd(), ".data", "uploads");
}

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FILE_NAME = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png|webp)$/;

/** The file behind /media/<teacherId>/<file>, or null for any path that isn't one we wrote. */
export function localUploadPath(teacherId: string, fileName: string): string | null {
  if (!ID.test(teacherId) || !FILE_NAME.test(fileName)) return null;
  return path.join(/*turbopackIgnore: true*/ uploadsDir(), teacherId, fileName);
}

export type StoredImage = { storage: StorageMode; key: string; url: string };

/** Saves an already checked image under the teacher's own folder, wherever uploads are going. */
export async function storeImage(
  teacherId: string,
  mediaId: string,
  bytes: Uint8Array,
  type: ImageType,
): Promise<StoredImage> {
  const mode = storageMode();
  if (mode === "local") {
    const fileName = `${mediaId}.${IMAGE_EXTENSION[type]}`;
    const dir = path.join(/*turbopackIgnore: true*/ uploadsDir(), teacherId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(/*turbopackIgnore: true*/ dir, fileName), bytes);
    return { storage: "local", key: `${teacherId}/${fileName}`, url: `/media/${teacherId}/${fileName}` };
  }
  if (mode === "cloudinary") {
    const env = process.env as Record<string, string>;
    const params = { folder: `lecturer/${teacherId}`, public_id: mediaId, timestamp: Math.floor(Date.now() / 1000) };
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(bytes)], { type }));
    for (const [name, value] of Object.entries(params)) form.set(name, String(value));
    form.set("api_key", env.CLOUDINARY_API_KEY);
    form.set("signature", cloudinarySignature(params, env.CLOUDINARY_API_SECRET));
    const res = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(`Cloudinary refused the upload (${res.status})`);
    const saved = (await res.json()) as { public_id: string; secure_url: string };
    return { storage: "cloudinary", key: saved.public_id, url: saved.secure_url };
  }
  throw new Error("Image uploads are not set up");
}
