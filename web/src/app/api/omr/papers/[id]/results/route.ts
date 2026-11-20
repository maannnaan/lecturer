import { omrUpload } from "@/server/omr-api";
import { reply, signedIn } from "../../../shared";

/**
 * Answer sheets the app scanned, for one final paper: `{ sheets: [{ roll, setCode, marks, scannedAt }] }`.
 * Each is marked here against its own set's key; the answer says, sheet by sheet, whose it was and
 * what it scored, or why it was refused.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await signedIn(request);
  if ("refusal" in who) return who.refusal;
  const body = await request.json().catch(() => null);
  const result = await omrUpload(who.db, who.teacher, (await params).id, body);
  if (result === "missing") return reply({ error: "not-found" }, 404);
  if (result === "notFinal") return reply({ error: "not-final" }, 409);
  if (result === "invalid") return reply({ error: "invalid" }, 400);
  return reply(result);
}
