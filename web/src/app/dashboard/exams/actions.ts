"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { parseExam } from "@/lib/exams";
import { type Input, formInput } from "@/lib/form-input";
import { requireTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import {
  type ExamRefusal,
  addExamQuestions,
  createExam,
  deleteExam,
  moveExamQuestion,
  publishExam,
  randomQuestionIds,
  removeExamQuestion,
  unpublishExam,
  updateExam,
} from "@/server/exams";
import { errorTexts, refused } from "../form-state";

// Exams. Each action re-reads the session and passes the teacher's own id down: the data layer
// refuses a course, batch, question or exam that isn't theirs.

const keep = (input: Input) => Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v ?? ""]));

async function refusal(reason: ExamRefusal, input: Input): Promise<FormState> {
  if (reason === "course") return (await refused({ courseId: "invalid" }, input))!;
  if (reason === "batch") return (await refused({ batchId: "invalid" }, input))!;
  return { errors: {}, formError: (await errorTexts()).generic, values: keep(input) };
}

export async function createExamAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { exam, errors } = parseExam(input);
  const refusedForm = await refused(errors, input);
  if (refusedForm) return refusedForm;
  const result = await createExam(await getDb(), teacher.id, exam);
  if (!result.ok) return refusal(result.reason, input);
  redirect(`/dashboard/exams/${result.exam.id}`);
}

export async function updateExamAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { exam, errors } = parseExam(input);
  const refusedForm = await refused(errors, input);
  if (refusedForm) return refusedForm;
  const result = await updateExam(await getDb(), teacher.id, String(input.examId ?? ""), exam);
  if (!result.ok) return refusal(result.reason, input);
  refresh();
  return { ok: true, errors: {} };
}

/** The questions ticked in the bank list, or a number of them picked at random from a chapter. */
export async function addExamQuestionsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const db = await getDb();
  const examId = String(formData.get("examId") ?? "");
  let ids = formData.getAll("questionId").map(String);
  if (formData.get("mode") === "random") {
    const n = Math.max(0, Math.min(Number(formData.get("count")) || 0, 200));
    const chapterId = String(formData.get("chapterId") ?? "") || null;
    ids = await randomQuestionIds(db, teacher.id, examId, { subjectId: String(formData.get("subjectId") ?? ""), chapterId }, n);
  }
  const added = await addExamQuestions(db, teacher.id, examId, ids);
  const locale = await getLocale();
  const d = getDictionary(locale);
  if (typeof added !== "number") return { errors: {}, formError: added === "locked" ? d.dashboard.exams.lockedNote : d.errors.generic };
  refresh();
  return { ok: true, errors: {}, formError: undefined, values: { added: d.dashboard.exams.added(formatNumber(added, locale)) } };
}

export async function removeExamQuestionAction(formData: FormData) {
  const teacher = await requireTeacher();
  await removeExamQuestion(await getDb(), teacher.id, String(formData.get("examQuestionId") ?? ""));
  refresh();
}

export async function moveExamQuestionAction(formData: FormData) {
  const teacher = await requireTeacher();
  await moveExamQuestion(await getDb(), teacher.id, String(formData.get("examQuestionId") ?? ""), formData.get("direction") === "up" ? "up" : "down");
  refresh();
}

/** Publishes the exam, or (with `unpublish`) takes it back to a draft while nobody has started it. */
export async function publishExamAction(formData: FormData) {
  const teacher = await requireTeacher();
  const db = await getDb();
  const examId = String(formData.get("examId") ?? "");
  if (formData.get("unpublish") === "1") await unpublishExam(db, teacher.id, examId);
  else await publishExam(db, teacher.id, examId);
  refresh();
}

export async function deleteExamAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  if (formData.get("confirm") !== "on") return { errors: { confirm: (await errorTexts()).confirmDelete } };
  await deleteExam(await getDb(), teacher.id, String(formData.get("examId") ?? ""));
  redirect("/dashboard/exams");
}
