"use server";

import { refresh } from "next/cache";
import type { FormState } from "@/components/form";
import { parseNotice } from "@/lib/courses";
import { formInput } from "@/lib/form-input";
import { requireTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { createNotice, deleteNotice, updateNotice } from "@/server/notices";
import { errorTexts, refused } from "../form-state";

const saved: FormState = { ok: true, errors: {} };

export async function createNoticeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { notice, errors } = parseNotice(input);
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  await createNotice(await getDb(), teacher.id, notice);
  refresh();
  return saved;
}

export async function updateNoticeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { notice, errors } = parseNotice(input);
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  const updated = await updateNotice(await getDb(), teacher.id, String(input.noticeId ?? ""), notice);
  if (!updated) return { errors: {}, formError: (await errorTexts()).generic };
  refresh();
  return saved;
}

export async function deleteNoticeAction(formData: FormData) {
  const teacher = await requireTeacher();
  await deleteNotice(await getDb(), teacher.id, String(formData.get("noticeId") ?? ""));
  refresh();
}
