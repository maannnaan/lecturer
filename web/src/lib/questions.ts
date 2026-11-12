import type { QuestionBody } from "@/server/db/schema";
import { asciiDigits } from "./digits";
import { type FieldErrors, type Input, text, url } from "./form-input";
import { type RichText, richField, richImageIds } from "./rich-text";

/** The kinds of question a teacher can write, in the order the editor offers them. */
export const QUESTION_TYPES = ["textbook", "practice", "mcq", "mcq_multi", "short", "creative"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Types with four options and one right answer: these can go into MCQ exams and OMR papers. */
export const MCQ_TYPES = ["mcq", "mcq_multi"] as const satisfies readonly QuestionType[];
export const isMcq = (type: QuestionType) => (MCQ_TYPES as readonly string[]).includes(type);

/** Numerical problems: from the textbook's exercises, or extra ones to practise. Same fields. */
export const isProblem = (type: QuestionType) => type === "textbook" || type === "practice";

/**
 * The sections a question is filed in, in the order a chapter shows them: textbook problems,
 * practice problems, MCQ, SQ (short) and CQ (creative). Every question is in exactly one.
 */
export const SECTION_TABS = ["textbook", "practice", "mcq", "sq", "cq"] as const;
export type SectionTab = (typeof SECTION_TABS)[number];

/**
 * A chapter's tabs: the five sections, then its board questions of every type. Each is a chapter
 * page's `?tab=` value.
 */
export const BANK_TABS = [...SECTION_TABS, "board"] as const;
export type BankTab = (typeof BANK_TABS)[number];

const TAB_TYPES: Record<SectionTab, readonly QuestionType[]> = {
  textbook: ["textbook"],
  practice: ["practice"],
  mcq: MCQ_TYPES,
  sq: ["short"],
  cq: ["creative"],
};

/** The question types a tab lists; the board tab lists every type. */
export const tabTypes = (tab: BankTab): readonly QuestionType[] => (tab === "board" ? QUESTION_TYPES : TAB_TYPES[tab]);

/** The section a question type is listed in. */
export function tabOf(type: QuestionType): SectionTab {
  return SECTION_TABS.find((tab) => TAB_TYPES[tab].includes(type)) ?? "mcq";
}

/** `?tab=` names from before the sections were renamed. */
const OLD_TABS = new Map<string, BankTab>([
  ["problem", "textbook"],
  ["short", "sq"],
  ["creative", "cq"],
]);

/** A chapter page's `?tab=`, old names included; null for anything else. */
export function tabFromParam(raw: string | undefined): BankTab | null {
  if ((BANK_TABS as readonly string[]).includes(raw ?? "")) return raw as BankTab;
  return OLD_TABS.get(raw ?? "") ?? null;
}

/** How hard a question is; "" when the teacher hasn't said. */
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * Where a question comes from, for the chapter filters: a board exam (it has a board), a school or
 * college test (it names another source), or neither: the teacher's own.
 */
export const SOURCES = ["board", "school", "own"] as const;
export type Source = (typeof SOURCES)[number];

export function sourceOf(question: { board: string; source: string }): Source {
  if (question.board) return "board";
  return question.source ? "school" : "own";
}

/** The filters a chapter page applies to every tab; empty means "all". */
export type ChapterFilters = {
  /** A sub-chapter's number within the chapter. */
  topic?: number;
  /** A board key, or "any" for every board question. */
  board?: string;
  year?: number;
  difficulty?: Difficulty;
  /** The sources to show; undefined shows all three. */
  sources?: Source[];
};

/** Reads a chapter page's filter parameters (`sub`, `board`, `year`, `diff`, `src`), ignoring nonsense. */
export function filtersFromParams(params: { sub?: string; board?: string; year?: string; diff?: string; src?: string }): ChapterFilters {
  const filters: ChapterFilters = {};
  const sub = asciiDigits(params.sub ?? "");
  if (/^\d{1,6}$/.test(sub) && Number(sub) > 0) filters.topic = Number(sub);
  if (params.board === "any" || (BOARDS as readonly string[]).includes(params.board ?? "")) filters.board = params.board;
  const year = asciiDigits(params.year ?? "");
  if (/^\d{4}$/.test(year)) filters.year = Number(year);
  if ((DIFFICULTIES as readonly string[]).includes(params.diff ?? "")) filters.difficulty = params.diff as Difficulty;
  if (params.src !== undefined) {
    const picked = params.src.split(",");
    const sources = SOURCES.filter((s) => picked.includes(s));
    if (sources.length < SOURCES.length) filters.sources = sources;
  }
  return filters;
}

/** The query string for a set of filters (in a fixed order, defaults left out). */
export function filterParams(filters: ChapterFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.topic) params.sub = String(filters.topic);
  if (filters.board) params.board = filters.board;
  if (filters.year) params.year = String(filters.year);
  if (filters.difficulty) params.diff = filters.difficulty;
  if (filters.sources && filters.sources.length < SOURCES.length) params.src = filters.sources.join(",");
  return params;
}

