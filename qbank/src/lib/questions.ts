import type { BoardTag, Difficulty, QType, Question } from "./types";

/* Pure helpers shared by the server pages and the interactive question lists. */

export type TabKey = "cq" | "mcq" | "sq" | "board";
export const TAB_KEYS: TabKey[] = ["cq", "mcq", "sq", "board"];
export const QTYPES: QType[] = ["CQ", "MCQ", "SQ"];

export function typeOfTab(tab: Exclude<TabKey, "board">): QType {
  return tab.toUpperCase() as QType;
}

export function tabOfType(type: QType): Exclude<TabKey, "board"> {
  return type.toLowerCase() as Exclude<TabKey, "board">;
}

export function parseTab(raw: string | null | undefined): TabKey {
  const value = raw?.toLowerCase();
  return TAB_KEYS.includes(value as TabKey) ? (value as TabKey) : "cq";
}

export function parseType(raw: string | null | undefined): QType | null {
  const value = raw?.toUpperCase();
  return QTYPES.includes(value as QType) ? (value as QType) : null;
}

/* ── Sources: a board question, a school or model test, or a practice question ─────────── */

export type SourceKey = "board" | "school" | "practice";
export const SOURCE_KEYS: SourceKey[] = ["board", "school", "practice"];
/** The mockup opens with "Board questions" and "Top school tests" ticked. */
export const DEFAULT_SOURCES: SourceKey[] = ["board", "school"];
export const SOURCE_LABELS: Record<SourceKey, string> = {
  board: "Board questions",
  school: "Top school tests",
  practice: "Practice (unpublished)",
};

export function sourceOf(q: Question): SourceKey {
  if (q.boards.length > 0) return "board";
  if (q.source) return "school";
  return "practice";
}

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export function parseDifficulty(raw: string | null | undefined): Difficulty | null {
  const value = raw?.toLowerCase();
  return DIFFICULTIES.includes(value as Difficulty) ? (value as Difficulty) : null;
}

/* ── Filters ───────────────────────────────────────────────────────────────────────────── */

/** A year, or "older" for anything before the oldest year the site lists. */
export type YearFilter = number | "older" | null;

export interface QuestionFilters {
  sources: SourceKey[];
  board: string | null;
  year: YearFilter;
  difficulty: Difficulty | null;
}

export const DEFAULT_FILTERS: QuestionFilters = {
  sources: DEFAULT_SOURCES,
  board: null,
  year: null,
  difficulty: null,
};

export function parseYear(raw: string | null | undefined): YearFilter {
  if (!raw) return null;
  if (raw.toLowerCase() === "older") return "older";
  return /^\d{4}$/.test(raw) ? Number(raw) : null;
}

/** Matches a board name case-insensitively against the known boards. */
export function parseBoard(raw: string | null | undefined, boards: string[]): string | null {
  if (!raw) return null;
  return boards.find((b) => b.toLowerCase() === raw.toLowerCase()) ?? null;
}

export function parseSources(raw: string | null | undefined): SourceKey[] {
  if (raw === null || raw === undefined) return DEFAULT_SOURCES;
  const picked = raw.split(",").map((s) => s.trim().toLowerCase());
  return SOURCE_KEYS.filter((k) => picked.includes(k));
}

export function sameSources(a: SourceKey[], b: SourceKey[]): boolean {
  return a.length === b.length && a.every((k) => b.includes(k));
}

export function tagMatches(tag: BoardTag, f: Pick<QuestionFilters, "board" | "year">, olderThan: number): boolean {
  if (f.board && tag.board.toLowerCase() !== f.board.toLowerCase()) return false;
  if (f.year === "older") return tag.year < olderThan;
  if (typeof f.year === "number") return tag.year === f.year;
  return true;
}

export function matchesFilters(q: Question, f: QuestionFilters, olderThan: number): boolean {
  if (!f.sources.includes(sourceOf(q))) return false;
  if (f.difficulty && q.difficulty !== f.difficulty) return false;
  if (f.board || f.year) return q.boards.some((tag) => tagMatches(tag, f, olderThan));
  return true;
}

export function activeFilterCount(f: QuestionFilters): number {
  return (
    (sameSources(f.sources, DEFAULT_SOURCES) ? 0 : 1) + (f.board ? 1 : 0) + (f.year ? 1 : 0) + (f.difficulty ? 1 : 0)
  );
}

/* ── Counting and labels ───────────────────────────────────────────────────────────────── */

export function countByTab(questions: Question[]): Record<TabKey, number> {
  const counts: Record<TabKey, number> = { cq: 0, mcq: 0, sq: 0, board: 0 };
  for (const q of questions) {
    counts[tabOfType(q.type)] += 1;
    if (q.boards.length > 0) counts.board += 1;
  }
  return counts;
}

/** "Dhaka Board · 2024" */
export function tagLabel(tag: BoardTag): string {
  return `${tag.board} Board · ${tag.year}`;
}

/** The yellow tags on a question card: its boards, or the test it came from. */
export function cardTags(q: Question): string[] {
  if (q.boards.length > 0) return q.boards.map(tagLabel);
  return q.source ? [q.source] : [];
}

export function totalMarks(q: Question): number {
  return (q.parts ?? []).reduce((sum, p) => sum + p.marks, 0);
}

export const OPTION_KEYS = ["a", "b", "c", "d", "e", "f"];

/** One line of text for list rows: the stem of a CQ, the question otherwise. */
export function previewText(q: Question): string {
  return (q.type === "CQ" ? q.stem : q.text)?.replace(/\s+/g, " ").trim() ?? "";
}

/** Everything a search should look through, lower-cased. */
export function searchableText(q: Question): string {
  return [
    q.stem,
    q.text,
    q.answer,
    q.explanation,
    q.source,
    ...(q.options ?? []),
    ...(q.parts ?? []).flatMap((p) => [p.text, p.answer]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function domId(q: Pick<Question, "id">): string {
  return `q-${q.id}`;
}
