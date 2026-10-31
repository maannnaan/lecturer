import { readFile } from "node:fs/promises";
import { connection } from "next/server";
import { localUploadPath } from "@/server/storage";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/**
 * Serves images stored in the local uploads folder (development, or LOCAL_UPLOADS=1). In
 * production uploads live on Cloudinary and never come through here. Each file name is a fresh
 * id, so a file never changes and can be cached for good.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  await connection();
  const parts = (await params).path;
  const file = parts.length === 2 ? localUploadPath(parts[0], parts[1]) : null;
  if (!file) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(file);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": TYPES[file.split(".").pop() ?? ""] ?? "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
