"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { findAdminForLogin } from "@/server/admins";
import { ADMIN_COOKIE, sessionCookieOptions } from "@/server/auth/cookies";
import { requestIp, requestUserAgent } from "@/server/auth/current";
import { verifyDecoy, verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { clearAttempts, takeAttempt } from "@/server/rate-limit";

export type AdminLoginState = { email: string; error?: string };

export async function adminLoginAction(_prev: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const e = getDictionary(await getLocale()).errors;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { email, error: e.required };

  const db = await getDb();
  const key = `admin-login:${await requestIp()}`;
  if (!(await takeAttempt(db, key, 10, 900))) return { email, error: e.tooMany };

  const admin = await findAdminForLogin(db, email);
  const ok = admin ? await verifyPassword(admin.passwordHash, password) : await verifyDecoy(password);
  if (!admin || !ok) return { email, error: e.badAdminLogin };

  await clearAttempts(db, key);
  const token = await createSession(db, { kind: "admin", adminId: admin.id }, await requestUserAgent());
  (await cookies()).set(ADMIN_COOKIE, token, sessionCookieOptions());
  redirect("/admin");
}
