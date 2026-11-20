import { NextResponse } from "next/server";
import { revokeSession } from "@/server/auth/session";
import { getDb } from "@/server/db";

/** The app signs out: its session ends here too, so the token is no use to anyone afterwards. */
export async function POST(request: Request) {
  const match = /^Bearer\s+([A-Za-z0-9_-]{16,200})$/.exec((request.headers.get("authorization") ?? "").trim());
  if (match) await revokeSession(await getDb(), match[1]);
  return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
}
