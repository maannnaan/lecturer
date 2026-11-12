"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { parseChapter, parseCourse } from "@/lib/courses";
import { formInput } from "@/lib/form-input";
import { requireTeacher } from "@/server/auth/current";
import {
  addChapter,
  createCourse,
  deleteChapter,
  deleteCourse,
  moveChapter,
  moveCourse,
  updateChapter,
  updateCourse,
} from "@/server/courses";
import { getDb } from "@/server/db";
import { docWithOwnImages } from "@/server/media";
import { errorTexts, refused } from "../form-state";

// Each action re-reads the session and passes the teacher's own id down: the data layer then
// refuses any course or chapter id that belongs to someone else.

const saved: FormState = { ok: true, errors: {} };
const direction = (value: FormDataEntryValue | null) => (value === "up" ? "up" : "down");

export async function createCourseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { course, errors } = parseCourse(input);
  const db = await getDb();
  // Pictures in the description must be the teacher's own uploads.
  const descriptionRich = await docWithOwnImages(db, teacher.id, course.descriptionRich);
  if (descriptionRich === false) errors.description = "invalid";
  const refusal = await refused(errors, input);
  if (refusal || descriptionRich === false) return refusal!;
  const created = await createCourse(db, teacher.id, { ...course, descriptionRich });
  redirect(`/dashboard/courses/${created.id}`);
}

export async function updateCourseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { course, errors } = parseCourse(input);
  const db = await getDb();
  const descriptionRich = await docWithOwnImages(db, teacher.id, course.descriptionRich);
  if (descriptionRich === false) errors.description = "invalid";
  const refusal = await refused(errors, input);
  if (refusal || descriptionRich === false) return refusal!;
  const updated = await updateCourse(db, teacher.id, String(input.courseId ?? ""), { ...course, descriptionRich });
  if (!updated) return { errors: {}, formError: (await errorTexts()).generic };
  refresh();
  return saved;
}

export async function deleteCourseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  if (formData.get("confirm") !== "on") return { errors: { confirm: (await errorTexts()).confirmDelete } };
  await deleteCourse(await getDb(), teacher.id, String(formData.get("courseId") ?? ""));
  redirect("/dashboard/courses");
}

export async function moveCourseAction(formData: FormData) {
  const teacher = await requireTeacher();
  await moveCourse(await getDb(), teacher.id, String(formData.get("courseId") ?? ""), direction(formData.get("direction")));
  refresh();
}

export async function addChapterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { chapter, errors } = parseChapter(input);
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  const added = await addChapter(await getDb(), teacher.id, String(input.courseId ?? ""), chapter);
  if (!added) return { errors: {}, formError: (await errorTexts()).generic };
  refresh();
  return saved;
}

export async function updateChapterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { chapter, errors } = parseChapter(input);
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  const updated = await updateChapter(await getDb(), teacher.id, String(input.chapterId ?? ""), chapter);
  if (!updated) return { errors: {}, formError: (await errorTexts()).generic };
  refresh();
  return saved;
}

export async function deleteChapterAction(formData: FormData) {
  const teacher = await requireTeacher();
  await deleteChapter(await getDb(), teacher.id, String(formData.get("chapterId") ?? ""));
  refresh();
}

export async function moveChapterAction(formData: FormData) {
  const teacher = await requireTeacher();
  await moveChapter(await getDb(), teacher.id, String(formData.get("chapterId") ?? ""), direction(formData.get("direction")));
  refresh();
}
