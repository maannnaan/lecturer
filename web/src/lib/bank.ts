import { type FieldErrors, type Input, text } from "./form-input";
import { isUuid } from "./ids";

/** How many chapters one pasted list may add. */
export const MAX_CHAPTERS_AT_ONCE = 60;
export const CHAPTER_TITLE_MAX = 160;

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value ?? "") ? (value as T) : fallback;
}

// "অধ্যায় ৪: ", "Chapter 3 – ", "৪.১ ", "4.2.1) ", "৪. ", "3) ", "- ", "• ": numbering and bullets copied from a contents page.
// "য়" is written either as one character or as য + nukta, so "অধ্যায়" accepts both.
const NUMBERING =
  /^\s*(?:[-–—•*·]\s+|(?:অধ্যা(?:য়|য়)|chapter)\s*[0-9০-৯]+\s*[.:)\-–—।]?\s*|[0-9০-৯]+(?:\.[0-9০-৯]+)+\s*[.:)\-–—।]?\s+|[0-9০-৯]+\s*[.:)\-–—।](?![0-9০-৯])\s*)/iu;

/**
 * Chapter titles from a pasted list, one per line, as a teacher would copy them from the
 * textbook's contents page. Numbering and bullets are dropped; the order is the chapters' order.
 */
export function chapterLines(raw: string, errors: FieldErrors, name = "chapters"): string[] {
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(NUMBERING, "").trim())
    .filter(Boolean);
  if (lines.length > MAX_CHAPTERS_AT_ONCE || lines.some((line) => [...line].length > CHAPTER_TITLE_MAX)) errors[name] = "tooLong";
  return lines.slice(0, MAX_CHAPTERS_AT_ONCE).map((line) => [...line].slice(0, CHAPTER_TITLE_MAX).join(""));
}

/**
 * The groups a class's subjects can belong to (বিজ্ঞান, ব্যবসায় শিক্ষা, মানবিক, and the subjects
 * every group takes). A class page shows them as tabs when its subjects span more than one. ""
 * means no group. Names live in the dictionaries under `bankGroups`.
 */
export const SUBJECT_GROUPS = ["common", "science", "business", "humanities"] as const;
export type SubjectGroup = (typeof SUBJECT_GROUPS)[number];

/** A class in the question bank: the name the teacher gives it, e.g. "দশম শ্রেণি". */
export function parseBankClass(input: Input) {
  const errors: FieldErrors = {};
  const bankClass = { name: text(input, "name", 60, errors, true).replace(/\s+/g, " ") };
  return { bankClass, errors };
}

/** Whether two class names read the same: letter case, spacing and the two ways to write য় aside. */
export function sameClassName(a: string, b: string): boolean {
  const key = (name: string) => name.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
  return key(a) === key(b);
}

/** A bank subject's class, group and name, and the chapters to start it with (one per line). */
export function parseSubject(input: Input) {
  const errors: FieldErrors = {};
  const classId = (input.classId ?? "").trim();
  if (!classId) errors.classId = "required";
  else if (!isUuid(classId)) errors.classId = "invalid";
  const subject = {
    classId,
    group: oneOf<SubjectGroup | "">(input.group, SUBJECT_GROUPS, ""),
    name: text(input, "name", 80, errors, true),
  };
  const chapters = chapterLines(input.chapters ?? "", errors);
  return { subject, chapters, errors };
}

export function parseBankChapter(input: Input) {
  const errors: FieldErrors = {};
  const chapter = {
    label: text(input, "label", 30, errors),
    title: text(input, "title", CHAPTER_TITLE_MAX, errors, true),
  };
  return { chapter, errors };
}

/** A sub-chapter's new name. */
export function parseBankTopic(input: Input) {
  const errors: FieldErrors = {};
  const title = text(input, "title", CHAPTER_TITLE_MAX, errors, true);
  return { title, errors };
}

export type BankClassInput =ReturnType<typeof parseBankClass>["bankClass"];
export type SubjectInput = ReturnType<typeof parseSubject>["subject"];
export type BankChapterInput = ReturnType<typeof parseBankChapter>["chapter"];
