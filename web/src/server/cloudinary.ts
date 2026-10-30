import { createHash } from "node:crypto";

// Parameters Cloudinary sends with an upload but never signs.
const UNSIGNED = new Set(["file", "cloud_name", "resource_type", "api_key"]);

/**
 * Cloudinary's upload signature: the signed parameters sorted by name and joined as
 * `name=value&…`, followed directly by the API secret, then SHA-1 in hex.
 */
export function cloudinarySignature(params: Record<string, string | number>, apiSecret: string): string {
  const payload = Object.keys(params)
    .filter((name) => !UNSIGNED.has(name) && params[name] !== "")
    .sort()
    .map((name) => `${name}=${params[name]}`)
    .join("&");
  return createHash("sha1").update(payload + apiSecret).digest("hex");
}

export type UploadTicket = {
  cloudName: string;
  apiKey: string;
  folder: string;
  timestamp: number;
  signature: string;
};

/**
 * What the browser needs to upload one image straight to Cloudinary, into this teacher's own
 * folder. Null while uploads aren't configured (no CLOUDINARY_* variables).
 */
export function uploadTicket(teacherId: string, now = Date.now()): UploadTicket | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  const params = { folder: `lecturer/${teacherId}`, timestamp: Math.floor(now / 1000) };
  return { cloudName, apiKey, ...params, signature: cloudinarySignature(params, apiSecret) };
}
