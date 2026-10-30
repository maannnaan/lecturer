import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/server/db";
import { findAdminById, type Admin } from "@/server/admins";
import { findStudent, type Student } from "@/server/students";
import { findTeacherById, type Teacher } from "@/server/teachers";
import { ADMIN_COOKIE, TEACHER_COOKIE, studentCookie } from "./cookies";
import { validateSession } from "./session";

// Each lookup runs once per request, however many components ask for it. Each starts with
// `connection()`: checking a session compares its expiry with the clock, which Next refuses to do
// while prerendering, so a signed-in view is only ever rendered for a real request.

export const getCurrentTeacher = cache(async (): Promise<Teacher | null> => {
  await connection();
  const token = (await cookies()).get(TEACHER_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const session = await validateSession(db, token, { kind: "teacher" });
  return session?.teacherId ? findTeacherById(db, session.teacherId) : null;
});

export const getCurrentAdmin = cache(async (): Promise<Admin | null> => {
  await connection();
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const session = await validateSession(db, token, { kind: "admin" });
  return session?.adminId ? findAdminById(db, session.adminId) : null;
});

/** The student signed in to this teacher's site. A session from another teacher's site never counts. */
export const getCurrentStudent = cache(async (teacherId: string): Promise<Student | null> => {
  await connection();
  const token = (await cookies()).get(studentCookie(teacherId))?.value;
  if (!token) return null;
  const db = await getDb();
  const session = await validateSession(db, token, { kind: "student", teacherId });
  return session?.studentId ? findStudent(db, teacherId, session.studentId) : null;
});

export async function requireTeacher(): Promise<Teacher> {
  const teacher = await getCurrentTeacher();
  if (!teacher) redirect("/login");
  return teacher;
}

export async function requireAdmin(): Promise<Admin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function requestUserAgent(): Promise<string> {
  return (await headers()).get("user-agent") ?? "";
}

/** The visitor's address as the hosting proxy reports it; used only to key sign-in throttling. */
export async function requestIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
