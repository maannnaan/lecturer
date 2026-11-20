import { asciiDigits } from "./digits";
import { attemptOrder, parseHundredths, seedOf } from "./exams";
import { type FieldErrors, type Input, text } from "./form-input";
import { encodeMarks, parseAnswers } from "./omr";
import { parseRoll } from "./students";

// Printed question papers: their settings as the teacher's form gives them, and the pure
// arithmetic of their sets (each set's order of questions and options, and its answer key).

/** The most MCQs a paper holds: what one OMR sheet has room for. */
export const MAX_PAPER_MCQS = 100;
/** The most written questions a paper holds. */
export const MAX_PAPER_WRITTEN = 40;
/** The most sets a paper comes in. */
export const MAX_SETS = 100;
/** The first set's code: three digits, as the OMR sheet's set-code grid reads them. */
export const FIRST_SET = 101;
/** The most sets printed at once. */
export const SETS_PER_PRINT = 10;

/** A paper's settings, as the teacher's form gives them. Whether the course and batch are the teacher's is the data layer's question. */
export function parsePaper(input: Input) {
  const errors: FieldErrors = {};
  const courseId = (input.courseId ?? "").trim();
  if (!courseId) errors.courseId = "required";

  const rawSets = asciiDigits(input.setCount ?? "").trim();
  const setCount = /^\d{1,3}$/.test(rawSets) ? Number(rawSets) : 0;
  if (!rawSets) errors.setCount = "required";
  else if (setCount < 1 || setCount > MAX_SETS) errors.setCount = "number";

  const mark = parseHundredths(input.mark || "1", 10_000);
  if (mark === null || mark === 0) errors.mark = "number";
  const negative = parseHundredths(input.negative || "0", 10_000);
  if (negative === null) errors.negative = "number";
  else if (mark && negative > mark) errors.negative = "invalid";

  const paper = {
    courseId,
    batchId: (input.batchId ?? "").trim() || null,
    title: text(input, "title", 120, errors, true),
    header: {
      institution: text(input, "institution", 120, errors),
      subject: text(input, "subject", 80, errors),
      className: text(input, "className", 80, errors),
      date: text(input, "date", 40, errors),
      duration: text(input, "duration", 40, errors),
      fullMarks: text(input, "fullMarks", 20, errors),
      instructions: text(input, "instructions", 600, errors),
    },
    setCount: setCount || 1,
    markHundredths: mark ?? 100,
    negativeHundredths: negative ?? 0,
    shuffleQuestions: input.shuffleQuestions === "on",
    shuffleOptions: input.shuffleOptions === "on",
  };
  return { paper, errors };
}
export type PaperInput = ReturnType<typeof parsePaper>["paper"];

/** A paper's set codes, in order: 101, 102, … */
export function setCodes(paper: { firstSet: number; setCount: number }): number[] {
  return Array.from({ length: Math.max(1, paper.setCount) }, (_, i) => paper.firstSet + i);
}

/** The order a set prints its MCQs in, and each one's options: indexes into the question as written. */
export type SetOrder = { questions: string[]; options: Record<string, number[]> };

/**
 * One set's order. The first set keeps the teacher's order; every other set is shuffled (as the
 * paper says: its questions, its options, or both) from the paper's seed and the set's code, so
 * printing a set again gives the same paper.
 */
export function setOrder(
  questions: { id: string; optionCount: number }[],
  paper: { seed: number; firstSet: number; shuffleQuestions: boolean; shuffleOptions: boolean },
  code: number,
): SetOrder {
  const plain = code === paper.firstSet;
  return attemptOrder(
    questions,
    seedOf(`${paper.seed}:${code}`),
    plain ? { shuffleQuestions: false, shuffleOptions: false } : { shuffleQuestions: paper.shuffleQuestions, shuffleOptions: paper.shuffleOptions },
  );
}

/**
 * A set's answer key: for each of its questions, in the set's order, the right option's place as
 * printed in that set (0 for the first, ক). -1 for a question without an answer.
 */
export function setKey(questions: { id: string; answer: number }[], order: SetOrder): number[] {
  const answers = new Map(questions.map((q) => [q.id, q.answer]));
  return order.questions.map((id) => {
    const answer = answers.get(id);
    if (answer === undefined || answer < 0) return -1;
    return (order.options[id] ?? []).indexOf(answer);
  });
}

/**
 * Which sets to print, from the address: "102" is one set, "101-110" a run of them. Codes outside
 * the paper are dropped, and a run stops at SETS_PER_PRINT sets. Null when nothing fits.
 */
export function printSets(raw: string | undefined, paper: { firstSet: number; setCount: number }): number[] | null {
  const codes = setCodes(paper);
  const match = /^(\d{1,3})(?:-(\d{1,3}))?$/.exec(asciiDigits(raw ?? "").trim());
  if (!match) return null;
  const from = Number(match[1]);
  const to = match[2] === undefined ? from : Number(match[2]);
  const picked = codes.filter((code) => code >= from && code <= to).slice(0, SETS_PER_PRINT);
  return picked.length > 0 ? picked : null;
}

/**
 * One answer sheet as the teacher types it in: the roll, the set, the answers (see parseAnswers,
 * no more than the paper's MCQs), and the written part's marks, which may be left for later.
 */
export function parseResult(input: Input, paper: { firstSet: number; setCount: number }, mcqCount: number) {
  const errors: FieldErrors = {};
  const roll = parseRoll(input.roll, errors);
  if (!roll && !errors.roll) errors.roll = "required";
  const setCode = Number(asciiDigits(input.setCode ?? "").trim());
  if (!setCodes(paper).includes(setCode)) errors.setCode = "invalid";
  const answers = parseAnswers(input.answers ?? "");
  if (answers === null || answers.length > mcqCount) errors.answers = "answers";
  const rawWritten = (input.written ?? "").trim();
  const writtenHundredths = rawWritten ? parseHundredths(rawWritten, 100_000) : undefined;
  if (writtenHundredths === null) errors.written = "number";
  return {
    result: { roll: roll ?? "", setCode, marks: encodeMarks(answers ?? []), writtenHundredths: writtenHundredths ?? undefined },
    errors,
  };
}

/**
 * Places on a paper's merit list: by the total (the MCQs and the written part together), then by
 * the MCQ score; equal on both share a place (1, 2, 2, 4). Within a place, by roll.
 */
export function rankResults<T extends { totalHundredths: number; scoreHundredths: number; roll: string }>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort(
    (a, b) => b.totalHundredths - a.totalHundredths || b.scoreHundredths - a.scoreHundredths || Number(a.roll) - Number(b.roll) || a.roll.localeCompare(b.roll),
  );
  const ranked: (T & { rank: number })[] = [];
  sorted.forEach((row, i) => {
    const before = ranked[i - 1];
    const tie = before !== undefined && before.totalHundredths === row.totalHundredths && before.scoreHundredths === row.scoreHundredths;
    ranked.push({ ...row, rank: tie ? before.rank : i + 1 });
  });
  return ranked;
}

/** A paper's sets in runs of SETS_PER_PRINT, for the print links: "101-110", "111-120", … */
export function printRuns(paper: { firstSet: number; setCount: number }): { from: number; to: number }[] {
  const codes = setCodes(paper);
  const runs: { from: number; to: number }[] = [];
  for (let i = 0; i < codes.length; i += SETS_PER_PRINT) {
    const run = codes.slice(i, i + SETS_PER_PRINT);
    runs.push({ from: run[0], to: run[run.length - 1] });
  }
  return runs;
}
