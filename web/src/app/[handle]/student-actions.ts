"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { type FieldErrors, formInput } from "@/lib/form-input";
import { isUuid } from "@/lib/ids";
import { normalizePhone } from "@/lib/phone";
import { parseJoin, parsePassword } from "@/lib/students";
import { sessionCookieOptions, studentCookie } from "@/server/auth/cookies";
import { getCurrentStudent, requestIp, requestUserAgent } from "@/server/auth/current";
import { verifyDecoy, verifyPassword } from "@/server/auth/password";
import { createSession, revokeSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { requestEnrollment } from "@/server/enrollments";
import { clearAttempts, takeAttempt } from "@/server/rate-limit";
import { StudentPhoneTaken, createStudent, findStudentForLogin, setStudentPassword, studentPasswordHash } from "@/server/students";
import { resolveHandle } from "@/server/teachers";
import { errorTexts, refused } from "../dashboard/form-state";

// A student's account lives on one teacher's website. Each action finds that teacher from the
// page's own address (the `handle` field), never from an id the browser sends, and a student is
// only ever looked up among that teacher's students.

/** The teacher whose live website these forms are on, or null: students join approved sites only. */
async function siteTeacher(handle: string | undefined) {
  const site = await resolveHandle(await getDb(), (handle ?? "").toLowerCase());
  return site && site.current && site.teacher.status === "approved" ? site.teacher : null;
}

/** Where to go after signing in: a page of this teacher's site that was asked for, else the student's own page. */
function landing(handle: string, next: string | undefined): string {
  return next && next.startsWith(`/${handle}/`) && !next.includes("//") ? next : `/${handle}/me`;
}

async function signIn(teacherId: string, studentId: string) {
  const token = await createSession(await getDb(), { kind: "student", teacherId, studentId }, await requestUserAgent());
  (await cookies()).set(studentCookie(teacherId), token, sessionCookieOptions());
}

/** Opens a student's account on the teacher's site and signs them in. */
export async function joinAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const input = formInput(formData);
  // The password is never sent back to the form.
  const typed = { ...input, password: "" };
  const e = await errorTexts();
  const teacher = await siteTeacher(input.handle);
  if (!teacher) return { errors: {}, formError: e.generic, values: typed as Record<string, string> };

  const { student, password, errors } = parseJoin(input);
  const refusal = await refused(errors, typed);
  if (refusal) return refusal;

  const db = await getDb();
  if (!(await takeAttempt(db, `student-join:${await requestIp()}`, 10, 3600))) {
    return { errors: {}, formError: e.tooMany, values: typed as Record<string, string> };
  }
  let studentId: string;
  try {
    studentId = (await createStudent(db, { ...student, teacherId: teacher.id, password, source: "online" })).id;
  } catch (error) {
    if (error instanceof StudentPhoneTaken) return (await refused({ phone: "phoneTaken" }, typed))!;
    throw error;
  }
  await signIn(teacher.id, studentId);
  redirect(landing(teacher.handle, input.next));
}

/** Signs a student in to the teacher's site. Says the same thing whichever of the number or password was wrong. */
export async function loginStudentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const input = formInput(formData);
  const values = { phone: input.phone ?? "" };
  const e = await errorTexts();
  const teacher = await siteTeacher(input.handle);
  if (!teacher) return { errors: {}, formError: e.generic, values };
  const password = input.password ?? "";
  if (!values.phone.trim() || !password) return { errors: {}, formError: e.required, values };

  const db = await getDb();
  const ip = await requestIp();
  const phone = normalizePhone(values.phone) ?? values.phone.trim();
  const perAccount = `student-login:${teacher.id}:${ip}:${phone}`;
  const allowed = (await takeAttempt(db, perAccount, 10, 900)) && (await takeAttempt(db, `student-login:${ip}`, 100, 900));
  if (!allowed) return { errors: {}, formError: e.tooMany, values };

  const student = await findStudentForLogin(db, teacher.id, phone);
  const ok = student?.passwordHash ? await verifyPassword(student.passwordHash, password) : await verifyDecoy(password);
  if (!student || !ok) return { errors: {}, formError: e.badStudentLogin, values };
  if (student.status !== "active") return { errors: {}, formError: (await siteText(teacher.locale)).inactive, values };

  await clearAttempts(db, perAccount);
  await signIn(teacher.id, student.id);
  redirect(landing(teacher.handle, input.next));
}

/** The student-facing sentences, in the visitor's language (the site's own by default). */
async function siteText(fallback: "bn" | "en") {
  return getDictionary(await getLocale(fallback)).site.student;
}

export async function logoutStudentAction(formData: FormData) {
  const teacher = await siteTeacher(String(formData.get("handle") ?? ""));
  if (!teacher) redirect("/");
  const jar = await cookies();
  const name = studentCookie(teacher.id);
  const token = jar.get(name)?.value;
  if (token) await revokeSession(await getDb(), token);
  jar.delete(name);
  redirect(`/${teacher.handle}`);
}

/** The signed-in student asks to join a course (a free one lets them straight in). */
export async function applyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const input = formInput(formData);
  const e = await errorTexts();
  const teacher = await siteTeacher(input.handle);
  if (!teacher) return { errors: {}, formError: e.generic };
  const student = await getCurrentStudent(teacher.id);
  if (!student) redirect(`/${teacher.handle}/login`);
  const courseId = input.courseId ?? "";
  if (!isUuid(courseId)) return { errors: {}, formError: e.generic };

  const result = await requestEnrollment(await getDb(), teacher.id, student.id, courseId, {
    batchId: input.batchId || null,
    note: (input.note ?? "").trim(),
  });
  if (!result.ok) return { errors: {}, formError: e.generic };
  refresh();
  return { ok: true, errors: {} };
}

/** The signed-in student changes their own password, proving the current one first. */
export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const input = formInput(formData);
  const e = await errorTexts();
  const teacher = await siteTeacher(input.handle);
  if (!teacher) return { errors: {}, formError: e.generic };
  const student = await getCurrentStudent(teacher.id);
  if (!student) redirect(`/${teacher.handle}/login`);

  const errors: FieldErrors = {};
  const password = parsePassword(input, errors, "newPassword");
  const refusal = await refused(errors, {});
  if (refusal) return refusal;

  const db = await getDb();
  const hash = await studentPasswordHash(db, teacher.id, student.id);
  const matches = hash ? await verifyPassword(hash, input.currentPassword ?? "") : false;
  if (!matches) return { errors: { currentPassword: e.wrongPassword } };
  // This browser stays signed in; any other is signed out.
  await setStudentPassword(db, teacher.id, student.id, password, { keepSessions: true });
  return { ok: true, errors: {} };
}