/** How many filters differ from "show everything". */
export function activeFilters(filters: ChapterFilters): number {
  return Object.keys(filterParams(filters)).length;
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
  const options = Array.from({ length: OPTION_COUNT }, (_, i) => richField(input, `option${i}`, 600, errors, { required: true, mode: "inline" }));
  const answer = Number(input.answer);
  const valid = input.answer !== undefined && input.answer !== "" && Number.isInteger(answer) && answer >= 0 && answer < OPTION_COUNT;
  if (!valid) errors.answer = "pickAnswer";
  return { options, answer: valid ? answer : 0, explanation: richField(input, "explanation", 4000, errors) };
}

/**
 * Reads the question editor's fields. Its text fields are rich text (src/lib/rich-text.ts): the
 * editor's documents, or plain text. The subject and chapter ids, and the pictures' media ids,
 * are only checked for shape here; the data layer checks they belong to the teacher.
 */
export function parseQuestion(input: Input) {
  const errors: FieldErrors = {};
  const type = oneOf(input.type, QUESTION_TYPES);
  if (!type) errors.type = "invalid";
  const kind: QuestionType = type ?? "mcq";

  const subjectId = (input.subjectId ?? "").trim();
  if (!subjectId) errors.subjectId = "required";
  const chapterId = (input.chapterId ?? "").trim() || null;
  // A sub-chapter only within a chapter.
  const topicId = (chapterId && (input.topicId ?? "").trim()) || null;

  const stem = richField(input, "stem", 4000, errors, { required: true });
  let body: QuestionBody;
  switch (kind) {
    case "mcq":
      body = { stem, ...parseOptions(input, errors) };
      break;
    case "mcq_multi": {
      const statements: RichText[] = [];
      for (let i = 0; i < MAX_STATEMENTS; i++) {
        const value = richField(input, `statement${i}`, 600, errors, { required: i < MIN_STATEMENTS, mode: "inline" });
        if (value) statements.push(value);
      }
      body = { stem, statements, prompt: text(input, "prompt", 200, errors), ...parseOptions(input, errors) };
      break;
    }
    case "short":
      body = { stem, modelAnswer: richField(input, "modelAnswer", 4000, errors) };
      break;
    case "creative":
      body = {
        stem,
        parts: Array.from({ length: CREATIVE_PART_COUNT }, (_, i) => ({
          text: richField(input, `part${i}`, 2000, errors, { required: true }),
          marks: parseMarks(input, i, errors),
          solution: richField(input, `solution${i}`, 6000, errors),
        })),
      };
      break;
    case "textbook":
    case "practice":
      body = {
        stem,
        finalAnswer: richField(input, "finalAnswer", 300, errors, { mode: "inline" }),
        solution: richField(input, "solution", 8000, errors),
      };
      break;
  }

  const board = oneOf(input.board, BOARDS) ?? "";
  const question = {
    type: kind,
    subjectId,
    chapterId,
    topicId,
    visibility: oneOf(input.visibility, VISIBILITIES) ?? "public",
    body,
    board,
    difficulty: oneOf(input.difficulty, DIFFICULTIES) ?? "",
    year: parseYear(input, errors),
    source: text(input, "source", 120, errors),
    videoUrl: url(input, "videoUrl", errors, YOUTUBE),
    /** An uploaded image to attach (a media id), or null for none. */
    imageId: (input.imageId ?? "").trim() || null,
  };
  return { question, errors };
}

export type QuestionInput = ReturnType<typeof parseQuestion>["question"];

/** Every rich text field of a question, changed by `fix` (the rest of the body stays as it is). */
export function mapQuestionText(body: QuestionBody, fix: (value: RichText) => RichText): QuestionBody {
  const out: QuestionBody = { ...body, stem: fix(body.stem) };
  if (body.statements) out.statements = body.statements.map((value) => fix(value));
  if (body.options) out.options = body.options.map((value) => fix(value));
  if (body.explanation !== undefined) out.explanation = fix(body.explanation);
  if (body.modelAnswer !== undefined) out.modelAnswer = fix(body.modelAnswer);
  if (body.parts) out.parts = body.parts.map((part) => ({ ...part, text: fix(part.text), solution: fix(part.solution) }));
  if (body.finalAnswer !== undefined) out.finalAnswer = fix(body.finalAnswer);
  if (body.solution !== undefined) out.solution = fix(body.solution);
  return out;
}

/** The media ids of every picture in a question's text. */
export function questionImageIds(body: QuestionBody): string[] {
  const ids: string[] = [];
  mapQuestionText(body, (value) => {
    ids.push(...richImageIds(value));
    return value;
  });
  return ids;
}
