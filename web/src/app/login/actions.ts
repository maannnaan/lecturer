"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { normalizePhone } from "@/lib/phone";
import { TEACHER_COOKIE, sessionCookieOptions } from "@/server/auth/cookies";
import { requestIp, requestUserAgent } from "@/server/auth/current";
import { verifyDecoy, verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { clearAttempts, takeAttempt } from "@/server/rate-limit";
import { findTeacherForLogin } from "@/server/teachers";

export type LoginState = { identifier: string; error?: string };

export async function loginTeacherAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const e = getDictionary(await getLocale()).errors;
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) return { identifier, error: e.required };

  const db = await getDb();
  const ip = await requestIp();
  const account = normalizePhone(identifier) ?? identifier.toLowerCase();
  // Ten tries per account from one address, a hundred from one address in all, per 15 minutes.
  const perAccount = `teacher-login:${ip}:${account}`;
  const allowed =
    (await takeAttempt(db, perAccount, 10, 900)) && (await takeAttempt(db, `teacher-login:${ip}`, 100, 900));
  if (!allowed) return { identifier, error: e.tooMany };

  const teacher = await findTeacherForLogin(db, identifier);
  const ok = teacher ? await verifyPassword(teacher.passwordHash, password) : await verifyDecoy(password);
  if (!teacher || !ok) return { identifier, error: e.badLogin };

  await clearAttempts(db, perAccount);
  const token = await createSession(db, { kind: "teacher", teacherId: teacher.id }, await requestUserAgent());
  (await cookies()).set(TEACHER_COOKIE, token, sessionCookieOptions());
  redirect("/dashboard");
}
