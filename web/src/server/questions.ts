import { type SQL, and, asc, count, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { Database } from "@/server/db";
import { bankChapters, bankSubjects, questions } from "@/server/db/schema";
import { type CountRow, type TabCounts, emptyCounts } from "@/lib/bank-tree";
import { isUuid } from "@/lib/ids";
import {
  BOARDS,
  type BankTab,
  type ChapterFilters,
  type QuestionInput,
  type QuestionType,
  isMcq,
  tabOf,
  tabTypes,
} from "@/lib/questions";
import { getMedia } from "./media";
import { renumber, swapped } from "./ordering";

// Like courses, every function takes the teacher's id from the session and filters on it: another
// teacher's question, subject, chapter or image id simply isn't found.

export type Question = typeof questions.$inferSelect;

export type QuestionFilters = {
  subjectId?: string;
  /** A chapter id, or "none" for questions filed under no chapter. */
  chapterId?: string;
  type?: QuestionType;
  /** A board key, or "any" for every board question. */
  board?: string;
  visibility?: "public" | "private";
  search?: string;
  /** 1-based. */
  page?: number;
};

export const BANK_PAGE_SIZE = 30;
export const CHAPTER_PAGE_SIZE = 20;

export type SaveQuestionResult =
  | { ok: true; question: Question }
  | { ok: false; reason: "missing" | "subject" | "chapter" | "image" };

/** A LIKE pattern that matches `term` literally. */
function contains(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function sameGroup(teacherId: string, subjectId: string, chapterId: string | null): SQL {
  return and(
    eq(questions.teacherId, teacherId),
    eq(questions.subjectId, subjectId),
    chapterId ? eq(questions.chapterId, chapterId) : isNull(questions.chapterId),
  )!;
}

/** Whether the subject, and the chapter if given, are this teacher's and belong together. */
async function placementProblem(
  db: Database,
  teacherId: string,
  subjectId: string,
  chapterId: string | null,
): Promise<"subject" | "chapter" | null> {
  if (!isUuid(subjectId)) return "subject";
  const [subject] = await db
    .select({ id: bankSubjects.id })
    .from(bankSubjects)
    .where(and(eq(bankSubjects.id, subjectId), eq(bankSubjects.teacherId, teacherId)))
    .limit(1);
  if (!subject) return "subject";
  if (chapterId === null) return null;
  if (!isUuid(chapterId)) return "chapter";
  const [chapter] = await db
    .select({ id: bankChapters.id })
    .from(bankChapters)
    .where(and(eq(bankChapters.id, chapterId), eq(bankChapters.subjectId, subjectId), eq(bankChapters.teacherId, teacherId)))
    .limit(1);
  return chapter ? null : "chapter";
}

/** The image to store for a media id: null for none, false when it isn't this teacher's. */
async function resolveImage(db: Database, teacherId: string, imageId: string | null) {
  if (!imageId) return null;
  const found = await getMedia(db, teacherId, imageId);
  return found ? { mediaId: found.id, url: found.url } : false;
}

function columns(input: QuestionInput) {
  return {
    subjectId: input.subjectId,
    chapterId: input.chapterId,
    type: input.type,
    visibility: input.visibility,
    board: input.board,
    year: input.year,
    difficulty: input.difficulty,
    source: input.source,
    videoUrl: input.videoUrl,
  };
}

export async function getQuestion(db: Database, teacherId: string, questionId: string): Promise<Question | null> {
  if (!isUuid(questionId)) return null;
  const [row] = await db
    .select()
    .from(questions)
    .where(and(eq(questions.id, questionId), eq(questions.teacherId, teacherId)))
    .limit(1);
  return row ?? null;
}

/** Adds a question at the end of its chapter (or of the subject's unfiled questions). */
export async function createQuestion(db: Database, teacherId: string, input: QuestionInput): Promise<SaveQuestionResult> {
  const problem = await placementProblem(db, teacherId, input.subjectId, input.chapterId);
  if (problem) return { ok: false, reason: problem };
  const image = await resolveImage(db, teacherId, input.imageId);
  if (image === false) return { ok: false, reason: "image" };
  return db.transaction(async (tx) => {
    const [{ last }] = await tx
      .select({ last: sql<number>`coalesce(max(${questions.position}), -1)` })
      .from(questions)
      .where(sameGroup(teacherId, input.subjectId, input.chapterId));
    const [question] = await tx
      .insert(questions)
      .values({ ...columns(input), teacherId, body: { ...input.body, image }, position: Number(last) + 1 })
      .returning();
    return { ok: true as const, question };
  });
}

/** Saves an edit. A question moved to another chapter goes to the end of that chapter. */
export async function updateQuestion(
  db: Database,
  teacherId: string,
  questionId: string,
  input: QuestionInput,
): Promise<SaveQuestionResult> {
  const current = await getQuestion(db, teacherId, questionId);
  if (!current) return { ok: false, reason: "missing" };
  const problem = await placementProblem(db, teacherId, input.subjectId, input.chapterId);
  if (problem) return { ok: false, reason: problem };
  const image =
    input.imageId && input.imageId === current.body.image?.mediaId
      ? current.body.image
      : await resolveImage(db, teacherId, input.imageId);
  if (image === false) return { ok: false, reason: "image" };

  return db.transaction(async (tx) => {
    let position = current.position;
    if (current.subjectId !== input.subjectId || current.chapterId !== input.chapterId) {
      const [{ last }] = await tx
        .select({ last: sql<number>`coalesce(max(${questions.position}), -1)` })
        .from(questions)
        .where(sameGroup(teacherId, input.subjectId, input.chapterId));
      position = Number(last) + 1;
    }
    const [question] = await tx
      .update(questions)
      .set({ ...columns(input), body: { ...input.body, image }, position })
      .where(and(eq(questions.id, questionId), eq(questions.teacherId, teacherId)))
      .returning();
    return { ok: true as const, question };
  });
}

export async function deleteQuestion(db: Database, teacherId: string, questionId: string): Promise<boolean> {
  if (!isUuid(questionId)) return false;
  const gone = await db
    .delete(questions)
    .where(and(eq(questions.id, questionId), eq(questions.teacherId, teacherId)))
    .returning({ id: questions.id });
  return gone.length > 0;
}

/** A copy of the question at the end of the same chapter, for writing a similar one quickly. */
export async function duplicateQuestion(db: Database, teacherId: string, questionId: string): Promise<Question | null> {
  const source = await getQuestion(db, teacherId, questionId);
  if (!source) return null;
  return db.transaction(async (tx) => {
    const [{ last }] = await tx
      .select({ last: sql<number>`coalesce(max(${questions.position}), -1)` })
      .from(questions)
      .where(sameGroup(teacherId, source.subjectId, source.chapterId));
    const [copy] = await tx
      .insert(questions)
      .values({
        teacherId,
        subjectId: source.subjectId,
        chapterId: source.chapterId,
        type: source.type,
        visibility: source.visibility,
        body: source.body,
        board: source.board,
        year: source.year,
        difficulty: source.difficulty,
        source: source.source,
        videoUrl: source.videoUrl,
        position: Number(last) + 1,
      })
      .returning();
    return copy;
  });
}

/**
 * Moves a question one place up or down among its chapter's questions of the same section (MCQ,
 * CQ…): every list shows one section, so that is the order the teacher sees and changes.
 */
export async function moveQuestion(
  db: Database,
  teacherId: string,
  questionId: string,
  direction: "up" | "down",
): Promise<boolean> {
  const question = await getQuestion(db, teacherId, questionId);
  if (!question) return false;
  const group = await db
    .select({ id: questions.id, position: questions.position })
    .from(questions)
    .where(
      and(
        sameGroup(teacherId, question.subjectId, question.chapterId),
        inArray(questions.type, [...tabTypes(tabOf(question.type))]),
      ),
    )
    .orderBy(asc(questions.position), asc(questions.createdAt));
  const order = swapped(group, questionId, direction);
  if (!order) return false;
  await renumber(db, order, (tx, id, position) =>
    tx.update(questions).set({ position }).where(and(eq(questions.id, id), eq(questions.teacherId, teacherId))),
  );
  return true;
}

/** The teacher's bank, filtered and one page at a time. In a single chapter: the teacher's order. */
export async function listQuestions(
  db: Database,
  teacherId: string,
  filters: QuestionFilters = {},
): Promise<{ items: Question[]; total: number }> {
  const conditions: SQL[] = [eq(questions.teacherId, teacherId)];
  if (filters.subjectId && isUuid(filters.subjectId)) conditions.push(eq(questions.subjectId, filters.subjectId));
  if (filters.chapterId === "none") conditions.push(isNull(questions.chapterId));
  else if (filters.chapterId && isUuid(filters.chapterId)) conditions.push(eq(questions.chapterId, filters.chapterId));
  if (filters.type) conditions.push(eq(questions.type, filters.type));
  if (filters.board === "any") conditions.push(ne(questions.board, ""));
  else if (filters.board) conditions.push(eq(questions.board, filters.board));
  if (filters.visibility) conditions.push(eq(questions.visibility, filters.visibility));
  const search = filters.search?.trim();
  if (search) conditions.push(ilike(sql`${questions.body}->>'stem'`, contains(search)));
  const where = and(...conditions);

  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const inChapter = Boolean(filters.chapterId && filters.chapterId !== "none");
  const order = inChapter ? [asc(questions.position), asc(questions.createdAt)] : [desc(questions.createdAt)];
  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(questions)
      .where(where)
      .orderBy(...order)
      .limit(BANK_PAGE_SIZE)
      .offset((page - 1) * BANK_PAGE_SIZE),
    db.select({ total: count() }).from(questions).where(where),
  ]);
  return { items, total: Number(total) };
}

