import { asciiDigits } from "./digits";
import { type FieldErrors, type Input, text } from "./form-input";

// Online MCQ exams: their settings as the teacher's form gives them, and the pure arithmetic of a
// sitting (each student's own order of questions and options, the deadline, the score, the rank).

export const EXAM_RESULTS = ["immediate", "after_end"] as const;
export type ExamResults = (typeof EXAM_RESULTS)[number];

/** The most questions one exam holds. */
export const MAX_EXAM_QUESTIONS = 200;
/** How long an exam may last, in minutes: at least one, at most a day. */
export const MAX_DURATION_MIN = 24 * 60;

/** A date and time typed in a form ("YYYY-MM-DDTHH:mm", Bangladesh time) as an instant; null if it isn't one. */
export function dhakaDateTime(raw: string | undefined): Date | null {
  const value = asciiDigits(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+06:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** An instant as a form's date-and-time field wants it, in Bangladesh time. */
export function toDhakaInput(date: Date): string {
  return new Date(date.getTime() + 6 * 3_600_000).toISOString().slice(0, 16);
}

/** A mark typed as "1", "0.5", "০.২৫": hundredths of a mark, or null when it isn't one (or is too many). */
export function parseHundredths(raw: string | undefined, max: number): number | null {
  const value = asciiDigits(raw ?? "").trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(value)) return null;
  const result = Math.round(Number(value) * 100);
  return result <= max ? result : null;
}

/** An exam's settings, as the teacher's form gives them. Whether the course and batch are the teacher's is the data layer's question. */
export function parseExam(input: Input) {
  const errors: FieldErrors = {};
  const courseId = (input.courseId ?? "").trim();
  if (!courseId) errors.courseId = "required";
  const startsAt = dhakaDateTime(input.startsAt);
  if (!startsAt) errors.startsAt = (input.startsAt ?? "").trim() ? "invalid" : "required";
  const endsAt = dhakaDateTime(input.endsAt);
  if (!endsAt) errors.endsAt = (input.endsAt ?? "").trim() ? "invalid" : "required";
  else if (startsAt && endsAt <= startsAt) errors.endsAt = "dateOrder";

  const rawDuration = asciiDigits(input.durationMin ?? "").trim();
  const durationMin = /^\d{1,4}$/.test(rawDuration) ? Number(rawDuration) : 0;
  if (!rawDuration) errors.durationMin = "required";
  else if (durationMin < 1 || durationMin > MAX_DURATION_MIN) errors.durationMin = "number";

  const mark = parseHundredths(input.mark || "1", 10_000);
  if (mark === null || mark === 0) errors.mark = "number";
  const negative = parseHundredths(input.negative || "0", 10_000);
  if (negative === null) errors.negative = "number";
  else if (mark && negative > mark) errors.negative = "invalid";

  const exam = {
    courseId,
    batchId: (input.batchId ?? "").trim() || null,
    title: text(input, "title", 120, errors, true),
    instructions: text(input, "instructions", 2000, errors),
    startsAt: startsAt ?? new Date(0),
    endsAt: endsAt ?? new Date(0),
    durationMin,
    markHundredths: mark ?? 100,
    negativeHundredths: negative ?? 0,
    shuffleQuestions: input.shuffleQuestions === "on",
    shuffleOptions: input.shuffleOptions === "on",
    results: (EXAM_RESULTS as readonly string[]).includes(input.results ?? "") ? (input.results as ExamResults) : "after_end",
    showAnswers: input.showAnswers === "on",
  };
  return { exam, errors };
}
export type ExamInput = ReturnType<typeof parseExam>["exam"];

/** A small, fast PRNG (mulberry32): the same seed gives the same sequence, which is all a shuffle needs. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** A whole-number seed from any text (FNV-1a), so a student's order follows from the exam and the student. */
export function seedOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** The items in a seeded random order (Fisher–Yates); the input is left as it is. */
export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The order one student sees an exam in: its questions (shuffled, if the exam says so) and each
 * question's options (likewise), as indexes into the question as written. The same exam and
 * student always give the same order, so a reloaded page doesn't jump about.
 */
export function attemptOrder(
  questions: { id: string; optionCount: number }[],
  seed: number,
  options: { shuffleQuestions: boolean; shuffleOptions: boolean },
): { questions: string[]; options: Record<string, number[]> } {
  const random = mulberry32(seed);
  const ids = questions.map((q) => q.id);
  const order = options.shuffleQuestions ? shuffled(ids, random) : ids;
  const optionOrder: Record<string, number[]> = {};
  for (const q of questions) {
    const natural = Array.from({ length: q.optionCount }, (_, i) => i);
    optionOrder[q.id] = options.shuffleOptions ? shuffled(natural, random) : natural;
  }
  return { questions: order, options: optionOrder };
}

/** When a sitting must end: its duration after it began, but never after the exam's window closes. */
export function deadlineOf(startedAt: Date, durationMin: number, endsAt: Date): Date {
  return new Date(Math.min(startedAt.getTime() + durationMin * 60_000, endsAt.getTime()));
}

export type Score = { correct: number; wrong: number; skipped: number; scoreHundredths: number };

/**
 * A sitting's score: a mark for each right answer, less the negative mark for each wrong one; an
 * unanswered question costs nothing. Answers to questions not in the exam are ignored.
 */
export function gradeAttempt(
  questions: { id: string; answer: number }[],
  answers: Record<string, number>,
  marking: { markHundredths: number; negativeHundredths: number },
): Score {
  let correct = 0;
  let wrong = 0;
  for (const q of questions) {
    const given = answers[q.id];
    if (given === undefined || given === null) continue;
    if (given === q.answer) correct++;
    else wrong++;
  }
  return {
    correct,
    wrong,
    skipped: questions.length - correct - wrong,
    scoreHundredths: correct * marking.markHundredths - wrong * marking.negativeHundredths,
  };
}

/**
 * Places on a merit list: by score, then by the less time taken, then by who submitted first.
 * Equal on all three share a place (1, 2, 2, 4).
 */
export function rankAttempts<T extends { scoreHundredths: number; tookMs: number; submittedAt: Date }>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort(
    (a, b) => b.scoreHundredths - a.scoreHundredths || a.tookMs - b.tookMs || a.submittedAt.getTime() - b.submittedAt.getTime(),
  );
  const ranked: (T & { rank: number })[] = [];
  sorted.forEach((row, i) => {
    const before = ranked[i - 1];
    const tie =
      before !== undefined &&
      before.scoreHundredths === row.scoreHundredths &&
      before.tookMs === row.tookMs &&
      before.submittedAt.getTime() === row.submittedAt.getTime();
    ranked.push({ ...row, rank: tie ? before.rank : i + 1 });
  });
  return ranked;
}

/** Hundredths of a mark as a number to show: 250 → 2.5, 175 → 1.75, -50 → -0.5. */
export function marksOf(hundredths: number): number {
  return Math.round(hundredths) / 100;
}
