import { normalizePhone } from "@/lib/phone";
import { requestIp } from "@/server/auth/current";
import { verifyDecoy, verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { clearAttempts, takeAttempt } from "@/server/rate-limit";
import { findTeacherForLogin } from "@/server/teachers";
import { reply } from "../shared";

/**
 * The OMR Scanner app signs in with the teacher's own mobile number (or email) and password:
 * `{ identifier, password }`. It gets a session token to send as `Authorization: Bearer <token>`,
 * and lasts like a website session. Throttled like the website's sign-in, and a wrong number and
 * a wrong password are refused alike.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { identifier?: unknown; password?: unknown } | null;
  const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!identifier || !password) return reply({ error: "missing" }, 400);

  const db = await getDb();
  const ip = await requestIp();
  const account = normalizePhone(identifier) ?? identifier.toLowerCase();
  // Ten tries per account from one address, a hundred from one address in all, per 15 minutes.
  const perAccount = `omr-login:${ip}:${account}`;
  const allowed = (await takeAttempt(db, perAccount, 10, 900)) && (await takeAttempt(db, `omr-login:${ip}`, 100, 900));
  if (!allowed) return reply({ error: "too-many" }, 429);

  const teacher = await findTeacherForLogin(db, identifier);
  const ok = teacher ? await verifyPassword(teacher.passwordHash, password) : await verifyDecoy(password);
  if (!teacher || !ok) return reply({ error: "bad-login" }, 401);

  await clearAttempts(db, perAccount);
  const token = await createSession(db, { kind: "teacher", teacherId: teacher.id }, `OMR Scanner · ${request.headers.get("user-agent") ?? ""}`);
  return reply({ token, teacher: { name: teacher.nameEn || teacher.nameBn, nameBn: teacher.nameBn, handle: teacher.handle } });
}
