import { NextResponse } from "next/server";
import { getCurrentTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { saveImage } from "@/server/media";
import { MAX_IMAGE_BYTES } from "@/server/storage";

/**
 * Upload one image for the signed-in teacher. The browser has already shrunk it; here it is
 * checked again (size, real file type from its bytes) before it is stored and recorded.
 */
export async function POST(request: Request) {
  // A cookie-authenticated upload must come from our own pages, not another site's form.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const teacher = await getCurrentTeacher();
  if (!teacher) return NextResponse.json({ error: "signed-out" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "type" }, { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "size" }, { status: 413 });

  const result = await saveImage(await getDb(), teacher.id, new Uint8Array(await file.arrayBuffer()));
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.reason === "unavailable" ? 503 : 400 });
  }
  return NextResponse.json({ id: result.id, url: result.url });
}
