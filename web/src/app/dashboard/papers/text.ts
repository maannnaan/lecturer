import "server-only";
import { type Dictionary, type Locale, formatNumber } from "@/i18n";
import { marksOf } from "@/lib/exams";
import { FIRST_SET, MAX_SETS } from "@/lib/papers";
import type { Paper } from "@/server/papers";
import type { PaperFormText, PaperValues } from "./paper-forms";

export const STATUS_BADGE = { draft: "badge", final: "badge badge-ok" } as const;

/** The paper form's words, as plain strings for the browser. */
export function paperFormText(d: Dictionary, locale: Locale): PaperFormText {
  const f = d.dashboard.papers.form;
  return {
    title: f.title,
    titlePlaceholder: f.titlePlaceholder,
    course: f.course,
    batch: f.batch,
    allBatches: f.allBatches,
    headerTitle: f.headerTitle,
    institution: f.institution,
    subject: f.subject,
    subjectHint: f.subjectHint,
    className: f.className,
    date: f.date,
    datePlaceholder: f.datePlaceholder,
    duration: f.duration,
    durationPlaceholder: f.durationPlaceholder,
    fullMarks: f.fullMarks,
    fullMarksHint: f.fullMarksHint,
    instructions: f.instructions,
    setsTitle: f.setsTitle,
    setCount: f.setCount,
    setCountHint: f.setCountHint(formatNumber(FIRST_SET, locale), formatNumber(MAX_SETS, locale)),
    shuffleQuestions: f.shuffleQuestions,
    shuffleOptions: f.shuffleOptions,
    shuffleHint: f.shuffleHint,
    mark: f.mark,
    negative: f.negative,
    negativeHint: f.negativeHint,
    create: f.create,
    locked: f.locked,
  };
}

/** A paper as its settings form shows it. */
export function paperValues(paper: Paper): PaperValues {
  return {
    id: paper.id,
    courseId: paper.courseId,
    batchId: paper.batchId ?? "",
    title: paper.title,
    ...paper.header,
    setCount: String(paper.setCount),
    mark: String(marksOf(paper.markHundredths)),
    negative: String(marksOf(paper.negativeHundredths)),
    shuffleQuestions: paper.shuffleQuestions,
    shuffleOptions: paper.shuffleOptions,
  };
}

/** A new paper's starting values: under the teacher's name, four sets, the MCQs shuffled in each, no marks off. */
export function newPaperDefaults(courseId: string, institution: string): Omit<PaperValues, "id"> {
  return {
    courseId,
    batchId: "",
    title: "",
    institution,
    subject: "",
    className: "",
    date: "",
    duration: "",
    fullMarks: "",
    instructions: "",
    setCount: "4",
    mark: "1",
    negative: "0",
    shuffleQuestions: true,
    shuffleOptions: false,
  };
}
