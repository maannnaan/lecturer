import type { QuestionBody } from "@/server/db/schema";
import { asciiDigits } from "./digits";
import { type FieldErrors, type Input, text, url } from "./form-input";

/** The kinds of question a teacher can write, in the order the editor offers them. */
export const QUESTION_TYPES = ["textbook", "practice", "mcq", "mcq_multi", "short", "creative"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Types with four options and one right answer: these can go into MCQ exams and OMR papers. */
export const MCQ_TYPES = ["mcq", "mcq_multi"] as const satisfies readonly QuestionType[];
export const isMcq = (type: QuestionType) => (MCQ_TYPES as readonly string[]).includes(type);

/** Numerical problems: from the textbook's exercises, or extra ones to practise. Same fields. */
export const isProblem = (type: QuestionType) => type === "textbook" || type === "practice";

/**
 * The sections of the question bank, in the order a chapter shows them: textbook problems,
 * practice problems, MCQ, SQ (short) and CQ (creative). Each is a chapter page's `?tab=` value.
 */
export const BANK_TABS = ["textbook", "practice", "mcq", "sq", "cq"] as const;
export type BankTab = (typeof BANK_TABS)[number];

const TAB_TYPES: Record<BankTab, readonly QuestionType[]> = {
  textbook: ["textbook"],
  practice: ["practice"],
  mcq: MCQ_TYPES,
  sq: ["short"],
  cq: ["creative"],
};

/** The question types a section lists. */
export const tabTypes = (tab: BankTab): readonly QuestionType[] => TAB_TYPES[tab];

/** The section a question type is listed in. */
export function tabOf(type: QuestionType): BankTab {
  return BANK_TABS.find((tab) => TAB_TYPES[tab].includes(type)) ?? "mcq";
}

/** `?tab=` names from before the sections were renamed; "board" is now a filter in each section. */
const OLD_TABS = new Map<string, BankTab>([
  ["problem", "textbook"],
  ["short", "sq"],
  ["creative", "cq"],
  ["board", "mcq"],
]);

/** A chapter page's `?tab=`, old names included; null for anything else. */
export function tabFromParam(raw: string | undefined): { tab: BankTab; anyBoard: boolean } | null {
  if ((BANK_TABS as readonly string[]).includes(raw ?? "")) return { tab: raw as BankTab, anyBoard: false };
  const old = OLD_TABS.get(raw ?? "");
  return old ? { tab: old, anyBoard: raw === "board" } : null;
}

export const VISIBILITIES = ["public", "private"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** Education boards a board question can come from; names live in the dictionaries. */
export const BOARDS = [
  "dhaka",
  "rajshahi",
  "cumilla",
  "jashore",
  "chattogram",
  "barishal",
  "sylhet",
  "dinajpur",
  "mymensingh",
  "madrasah",
  "technical",
  "combined",
] as const;
export type Board = (typeof BOARDS)[number];

export const OPTION_COUNT = 4;
export const MIN_STATEMENTS = 2;
export const MAX_STATEMENTS = 4;
export const CREATIVE_PART_COUNT = 4;
/** The usual marks of ক, খ, গ, ঘ in a creative question. */
export const DEFAULT_PART_MARKS = [1, 2, 3, 4] as const;

const YOUTUBE = /(^|\.)(youtube\.com|youtu\.be)$/i;

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(value ?? "") ? (value as T) : null;
}

/** A year like 2023 (Bangla digits too), or null when empty. */
function parseYear(input: Input, errors: FieldErrors): number | null {
  const raw = asciiDigits(input.year ?? "").trim();
  if (!raw) return null;
  const year = Number(raw);
  if (!/^\d{4}$/.test(raw) || year < 1950 || year > 2100) {
    errors.year = "invalid";
    return null;
  }
  return year;
}

/** A creative part's marks: a whole number 0–20, or the usual default when left empty. */
function parseMarks(input: Input, i: number, errors: FieldErrors): number {
  const raw = asciiDigits(input[`marks${i}`] ?? "").trim();
  if (!raw) return DEFAULT_PART_MARKS[i] ?? 1;
  const marks = Number(raw);
  if (!/^\d{1,2}$/.test(raw) || marks > 20) {
    errors[`marks${i}`] = "number";
    return DEFAULT_PART_MARKS[i] ?? 1;
  }
  return marks;
}

function parseOptions(input: Input, errors: FieldErrors) {
  const options = Array.from({ length: OPTION_COUNT }, (_, i) => text(input, `option${i}`, 600, errors, true));
  const answer = Number(input.answer);
  const valid = input.answer !== undefined && input.answer !== "" && Number.isInteger(answer) && answer >= 0 && answer < OPTION_COUNT;
  if (!valid) errors.answer = "pickAnswer";
  return { options, answer: valid ? answer : 0, explanation: text(input, "explanation", 4000, errors) };
}

/**
 * Reads the question editor's fields. The course and chapter ids are only checked for shape here;
 * the data layer checks they belong to the teacher.
 */
export function parseQuestion(input: Input) {
  const errors: FieldErrors = {};
  const type = oneOf(input.type, QUESTION_TYPES);
  if (!type) errors.type = "invalid";
  const kind: QuestionType = type ?? "mcq";

  const courseId = (input.courseId ?? "").trim();
  if (!courseId) errors.courseId = "required";
  const chapterId = (input.chapterId ?? "").trim() || null;

  const stem = text(input, "stem", 4000, errors, true);
  let body: QuestionBody;
  switch (kind) {
    case "mcq":
      body = { stem, ...parseOptions(input, errors) };
      break;
    case "mcq_multi": {
      const statements: string[] = [];
      for (let i = 0; i < MAX_STATEMENTS; i++) {
        const value = text(input, `statement${i}`, 600, errors, i < MIN_STATEMENTS);
        if (value) statements.push(value);
      }
      body = { stem, statements, prompt: text(input, "prompt", 200, errors), ...parseOptions(input, errors) };
      break;
    }
    case "short":
      body = { stem, modelAnswer: text(input, "modelAnswer", 4000, errors) };
      break;
    case "creative":
      body = {
        stem,
        parts: Array.from({ length: CREATIVE_PART_COUNT }, (_, i) => ({
          text: text(input, `part${i}`, 2000, errors, true),
          marks: parseMarks(input, i, errors),
          solution: text(input, `solution${i}`, 6000, errors),
        })),
      };
      break;
    case "textbook":
    case "practice":
      body = {
        stem,
        finalAnswer: text(input, "finalAnswer", 300, errors),
        solution: text(input, "solution", 8000, errors),
      };
      break;
  }

  const board = oneOf(input.board, BOARDS) ?? "";
  const question = {
    type: kind,
    courseId,
    chapterId,
    visibility: oneOf(input.visibility, VISIBILITIES) ?? "public",
    body,
    board,
    year: parseYear(input, errors),
    source: text(input, "source", 120, errors),
    videoUrl: url(input, "videoUrl", errors, YOUTUBE),
    /** An uploaded image to attach (a media id), or null for none. */
    imageId: (input.imageId ?? "").trim() || null,
  };
  return { question, errors };
}

export type QuestionInput = ReturnType<typeof parseQuestion>["question"];
