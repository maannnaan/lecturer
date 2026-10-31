"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isTheme } from "@/lib/themes";
import { TEACHER_COOKIE } from "@/server/auth/cookies";
import { requireTeacher } from "@/server/auth/current";
import { revokeSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { setTeacherTheme } from "@/server/teachers";

/** The signed-in teacher picks the theme for their website, students' pages and dashboard. */
export async function setThemeAction(formData: FormData) {
  const teacher = await requireTeacher();
  const theme = formData.get("theme");
  if (!isTheme(theme)) return;
  await setTeacherTheme(await getDb(), teacher.id, theme);
  refresh();
}

export async function logoutAction() {
  const store = await cookies();
  const token = store.get(TEACHER_COOKIE)?.value;
  if (token) await revokeSession(await getDb(), token);
  store.delete(TEACHER_COOKIE);
  redirect("/login");
}