/** How many questions of each type the teacher has, for the bank's summary. */
export async function countByType(db: Database, teacherId: string): Promise<Partial<Record<QuestionType, number>>> {
  const rows = await db
    .select({ type: questions.type, n: count() })
    .from(questions)
    .where(eq(questions.teacherId, teacherId))
    .groupBy(questions.type);
  return Object.fromEntries(rows.map((r) => [r.type, Number(r.n)]));
}

/**
 * How many questions each subject and chapter has of each type, for the bank's class, subject and
 * chapter pages (see buildBankTree). The website counts public questions only.
 */
/** Whether a question is a board question, as a column to count and group by. */
const IS_BOARD = sql<boolean>`${questions.board} <> ''`;

/** The sections' order (textbook problems, practice problems, MCQ, SQ, CQ), for lists that mix them. */
const SECTION_ORDER = sql`case ${questions.type}
  when 'textbook' then 0 when 'practice' then 1 when 'mcq' then 2 when 'mcq_multi' then 2
  when 'short' then 3 when 'creative' then 4 else 5 end`;

export async function bankCounts(db: Database, teacherId: string, options: { publicOnly?: boolean } = {}): Promise<CountRow[]> {
  const conditions: SQL[] = [eq(questions.teacherId, teacherId)];
  if (options.publicOnly) conditions.push(eq(questions.visibility, "public"));
  const rows = await db
    .select({ subjectId: questions.subjectId, chapterId: questions.chapterId, type: questions.type, board: IS_BOARD, n: count() })
    .from(questions)
    .where(and(...conditions))
    .groupBy(questions.subjectId, questions.chapterId, questions.type, IS_BOARD);
  return rows.map((row) => ({ ...row, board: Boolean(row.board), n: Number(row.n) }));
}

