"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { formInput, type Input } from "@/lib/form-input";
import { parseQuestion } from "@/lib/questions";
import { requireTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import {
  type SaveQuestionResult,
  createQuestion,
  deleteQuestion,
  duplicateQuestion,
  getQuestion,
  moveQuestion,
  updateQuestion,
} from "@/server/questions";
import { errorTexts, refused } from "../form-state";

// Each action re-reads the session and passes the teacher's own id down: the data layer then
// refuses a course, chapter, image or question that belongs to someone else.

const saved: FormState = { ok: true, errors: {} };

/** What was typed, so a refused form comes back as the teacher left it. */
const keep = (input: Input) => Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v ?? ""]));

async function placementRefusal(reason: Exclude<SaveQuestionResult, { ok: true }>["reason"], input: Input): Promise<FormState> {
  const e = await errorTexts();
  if (reason === "missing") return { errors: {}, formError: e.generic, values: keep(input) };
  const field = reason === "image" ? "imageId" : reason === "course" ? "courseId" : "chapterId";
  return { errors: { [field]: e.invalid }, values: keep(input) };
}

/** Where the bank list shows the question's own chapter. */
function bankHref(courseId: string, chapterId: string | null) {
  const query = new URLSearchParams({ course: courseId });
  if (chapterId) query.set("chapter", chapterId);
  return `/dashboard/bank?${query}`;
}

export async function createQuestionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { question, errors } = parseQuestion(input);
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  const result = await createQuestion(await getDb(), teacher.id, question);
  if (!result.ok) return placementRefusal(result.reason, input);

  if (formData.get("next") === "another") {
    const query = new URLSearchParams({ type: question.type, course: question.courseId, added: result.question.id });
    if (question.chapterId) query.set("chapter", question.chapterId);
    redirect(`/dashboard/bank/new?${query}`);
  }
  redirect(bankHref(question.courseId, question.chapterId));
}

export async function updateQuestionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { question, errors } = parseQuestion(input);
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  const result = await updateQuestion(await getDb(), teacher.id, String(input.questionId ?? ""), question);
  if (!result.ok) return placementRefusal(result.reason, input);
  refresh();
  return saved;
}

export async function deleteQuestionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  if (formData.get("confirm") !== "on") return { errors: { confirm: (await errorTexts()).confirmDelete } };
  const db = await getDb();
  const id = String(formData.get("questionId") ?? "");
  const question = await getQuestion(db, teacher.id, id);
  if (question) await deleteQuestion(db, teacher.id, id);
  redirect(question ? bankHref(question.courseId, question.chapterId) : "/dashboard/bank");
}

export async function duplicateQuestionAction(formData: FormData) {
  const teacher = await requireTeacher();
  const copy = await duplicateQuestion(await getDb(), teacher.id, String(formData.get("questionId") ?? ""));
  redirect(copy ? `/dashboard/bank/${copy.id}` : "/dashboard/bank");
}

export async function moveQuestionAction(formData: FormData) {
  const teacher = await requireTeacher();
  const direction = formData.get("direction") === "up" ? "up" : "down";
  await moveQuestion(await getDb(), teacher.id, String(formData.get("questionId") ?? ""), direction);
  refresh();
}
