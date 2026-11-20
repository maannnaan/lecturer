"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { formatMarks, formatNumber, formatRoll, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { parseHundredths } from "@/lib/exams";
import { type Input, formInput } from "@/lib/form-input";
import { parsePaper, parseResult } from "@/lib/papers";
import { SECTION_TABS, type SectionTab } from "@/lib/questions";
import { requireTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { deleteResult, saveResult, setResultsPublished, setWrittenMarks } from "@/server/paper-results";
import {
  type PaperRefusal,
  addPaperQuestions,
  createPaper,
  deletePaper,
  finalizePaper,
  getPaper,
  listPaperQuestions,
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

/**
 * One answer sheet typed in by the teacher, marked at once against its set's key. Answers back
 * with a line saying whose it is and what it scored, and the set chosen, for the next sheet.
 */
export async function saveResultAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const db = await getDb();
  const input = formInput(formData);
  const locale = await getLocale();
  const d = getDictionary(locale);
  const r = d.dashboard.papers.results;
  const paper = await getPaper(db, teacher.id, String(input.paperId ?? ""));
  if (!paper) return { errors: {}, formError: d.errors.generic };
  if (paper.status !== "final") return { errors: {}, formError: r.notFinal, values: keep(input) };
  const mcqCount = (await listPaperQuestions(db, teacher.id, paper.id)).filter((q) => q.section === "mcq" && q.question).length;
  const { result, errors } = parseResult(input, paper, mcqCount);
  const refusedForm = await refused(errors, input);
  if (refusedForm) return refusedForm;
  const saved = await saveResult(db, teacher.id, paper.id, { ...result, source: "manual" });
  if (!saved.ok) {
    if (saved.reason === "set") return (await refused({ setCode: "invalid" }, input))!;
    return { errors: {}, formError: saved.reason === "notFinal" ? r.notFinal : d.errors.generic, values: keep(input) };
  }
  refresh();
  const score = d.dashboard.exams.outOf(formatMarks(saved.result.scoreHundredths, locale), formatMarks(mcqCount * paper.markHundredths, locale));
  return { ok: true, errors: {}, values: { line: r.savedLine(formatRoll(result.roll, locale), saved.name ?? r.nobody, score), setCode: String(result.setCode) } };
}

/** A sheet's marks for the written part; left empty, they are taken back. Marks that aren't a number change nothing. */
export async function setWrittenAction(formData: FormData) {
  const teacher = await requireTeacher();
  const raw = String(formData.get("written") ?? "").trim();
  const hundredths = raw ? parseHundredths(raw, 100_000) : null;
  if (raw && hundredths === null) return;
  await setWrittenMarks(await getDb(), teacher.id, String(formData.get("resultId") ?? ""), hundredths);
  refresh();
}

export async function deleteResultAction(formData: FormData) {
  const teacher = await requireTeacher();
  await deleteResult(await getDb(), teacher.id, String(formData.get("resultId") ?? ""));
  refresh();
}

/** Lets the paper's students see their results, or (with `hide`) stops it. */
export async function publishResultsAction(formData: FormData) {
  const teacher = await requireTeacher();
  await setResultsPublished(await getDb(), teacher.id, String(formData.get("paperId") ?? ""), formData.get("hide") !== "1");
  refresh();
}

export async function deletePaperAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  if (formData.get("confirm") !== "on") return { errors: { confirm: (await errorTexts()).confirmDelete } };
  await deletePaper(await getDb(), teacher.id, String(formData.get("paperId") ?? ""));
  redirect("/dashboard/papers");
}
