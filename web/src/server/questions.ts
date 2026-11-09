import { type SQL, and, asc, count, desc, eq, ilike, inArray, isNull, ne, sql } from "drizzle-orm";
import type { Database } from "@/server/db";
import { chapters, courses, questions } from "@/server/db/schema";
import { isUuid } from "@/lib/ids";
import { type QuestionInput, type QuestionType, isMcq } from "@/lib/questions";
import { getMedia } from "./media";
import { renumber, swapped } from "./ordering";

// Like courses, every function takes the teacher's id from the session and filters on it: another
// teacher's question, course, chapter or image id simply isn't found.

export type Question = typeof questions.$inferSelect;

export type QuestionFilters = {
  courseId?: string;
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
  | { ok: false; reason: "missing" | "course" | "chapter" | "image" };

/** A LIKE pattern that matches `term` literally. */
function contains(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function sameGroup(teacherId: string, courseId: string, chapterId: string | null): SQL {
  return and(
    eq(questions.teacherId, teacherId),
    eq(questions.courseId, courseId),
    chapterId ? eq(questions.chapterId, chapterId) : isNull(questions.chapterId),
  )!;
}

/** Whether the course, and the chapter if given, are this teacher's and belong together. */
async function placementProblem(
  db: Database,
  teacherId: string,
  courseId: string,
  chapterId: string | null,
): Promise<"course" | "chapter" | null> {
  if (!isUuid(courseId)) return "course";
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.teacherId, teacherId)))
    .limit(1);
  if (!course) return "course";
  if (chapterId === null) return null;
  if (!isUuid(chapterId)) return "chapter";
  const [chapter] = await db
    .select({ id: chapters.id })
    .from(chapters)
    .where(and(eq(chapters.id, chapterId), eq(chapters.courseId, courseId), eq(chapters.teacherId, teacherId)))
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
    courseId: input.courseId,
    chapterId: input.chapterId,
    type: input.type,
    visibility: input.visibility,
    board: input.board,
    year: input.year,
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

