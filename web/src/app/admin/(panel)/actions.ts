"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "@/server/auth/cookies";
import { requireAdmin } from "@/server/auth/current";
import { revokeSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { type TeacherStatus, setTeacherStatus } from "@/server/teachers";

const OUTCOME: Record<string, TeacherStatus> = {
  approve: "approved",
  reinstate: "approved",
  reject: "rejected",
  suspend: "suspended",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Approve, reject, suspend or reinstate one teacher. Admins only, checked here, not just in the UI. */
export async function decideTeacherAction(formData: FormData) {
  await requireAdmin();
  const teacherId = String(formData.get("teacherId") ?? "");
  const status = OUTCOME[String(formData.get("decision") ?? "")];
  if (!status || !UUID.test(teacherId)) return;
  await setTeacherStatus(await getDb(), teacherId, status, String(formData.get("note") ?? ""));
  refresh();
}

export async function adminLogoutAction() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (token) await revokeSession(await getDb(), token);
  store.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
