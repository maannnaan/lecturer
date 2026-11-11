"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { chapterLines, parseBankChapter, parseBankClass, parseSubject, sameClassName } from "@/lib/bank";
import { type FieldErrors, formInput, type Input } from "@/lib/form-input";
import { isUuid } from "@/lib/ids";
import { parseQuestion } from "@/lib/questions";
import { requireTeacher } from "@/server/auth/current";
import {
  addBankChapters,
  createBankClass,
  createSubject,
  deleteBankChapter,
  deleteSubject,
  getSubject,
  listBankClasses,
  moveBankChapter,
  removeBankClass,
  renameBankClass,
  updateBankChapter,
  updateSubject,
} from "@/server/bank";
import { listChapters } from "@/server/courses";
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
import { bankHref } from "./links";

// Each action re-reads the session and passes the teacher's own id down: the data layer then
// refuses a subject, chapter, image or question that belongs to someone else.

const saved: FormState = { ok: true, errors: {} };
const direction = (value: FormDataEntryValue | null) => (value === "up" ? "up" : "down");

/** What was typed, so a refused form comes back as the teacher left it. */
const keep = (input: Input) => Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v ?? ""]));

async function placementRefusal(reason: Exclude<SaveQuestionResult, { ok: true }>["reason"], input: Input): Promise<FormState> {
  const e = await errorTexts();
  if (reason === "missing") return { errors: {}, formError: e.generic, values: keep(input) };
  const field = reason === "image" ? "imageId" : reason === "subject" ? "subjectId" : "chapterId";
  return { errors: { [field]: e.invalid }, values: keep(input) };
}

// ── Classes ──

/** The class form, checked: a name, and not one of the teacher's other classes' names. */
async function checkedClass(teacherId: string, input: Input) {
  const { bankClass, errors } = parseBankClass(input);
  const db = await getDb();
  if (!errors.name) {
    const others = (await listBankClasses(db, teacherId)).filter((c) => c.id !== input.classId);
    if (others.some((c) => sameClassName(c.name, bankClass.name))) errors.name = "classTaken";
  }
  return { db, bankClass, refusal: await refused(errors, input) };
}

/** "নতুন শ্রেণি": adds a class by the name typed, then opens it, ready for its first subject. */
export async function createClassAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const { db, bankClass, refusal } = await checkedClass(teacher.id, formInput(formData));
  if (refusal) return refusal;
  const created = await createBankClass(db, teacher.id, bankClass);
  redirect(`/dashboard/bank/class/${created.id}`);
}

export async function renameClassAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { db, bankClass, refusal } = await checkedClass(teacher.id, input);
  if (refusal) return refusal;
  const renamed = await renameBankClass(db, teacher.id, String(input.classId ?? ""), bankClass);
  if (!renamed) return { errors: {}, formError: (await errorTexts()).generic, values: keep(input) };
  redirect(`/dashboard/bank/class/${renamed.id}`);
}

/** Takes an empty class out of the bank. One that has subjects stays, and opens again. */
export async function removeClassAction(formData: FormData) {
  const teacher = await requireTeacher();
  const classId = String(formData.get("classId") ?? "");
  if (!isUuid(classId)) redirect("/dashboard/bank");
  const removed = await removeBankClass(await getDb(), teacher.id, classId);
  redirect(removed ? "/dashboard/bank" : `/dashboard/bank/class/${classId}`);
}

// ── Subjects and their chapters ──

export async function createSubjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { subject, chapters, errors } = parseSubject(input);
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  const db = await getDb();
  // No chapters typed: take them from the chosen course, if any (only one of the teacher's own).
  const titles = chapters.length > 0 || !input.copyFrom ? chapters : (await listChapters(db, teacher.id, input.copyFrom)).map((ch) => ch.title);
  const created = await createSubject(db, teacher.id, subject, titles);
  // A class that isn't the teacher's (or was just removed).
  if (!created) return { errors: { classId: (await errorTexts()).invalid }, values: keep(input) };
  redirect(`/dashboard/bank/subject/${created.id}`);
}

export async function updateSubjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { subject, errors } = parseSubject({ ...input, chapters: "" });
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  const updated = await updateSubject(await getDb(), teacher.id, String(input.subjectId ?? ""), subject);
  if (!updated) return { errors: {}, formError: (await errorTexts()).generic };
  refresh();
  return saved;
}

export async function deleteSubjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  if (formData.get("confirm") !== "on") return { errors: { confirm: (await errorTexts()).confirmDelete } };
  const db = await getDb();
  const subject = await getSubject(db, teacher.id, String(formData.get("subjectId") ?? ""));
  if (subject) await deleteSubject(db, teacher.id, subject.id);
  redirect(subject ? `/dashboard/bank/class/${subject.classId}` : "/dashboard/bank");
}

export async function addChaptersAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const errors: FieldErrors = {};
  const titles = chapterLines(input.chapters ?? "", errors);
  if (titles.length === 0 && !errors.chapters) errors.chapters = "required";
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  const added = await addBankChapters(await getDb(), teacher.id, String(input.subjectId ?? ""), titles);
  if (!added) return { errors: {}, formError: (await errorTexts()).generic };
  refresh();
  return saved;
}

export async function updateBankChapterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { chapter, errors } = parseBankChapter(input);
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  const updated = await updateBankChapter(await getDb(), teacher.id, String(input.chapterId ?? ""), chapter);
  if (!updated) return { errors: {}, formError: (await errorTexts()).generic };
  refresh();
  return saved;
}

export async function deleteBankChapterAction(formData: FormData) {
  const teacher = await requireTeacher();
  await deleteBankChapter(await getDb(), teacher.id, String(formData.get("chapterId") ?? ""));
  refresh();
}

export async function moveBankChapterAction(formData: FormData) {
  const teacher = await requireTeacher();
  await moveBankChapter(await getDb(), teacher.id, String(formData.get("chapterId") ?? ""), direction(formData.get("direction")));
  refresh();
}

// ── Questions ──

export async function createQuestionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { question, errors } = parseQuestion(input);
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  const result = await createQuestion(await getDb(), teacher.id, question);
  if (!result.ok) return placementRefusal(result.reason, input);

  if (formData.get("next") === "another") {
    const query = new URLSearchParams({ type: question.type, subject: question.subjectId, added: result.question.id });
    if (question.chapterId) query.set("chapter", question.chapterId);
    redirect(`/dashboard/bank/new?${query}`);
  }
  redirect(bankHref(result.question));
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
  redirect(question ? bankHref(question) : "/dashboard/bank");
}

export async function duplicateQuestionAction(formData: FormData) {
  const teacher = await requireTeacher();
  const copy = await duplicateQuestion(await getDb(), teacher.id, String(formData.get("questionId") ?? ""));
  redirect(copy ? `/dashboard/bank/${copy.id}` : "/dashboard/bank");
}

export async function moveQuestionAction(formData: FormData) {
  const teacher = await requireTeacher();
  await moveQuestion(await getDb(), teacher.id, String(formData.get("questionId") ?? ""), direction(formData.get("direction")));
  refresh();
}