/** The conditions a chapter page's filters add (see ChapterFilters). */
function filterConditions(filters: ChapterFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.board === "any") conditions.push(ne(questions.board, ""));
  else if (filters.board) conditions.push(eq(questions.board, filters.board));
  if (filters.year) conditions.push(eq(questions.year, filters.year));
  if (filters.difficulty) conditions.push(eq(questions.difficulty, filters.difficulty));
  if (filters.sources) {
    const any: SQL[] = [];
    if (filters.sources.includes("board")) any.push(ne(questions.board, ""));
    if (filters.sources.includes("school")) any.push(and(eq(questions.board, ""), ne(questions.source, ""))!);
    if (filters.sources.includes("own")) any.push(and(eq(questions.board, ""), eq(questions.source, ""))!);
    conditions.push(any.length > 0 ? or(...any)! : sql`false`);
  }
  return conditions;
}

/** A chapter's questions (public ones only unless `includePrivate`), with the filters applied. */
function chapterConditions(
  teacherId: string,
  place: { subjectId: string; chapterId: string | null },
  options: { filters?: ChapterFilters; includePrivate?: boolean },
): { chapter: SQL; filtered: SQL } {
  const inChapter: SQL[] = [sameGroup(teacherId, place.subjectId, place.chapterId)];
  if (!options.includePrivate) inChapter.push(eq(questions.visibility, "public"));
  const chapter = and(...inChapter)!;
  return { chapter, filtered: and(chapter, ...filterConditions(options.filters ?? {}))! };
}

