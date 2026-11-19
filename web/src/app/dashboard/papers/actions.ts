"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { type Input, formInput } from "@/lib/form-input";
import { parsePaper } from "@/lib/papers";
import { SECTION_TABS, type SectionTab } from "@/lib/questions";
import { requireTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import {
  type PaperRefusal,
  addPaperQuestions,
  createPaper,
  deletePaper,
  finalizePaper,
  movePaperQuestion,
  randomPaperQuestionIds,
  removePaperQuestion,
  reopenPaper,
  updatePaper,
} from "@/server/papers";
import { errorTexts, refused } from "../form-state";

// Question papers. Each action re-reads the session and passes the teacher's own id down: the data
// layer refuses a course, batch, question or paper that isn't theirs.

const keep = (input: Input) => Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v ?? ""]));

async function refusal(reason: PaperRefusal, input: Input): Promise<FormState> {
  if (reason === "course") return (await refused({ courseId: "invalid" }, input))!;
  if (reason === "batch") return (await refused({ batchId: "invalid" }, input))!;
  return { errors: {}, formError: (await errorTexts()).generic, values: keep(input) };
}

export async function createPaperAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { paper, errors } = parsePaper(input);
  const refusedForm = await refused(errors, input);
  if (refusedForm) return refusedForm;
  const result = await createPaper(await getDb(), teacher.id, paper);
  if (!result.ok) return refusal(result.reason, input);
  redirect(`/dashboard/papers/${result.paper.id}`);
}

export async function updatePaperAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { paper, errors } = parsePaper(input);
  const refusedForm = await refused(errors, input);
  if (refusedForm) return refusedForm;
  const result = await updatePaper(await getDb(), teacher.id, String(input.paperId ?? ""), paper);
  if (!result.ok) return refusal(result.reason, input);
  refresh();
  return { ok: true, errors: {} };
}

/** The questions ticked in the bank list, or a number of one type picked at random from a chapter. */
export async function addPaperQuestionsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const db = await getDb();
  const paperId = String(formData.get("paperId") ?? "");
  let ids = formData.getAll("questionId").map(String);
  if (formData.get("mode") === "random") {
    const n = Math.max(0, Math.min(Number(formData.get("count")) || 0, 100));
    const rawTab = String(formData.get("tab") ?? "");
    const tab: SectionTab = (SECTION_TABS as readonly string[]).includes(rawTab) ? (rawTab as SectionTab) : "mcq";
    const chapterId = String(formData.get("chapterId") ?? "") || null;
    ids = await randomPaperQuestionIds(db, teacher.id, paperId, { subjectId: String(formData.get("subjectId") ?? ""), chapterId }, tab, n);
  }
  const added = await addPaperQuestions(db, teacher.id, paperId, ids);
  const locale = await getLocale();
  const d = getDictionary(locale);
  if (typeof added !== "number") return { errors: {}, formError: added === "locked" ? d.dashboard.papers.lockedNote : d.errors.generic };
  refresh();
  return { ok: true, errors: {}, values: { added: d.dashboard.papers.added(formatNumber(added, locale)) } };
}

export async function removePaperQuestionAction(formData: FormData) {
  const teacher = await requireTeacher();
  await removePaperQuestion(await getDb(), teacher.id, String(formData.get("paperQuestionId") ?? ""));
  refresh();
}

export async function movePaperQuestionAction(formData: FormData) {
  const teacher = await requireTeacher();
  await movePaperQuestion(await getDb(), teacher.id, String(formData.get("paperQuestionId") ?? ""), formData.get("direction") === "up" ? "up" : "down");
  refresh();
}

/** Makes the paper final, or (with `reopen`) takes it back to a draft. */
export async function finalizePaperAction(formData: FormData) {
  const teacher = await requireTeacher();
  const db = await getDb();
  const paperId = String(formData.get("paperId") ?? "");
  if (formData.get("reopen") === "1") await reopenPaper(db, teacher.id, paperId);
  else await finalizePaper(db, teacher.id, paperId);
  refresh();
}

export async function deletePaperAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  if (formData.get("confirm") !== "on") return { errors: { confirm: (await errorTexts()).confirmDelete } };
  await deletePaper(await getDb(), teacher.id, String(formData.get("paperId") ?? ""));
  redirect("/dashboard/papers");
}
