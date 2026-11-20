import type { NextRequest } from "next/server";
import { omrPaperList } from "@/server/omr-api";
import { reply, signedIn } from "../shared";

/** The signed-in teacher's final papers that have MCQs, for the app's question-bank search: `?q=` narrows them. */
export async function GET(request: NextRequest) {
  const who = await signedIn(request);
  if ("refusal" in who) return who.refusal;
  return reply(await omrPaperList(who.db, who.teacher, request.nextUrl.searchParams.get("q") ?? ""));
}
