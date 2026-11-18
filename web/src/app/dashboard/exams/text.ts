import "server-only";
import type { Dictionary } from "@/i18n";
import { marksOf, toDhakaInput } from "@/lib/exams";
import type { Exam } from "@/server/exams";
import type { ExamFormText, ExamValues } from "./exam-forms";

/** Where an exam stands now: not yet published, published but not open yet, open, or closed. */
export function examState(exam: Pick<Exam, "status" | "startsAt" | "endsAt">, now: Date): "draft" | "upcoming" | "live" | "ended" {
  if (exam.status === "draft") return "draft";
  if (now < exam.startsAt) return "upcoming";
  return now < exam.endsAt ? "live" : "ended";
}

export const STATE_BADGE = { draft: "badge", upcoming: "badge badge-primary", live: "badge badge-ok", ended: "badge" } as const;

export function examFormText(d: Dictionary): ExamFormText {
  const f = d.dashboard.exams.form;
  return {
    title: f.title,
    titlePlaceholder: f.titlePlaceholder,
    course: f.course,
    batch: f.batch,
    allBatches: f.allBatches,
    startsAt: f.startsAt,
    endsAt: f.endsAt,
    windowHint: f.windowHint,
    duration: f.duration,
    mark: f.mark,
    negative: f.negative,
    negativeHint: f.negativeHint,
    shuffleQuestions: f.shuffleQuestions,
    shuffleOptions: f.shuffleOptions,
    results: f.results,
    resultsImmediate: f.resultsOptions.immediate,
    resultsAfterEnd: f.resultsOptions.after_end,
    showAnswers: f.showAnswers,
    instructions: f.instructions,
    create: f.create,
    locked: f.locked,
  };
}

/** An exam as its settings form shows it. */
export function examValues(exam: Exam): ExamValues {
  return {
    id: exam.id,
    courseId: exam.courseId,
    batchId: exam.batchId ?? "",
    title: exam.title,
    instructions: exam.instructions,
    startsAt: toDhakaInput(exam.startsAt),
    endsAt: toDhakaInput(exam.endsAt),
    durationMin: String(exam.durationMin),
    mark: String(marksOf(exam.markHundredths)),
    negative: String(marksOf(exam.negativeHundredths)),
    shuffleQuestions: exam.shuffleQuestions,
    shuffleOptions: exam.shuffleOptions,
    results: exam.results,
    showAnswers: exam.showAnswers,
  };
}

/** A new exam's starting values: tomorrow at 10 in the morning (Bangladesh time), half an hour, a quarter mark off for a wrong answer. */
export function newExamDefaults(courseId: string): Omit<ExamValues, "id"> {
  const tomorrow = new Date(Date.now() + 6 * 3_600_000 + 86_400_000).toISOString().slice(0, 10);
  return {
    courseId,
    batchId: "",
    title: "",
    instructions: "",
    startsAt: `${tomorrow}T10:00`,
    endsAt: `${tomorrow}T10:30`,
    durationMin: "30",
    mark: "1",
    negative: "0.25",
    shuffleQuestions: true,
    shuffleOptions: false,
    results: "after_end",
    showAnswers: true,
  };
}
