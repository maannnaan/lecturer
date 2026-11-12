"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { parseNotice } from "@/lib/courses";
import { formInput } from "@/lib/form-input";
import { requireTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { docWithOwnImages } from "@/server/media";
import { createNotice, deleteNotice, updateNotice } from "@/server/notices";
import { errorTexts, refused } from "../form-state";

const saved: FormState = { ok: true, errors: {} };

export async function createNoticeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { notice, errors } = parseNotice(input);
  const db = await getDb();
  // Pictures in the text must be the teacher's own uploads.
  const bodyRich = await docWithOwnImages(db, teacher.id, notice.bodyRich);
  if (bodyRich === false) errors.body = "invalid";
  const refusal = await refused(errors, input);
  if (refusal || bodyRich === false) return refusal!;
  await createNotice(db, teacher.id, { ...notice, bodyRich });
  refresh();
  // A new object each time: the form counts publications to start afresh after each.
  return { ...saved };
}

export async function updateNoticeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { notice, errors } = parseNotice(input);
  const db = await getDb();
  const bodyRich = await docWithOwnImages(db, teacher.id, notice.bodyRich);
  if (bodyRich === false) errors.body = "invalid";
  const refusal = await refused(errors, input);
  if (refusal || bodyRich === false) return refusal!;
  const updated = await updateNotice(db, teacher.id, String(input.noticeId ?? ""), { ...notice, bodyRich });
  if (!updated) return { errors: {}, formError: (await errorTexts()).generic };
  refresh();
  return saved;
}

export async function deleteNoticeAction(formData: FormData) {
  const teacher = await requireTeacher();
  await deleteNotice(await getDb(), teacher.id, String(formData.get("noticeId") ?? ""));
  refresh();
}
