"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { type FieldErrors, type Input, formInput } from "@/lib/form-input";
import { parseBatch, parsePassword, parsePlacement, parseStudent } from "@/lib/students";
import { requireTeacher } from "@/server/auth/current";
import { BatchNameTaken, createBatch, deleteBatch, updateBatch } from "@/server/batches";
import { getDb } from "@/server/db";
import { type EnrollResult, approveEnrollment, closeEnrollment, deleteEnrollment, enrollStudent } from "@/server/enrollments";
import { StudentPhoneTaken, createStudent, deleteStudent, setStudentPassword, setStudentStatus, updateStudent } from "@/server/students";
import { errorTexts, refused } from "../form-state";

// Students, admissions and batches. Each action re-reads the session and passes the teacher's own
// id down: the data layer then refuses a student, course, batch or enrolment that isn't theirs.

const saved: FormState = { ok: true, errors: {} };

/** The form's answer when a placement was refused: the field it was about, in the teacher's language. */
async function placementRefusal(reason: Exclude<EnrollResult, { ok: true }>["reason"], input: Input): Promise<FormState> {
  if (reason === "rollTaken") return (await refused({ roll: "rollTaken" }, input))!;
  if (reason === "batch") return (await refused({ batchId: "invalid" }, input))!;
  if (reason === "course") return (await refused({ courseId: "invalid" }, input))!;
  return { errors: {}, formError: (await errorTexts()).generic };
}

// ── Students ──

/** The teacher adds a student themselves; a login can be given afterwards. */
export async function createStudentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { student, errors } = parseStudent(input);
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  let id: string;
  try {
    id = (await createStudent(await getDb(), { ...student, teacherId: teacher.id, source: "offline" })).id;
  } catch (error) {
    if (error instanceof StudentPhoneTaken) return (await refused({ phone: "phoneTaken" }, input))!;
    throw error;
  }
  redirect(`/dashboard/students/${id}`);
}

export async function updateStudentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { student, errors } = parseStudent(input);
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  try {
    const updated = await updateStudent(await getDb(), teacher.id, String(input.studentId ?? ""), student);
    if (!updated) return { errors: {}, formError: (await errorTexts()).generic };
  } catch (error) {
    if (error instanceof StudentPhoneTaken) return (await refused({ phone: "phoneTaken" }, input))!;
    throw error;
  }
  refresh();
  return saved;
}

/** Gives the student a (new) password; they are signed out wherever they were signed in. */
export async function setStudentPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const errors: FieldErrors = {};
  const password = parsePassword(input, errors);
  const refusal = await refused(errors, {});
  if (refusal) return refusal;
  const done = await setStudentPassword(await getDb(), teacher.id, String(input.studentId ?? ""), password);
  if (!done) return { errors: {}, formError: (await errorTexts()).generic };
  refresh();
  return saved;
}

export async function setStudentStatusAction(formData: FormData) {
  const teacher = await requireTeacher();
  const status = formData.get("status") === "inactive" ? "inactive" : "active";
  await setStudentStatus(await getDb(), teacher.id, String(formData.get("studentId") ?? ""), status);
  refresh();
}

export async function deleteStudentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  if (formData.get("confirm") !== "on") return { errors: { confirm: (await errorTexts()).confirmDelete } };
  await deleteStudent(await getDb(), teacher.id, String(formData.get("studentId") ?? ""));
  redirect("/dashboard/students");
}

// ── Admissions ──

/** Puts one of the teacher's students into a course, with a batch, roll and fee. */
export async function enrollAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { placement, errors } = parsePlacement(input);
  if (!input.courseId) errors.courseId = "required";
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  const result = await enrollStudent(await getDb(), teacher.id, String(input.studentId ?? ""), String(input.courseId ?? ""), placement);
  if (!result.ok) return placementRefusal(result.reason, input);
  refresh();
  return saved;
}

/** Lets a student who asked into the course, or changes the place of one already in it. */
export async function placeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { placement, errors } = parsePlacement(input);
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  const result = await approveEnrollment(await getDb(), teacher.id, String(input.enrollmentId ?? ""), placement);
  if (!result.ok) return placementRefusal(result.reason, input);
  refresh();
  return saved;
}

/** Turns a request down (with a word why), or marks a student as having left the course. */
export async function closeEnrollmentAction(formData: FormData) {
  const teacher = await requireTeacher();
  const status = formData.get("status") === "left" ? "left" : "rejected";
  await closeEnrollment(await getDb(), teacher.id, String(formData.get("enrollmentId") ?? ""), status, String(formData.get("note") ?? "").trim());
  refresh();
}

export async function removeEnrollmentAction(formData: FormData) {
  const teacher = await requireTeacher();
  await deleteEnrollment(await getDb(), teacher.id, String(formData.get("enrollmentId") ?? ""));
  refresh();
}

// ── Batches ──

export async function createBatchAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { batch, errors } = parseBatch(input);
  if (!input.courseId) errors.courseId = "required";
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  try {
    const created = await createBatch(await getDb(), teacher.id, String(input.courseId ?? ""), batch);
    if (!created) return (await refused({ courseId: "invalid" }, input))!;
  } catch (error) {
    if (error instanceof BatchNameTaken) return (await refused({ name: "batchTaken" }, input))!;
    throw error;
  }
  refresh();
  return saved;
}

export async function updateBatchAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { batch, errors } = parseBatch(input);
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  try {
    const updated = await updateBatch(await getDb(), teacher.id, String(input.batchId ?? ""), batch);
    if (!updated) return { errors: {}, formError: (await errorTexts()).generic };
  } catch (error) {
    if (error instanceof BatchNameTaken) return (await refused({ name: "batchTaken" }, input))!;
    throw error;
  }
  refresh();
  return saved;
}

export async function deleteBatchAction(formData: FormData) {
  const teacher = await requireTeacher();
  await deleteBatch(await getDb(), teacher.id, String(formData.get("batchId") ?? ""));
  refresh();
}