/** Adds a question at the end of its chapter (or of the course's unfiled questions). */
export async function createQuestion(db: Database, teacherId: string, input: QuestionInput): Promise<SaveQuestionResult> {
  const problem = await placementProblem(db, teacherId, input.courseId, input.chapterId);
  if (problem) return { ok: false, reason: problem };
  const image = await resolveImage(db, teacherId, input.imageId);
  if (image === false) return { ok: false, reason: "image" };
  return db.transaction(async (tx) => {
    const [{ last }] = await tx
      .select({ last: sql<number>`coalesce(max(${questions.position}), -1)` })
      .from(questions)
      .where(sameGroup(teacherId, input.courseId, input.chapterId));
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
  const problem = await placementProblem(db, teacherId, input.courseId, input.chapterId);
  if (problem) return { ok: false, reason: problem };
  const image =
    input.imageId && input.imageId === current.body.image?.mediaId
      ? current.body.image
      : await resolveImage(db, teacherId, input.imageId);
  if (image === false) return { ok: false, reason: "image" };

  return db.transaction(async (tx) => {
    let position = current.position;
    if (current.courseId !== input.courseId || current.chapterId !== input.chapterId) {
      const [{ last }] = await tx
        .select({ last: sql<number>`coalesce(max(${questions.position}), -1)` })
        .from(questions)
        .where(sameGroup(teacherId, input.courseId, input.chapterId));
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
      .where(sameGroup(teacherId, source.courseId, source.chapterId));
    const [copy] = await tx
      .insert(questions)
      .values({
        teacherId,
        courseId: source.courseId,
        chapterId: source.chapterId,
        type: source.type,
        visibility: source.visibility,
        body: source.body,
        board: source.board,
        year: source.year,
        source: source.source,
        videoUrl: source.videoUrl,
        position: Number(last) + 1,
      })
      .returning();
    return copy;
  });
}

/** Moves a question one place up or down within its chapter. */
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
    .where(sameGroup(teacherId, question.courseId, question.chapterId))
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
  if (filters.courseId && isUuid(filters.courseId)) conditions.push(eq(questions.courseId, filters.courseId));
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

/** Public questions per chapter of a course, so the website can link chapters that have some. */
export async function publicCountsByChapter(db: Database, teacherId: string, courseId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ chapterId: questions.chapterId, n: count() })
    .from(questions)
    .where(and(eq(questions.teacherId, teacherId), eq(questions.courseId, courseId), eq(questions.visibility, "public")))
    .groupBy(questions.chapterId);
  return new Map(rows.filter((r) => r.chapterId).map((r) => [r.chapterId!, Number(r.n)]));
}

/** The tabs of a chapter page: MCQ (both kinds), short, creative, problem, and board questions. */
export const CHAPTER_TABS = ["mcq", "short", "creative", "problem", "board"] as const;
export type ChapterTab = (typeof CHAPTER_TABS)[number];

function tabCondition(tab: ChapterTab): SQL {
  if (tab === "mcq") return inArray(questions.type, ["mcq", "mcq_multi"]);
  if (tab === "board") return ne(questions.board, "");
  return eq(questions.type, tab);
}

export type ChapterQuestions = {
  items: Question[];
  total: number;
  counts: Record<ChapterTab, number>;
  /** Boards and years that board questions in this chapter come from, for the filters. */
  boards: string[];
  years: number[];
};

/** What a chapter's public page shows: one tab's public questions, a page at a time. */
export async function listChapterQuestions(
  db: Database,
  teacherId: string,
  chapterId: string,
  options: { tab: ChapterTab; board?: string; year?: number; page?: number },
): Promise<ChapterQuestions> {
  const base = and(eq(questions.teacherId, teacherId), eq(questions.chapterId, chapterId), eq(questions.visibility, "public"))!;
  const conditions: SQL[] = [base, tabCondition(options.tab)];
  if (options.board) conditions.push(eq(questions.board, options.board));
  if (options.year) conditions.push(eq(questions.year, options.year));
  const where = and(...conditions);
  const page = Math.max(1, Math.floor(options.page ?? 1));

  const [items, [{ total }], typeRows, boardRows] = await Promise.all([
    db
      .select()
      .from(questions)
      .where(where)
      .orderBy(asc(questions.position), asc(questions.createdAt))
      .limit(CHAPTER_PAGE_SIZE)
      .offset((page - 1) * CHAPTER_PAGE_SIZE),
    db.select({ total: count() }).from(questions).where(where),
    db.select({ type: questions.type, n: count() }).from(questions).where(base).groupBy(questions.type),
    db
      .selectDistinct({ board: questions.board, year: questions.year })
      .from(questions)
      .where(and(base, ne(questions.board, ""))),
  ]);

  const byType = new Map(typeRows.map((r) => [r.type, Number(r.n)]));
  const counts: Record<ChapterTab, number> = {
    mcq: (byType.get("mcq") ?? 0) + (byType.get("mcq_multi") ?? 0),
    short: byType.get("short") ?? 0,
    creative: byType.get("creative") ?? 0,
    problem: byType.get("problem") ?? 0,
    board: 0,
  };
  if (boardRows.length > 0) {
    const [{ n }] = await db.select({ n: count() }).from(questions).where(and(base, ne(questions.board, "")));
    counts.board = Number(n);
  }
  return {
    items,
    total: Number(total),
    counts,
    boards: [...new Set(boardRows.map((r) => r.board))],
    years: [...new Set(boardRows.map((r) => r.year).filter((y): y is number => y !== null))].sort((a, b) => b - a),
  };
}

/** MCQ-type questions are the ones exams and OMR papers can use. */
export function isMcqQuestion(q: Pick<Question, "type">): boolean {
  return isMcq(q.type);
}