const validPlace = (place: { subjectId: string; chapterId: string | null }) =>
  isUuid(place.subjectId) && (place.chapterId === null || isUuid(place.chapterId));

export type SectionQuestions = {
  items: Question[];
  total: number;
  /** The page shown: the one asked for (within range), or the one holding the `focus` question. */
  page: number;
  /** How many questions each tab has with the filters applied, for the tabs' counts. */
  counts: TabCounts;
  /** The boards and years the chapter's board questions come from, for the filter menus. */
  boards: string[];
  years: number[];
};

/**
 * One tab of a chapter (its textbook problems, its MCQs…, or its board questions of every type), a
 * page at a time, in the teacher's order, with the chapter page's filters applied. The website sees
 * public questions only; the teacher's bank passes `includePrivate`. `chapterId: null` means the
 * subject's questions filed under no chapter. With `focus` (a question id), the page that holds
 * that question is shown.
 */
export async function listChapterQuestions(
  db: Database,
  teacherId: string,
  place: { subjectId: string; chapterId: string | null },
  options: {
    tab: BankTab;
    filters?: ChapterFilters;
    page?: number;
    pageSize?: number;
    includePrivate?: boolean;
    focus?: string;
  },
): Promise<SectionQuestions> {
  if (!validPlace(place)) return { items: [], total: 0, page: 1, counts: emptyCounts(), boards: [], years: [] };
  const { chapter, filtered } = chapterConditions(teacherId, place, options);
  const where = and(filtered, options.tab === "board" ? ne(questions.board, "") : inArray(questions.type, [...tabTypes(options.tab)]));
  const order = [...(options.tab === "board" ? [SECTION_ORDER] : []), asc(questions.position), asc(questions.createdAt)];
  const size = options.pageSize ?? CHAPTER_PAGE_SIZE;

  const [[{ total }], countRows, boardRows, focusIds] = await Promise.all([
    db.select({ total: count() }).from(questions).where(where),
    db
      .select({ type: questions.type, board: IS_BOARD, n: count() })
      .from(questions)
      .where(filtered)
      .groupBy(questions.type, IS_BOARD),
    db
      .selectDistinct({ board: questions.board, year: questions.year })
      .from(questions)
      .where(and(chapter, ne(questions.board, ""))),
    options.focus && isUuid(options.focus)
      ? db.select({ id: questions.id }).from(questions).where(where).orderBy(...order)
      : Promise.resolve(null),
  ]);

  const pages = Math.max(1, Math.ceil(Number(total) / size));
  let page = Math.min(pages, Math.max(1, Math.floor(options.page ?? 1)));
  const at = focusIds?.findIndex((row) => row.id === options.focus) ?? -1;
  if (at >= 0) page = Math.floor(at / size) + 1;

  const items = await db
    .select()
    .from(questions)
    .where(where)
    .orderBy(...order)
    .limit(size)
    .offset((page - 1) * size);

  const counts = emptyCounts();
  for (const row of countRows) {
    counts[tabOf(row.type)] += Number(row.n);
    if (row.board) counts.board += Number(row.n);
  }
  const boards = new Set(boardRows.map((r) => r.board));
  return {
    items,
    total: Number(total),
    page,
    counts,
    boards: BOARDS.filter((b) => boards.has(b)),
    years: [...new Set(boardRows.map((r) => r.year).filter((y): y is number => y !== null))].sort((a, b) => b - a),
  };
}

/** The most questions one printout holds. */
export const PRINT_LIMIT = 500;

/**
 * Everything a chapter's printout holds: the questions the filters show, every section in order
 * (or only the board questions), with no paging.
 */
export async function listChapterForPrint(
  db: Database,
  teacherId: string,
  place: { subjectId: string; chapterId: string | null },
  options: { boardOnly?: boolean; filters?: ChapterFilters; includePrivate?: boolean },
): Promise<Question[]> {
  if (!validPlace(place)) return [];
  const { filtered } = chapterConditions(teacherId, place, options);
  return db
    .select()
    .from(questions)
    .where(options.boardOnly ? and(filtered, ne(questions.board, "")) : filtered)
    .orderBy(SECTION_ORDER, asc(questions.position), asc(questions.createdAt))
    .limit(PRINT_LIMIT);
}

/** MCQ-type questions are the ones exams and OMR papers can use. */
export function isMcqQuestion(q: Pick<Question, "type">): boolean {
  return isMcq(q.type);
}
