import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { teacherFromBearer } from "@/server/omr-api";
import type { Teacher } from "@/server/teachers";

// Shared by the OMR Scanner app's endpoints under /api/omr. Not a route itself.

/** A JSON answer that no cache keeps: it is one teacher's own data. */
export function reply(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

/** The signed-in teacher behind the request's Bearer token, or the 401 to answer instead. */
export async function signedIn(request: Request): Promise<{ teacher: Teacher; db: Awaited<ReturnType<typeof getDb>> } | { refusal: NextResponse }> {
  const db = await getDb();
  const teacher = await teacherFromBearer(db, request.headers.get("authorization"));
  if (!teacher) return { refusal: reply({ error: "signed-out" }, 401) };
  return { teacher, db };
}
