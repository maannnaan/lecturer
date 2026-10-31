"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { handleProblem, normalizeHandle } from "@/lib/handles";
import { normalizePhone } from "@/lib/phone";
import { TEACHER_COOKIE, sessionCookieOptions } from "@/server/auth/cookies";
import { requestIp, requestUserAgent } from "@/server/auth/current";
import { PASSWORD_MIN } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { takeAttempt } from "@/server/rate-limit";
import { TakenError, registerTeacher } from "@/server/teachers";

const FIELDS = ["nameBn", "nameEn", "phone", "email", "handle", "subjects", "institution", "password"] as const;
export type RegisterField = (typeof FIELDS)[number];

export type RegisterState = {
  /** What was typed, so a form with an error comes back filled in (never the password). */
  values: Partial<Record<RegisterField, string>>;
  errors: Partial<Record<RegisterField, string>>;
  formError?: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerTeacherAction(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const e = getDictionary(await getLocale()).errors;
  const raw = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "").trim()])) as Record<
    RegisterField,
    string
  >;
  const values = { ...raw, password: "" };
  const errors: RegisterState["errors"] = {};

  for (const f of ["nameBn", "nameEn", "phone", "handle", "password"] as const) {
    if (!raw[f]) errors[f] = e.required;
  }
  const phone = normalizePhone(raw.phone);
  if (raw.phone && !phone) errors.phone = e.phone;
  const email = raw.email.toLowerCase() || null;
  if (email && !EMAIL.test(email)) errors.email = e.email;
  const handle = normalizeHandle(raw.handle);
  values.handle = handle;
  const problem = raw.handle ? handleProblem(handle) : null;
  if (problem === "length") errors.handle = e.handleLength;
  if (problem === "chars") errors.handle = e.handleChars;
  if (problem === "edge") errors.handle = e.handleEdge;
  if (problem === "reserved") errors.handle = e.handleReserved;
  if (raw.password && raw.password.length < PASSWORD_MIN) errors.password = e.passwordShort;
  if (Object.keys(errors).length > 0 || !phone) return { values, errors };

  const db = await getDb();
  if (!(await takeAttempt(db, `register:${await requestIp()}`, 5, 3600))) {
    return { values, errors, formError: e.tooMany };
  }

  let teacherId: string;
  try {
    const teacher = await registerTeacher(db, {
      nameBn: raw.nameBn,
      nameEn: raw.nameEn,
      phone,
      email,
      handle,
      subjects: raw.subjects,
      institution: raw.institution,
      password: raw.password,
    });
    teacherId = teacher.id;
  } catch (err) {
    if (err instanceof TakenError) {
      const message = { handle: e.handleTaken, phone: e.phoneTaken, email: e.emailTaken }[err.field];
      return { values, errors: { [err.field]: message } };
    }
    console.error("[register]", err);
    return { values, errors, formError: e.generic };
  }

  const token = await createSession(db, { kind: "teacher", teacherId }, await requestUserAgent());
  (await cookies()).set(TEACHER_COOKIE, token, sessionCookieOptions());
  redirect("/dashboard");
}
