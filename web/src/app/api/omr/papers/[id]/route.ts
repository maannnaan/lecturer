import { omrPaper } from "@/server/omr-api";
import { reply, signedIn } from "../../shared";

/** One final paper, for the app to set up an exam from: every set's key, the answer sheet's layout and the students. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await signedIn(request);
  if ("refusal" in who) return who.refusal;
  const paper = await omrPaper(who.db, who.teacher, (await params).id);
  if (paper === "missing") return reply({ error: "not-found" }, 404);
  if (paper === "notFinal") return reply({ error: "not-final" }, 409);
  return reply(paper);
}
