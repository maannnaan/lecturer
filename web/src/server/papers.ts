import { randomInt } from "node:crypto";
import { type SQL, and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { isUuid } from "@/lib/ids";
import { decodeMarks, gradeSheet } from "@/lib/omr";
import { MAX_PAPER_MCQS, MAX_PAPER_WRITTEN, type PaperInput, setCodes, setKey, setOrder } from "@/lib/papers";
import { type BankTab, OPTION_COUNT, type QuestionType, isMcq, tabTypes } from "@/lib/questions";
import type { Database } from "@/server/db";
import { type PaperQuestionSnapshot, batches, courses, paperQuestions, paperResults, papers, questions, teachers } from "@/server/db/schema";
import { ownCourseAndBatch } from "./exams";
import { type Tx, renumber, swapped } from "./ordering";

// Question papers to print. Every function takes the teacher's id and filters on it. A draft's
// questions are read from the bank as they are now; making a paper final freezes them, and with
// them every set's order and answer key, which then never change.

export type Paper = typeof papers.$inferSelect;
export type PaperSection = "mcq" | "written";
export type PaperRow = Paper & { courseTitle: string; batchName: string | null; mcqCount: number; writtenCount: number };

/** Why a paper's change was refused. */
export type PaperRefusal = "course" | "batch" | "locked" | "noQuestions" | "missing";

/** MCQs go to the paper's MCQ part, answered on the OMR sheet; everything else is written. */
export const sectionOf = (type: QuestionType): PaperSection => (isMcq(type) ? "mcq" : "written");
const ROOM: Record<PaperSection, number> = { mcq: MAX_PAPER_MCQS, written: MAX_PAPER_WRITTEN };

export async function listPapers(db: Database, teacherId: string): Promise<PaperRow[]> {
  const [rows, counts] = await Promise.all([
    db
      .select({ paper: papers, courseTitle: courses.title, batchName: batches.name })
      .from(papers)
      .innerJoin(courses, eq(courses.id, papers.courseId))
      .leftJoin(batches, eq(batches.id, papers.batchId))
      .where(eq(papers.teacherId, teacherId))
      .orderBy(desc(papers.number)),
    db
      .select({ paperId: paperQuestions.paperId, section: paperQuestions.section, n: count() })
      .from(paperQuestions)
      .innerJoin(papers, eq(papers.id, paperQuestions.paperId))
      .where(eq(papers.teacherId, teacherId))
      .groupBy(paperQuestions.paperId, paperQuestions.section),
  ]);
  const countOf = (paperId: string, section: PaperSection) => Number(counts.find((c) => c.paperId === paperId && c.section === section)?.n ?? 0);
  return rows.map(({ paper, ...names }) => ({ ...paper, ...names, mcqCount: countOf(paper.id, "mcq"), writtenCount: countOf(paper.id, "written") }));
}

export async function getPaper(db: Database, teacherId: string, paperId: string): Promise<Paper | null> {
  if (!isUuid(paperId)) return null;
  const [row] = await db
    .select()
    .from(papers)
    .where(and(eq(papers.id, paperId), eq(papers.teacherId, teacherId)))
    .limit(1);
  return row ?? null;
}

/** A new paper, as a draft, with the next paper number and its own seed for shuffling the sets. */
export async function createPaper(db: Database, teacherId: string, input: PaperInput): Promise<{ ok: true; paper: Paper } | { ok: false; reason: PaperRefusal }> {
  const problem = await ownCourseAndBatch(db, teacherId, input.courseId, input.batchId);
  if (problem) return { ok: false, reason: problem };
  return db.transaction(async (tx) => {
    const [{ number }] = await tx
      .update(teachers)
      .set({ paperCounter: sql`${teachers.paperCounter} + 1` })
      .where(eq(teachers.id, teacherId))
      .returning({ number: teachers.paperCounter });
    const [paper] = await tx
      .insert(papers)
      .values({ ...input, teacherId, number, seed: randomInt(1, 2 ** 31 - 1) })
      .returning();
    return { ok: true as const, paper };
  });
}

/** Whether any answer sheet of the paper is in: from then on it stays final, and its audience stays as it is. */
export async function hasResults(db: Database | Tx, paperId: string): Promise<boolean> {
  if (!isUuid(paperId)) return false;
  const [row] = await db.select({ id: paperResults.id }).from(paperResults).where(eq(paperResults.paperId, paperId)).limit(1);
  return Boolean(row);
}

/** Every set's answer key of a paper, by set code. */
export async function paperKeys(db: Database, teacherId: string, paper: Paper): Promise<Map<number, number[]>> {
  const sets = paperSets(paper, await listPaperQuestions(db, teacherId, paper.id), setCodes(paper));
  return new Map(sets.map((set) => [set.code, set.key]));
}

/** Marks every sheet of a paper again from what was marked on it: after the paper's marking changed. */
export async function regradePaper(db: Database, teacherId: string, paper: Paper): Promise<void> {
  const keys = await paperKeys(db, teacherId, paper);
  const rows = await db
    .select({ id: paperResults.id, setCode: paperResults.setCode, marks: paperResults.marks })
    .from(paperResults)
    .where(and(eq(paperResults.paperId, paper.id), eq(paperResults.teacherId, teacherId)));
  if (rows.length === 0) return;
  await db.transaction(async (tx) => {
    for (const row of rows) {
      const score = gradeSheet(decodeMarks(row.marks), keys.get(row.setCode) ?? [], paper);
      await tx
        .update(paperResults)
        .set({ correct: score.correct, wrong: score.wrong, blank: score.blank, doubled: score.double, scoreHundredths: score.scoreHundredths })
        .where(eq(paperResults.id, row.id));
    }
  });
}

/**
 * Changes a paper's settings. A final paper may already be printed, so what decides its sets (how
 * many, and what is shuffled) stays as it was; once its sheets are coming in, so does who it is
 * for (their rolls name the sheets). Its header and marking can still change: a change in the
 * marking marks every sheet again.
 */
export async function updatePaper(db: Database, teacherId: string, paperId: string, input: PaperInput): Promise<{ ok: true; paper: Paper } | { ok: false; reason: PaperRefusal }> {
  const current = await getPaper(db, teacherId, paperId);
  if (!current) return { ok: false, reason: "missing" };
  const resulted = current.status === "final" && (await hasResults(db, paperId));
  let settings = input;
  if (current.status === "final") settings = { ...settings, setCount: current.setCount, shuffleQuestions: current.shuffleQuestions, shuffleOptions: current.shuffleOptions };
  if (resulted) settings = { ...settings, courseId: current.courseId, batchId: current.batchId };
  const problem = await ownCourseAndBatch(db, teacherId, settings.courseId, settings.batchId);
  if (problem) return { ok: false, reason: problem };
  const [paper] = await db
    .update(papers)
    .set(settings)
    .where(and(eq(papers.id, paperId), eq(papers.teacherId, teacherId)))
    .returning();
  if (resulted && (paper.markHundredths !== current.markHundredths || paper.negativeHundredths !== current.negativeHundredths)) await regradePaper(db, teacherId, paper);
  return { ok: true, paper };
}

/** Deletes a paper with its questions. */
export async function deletePaper(db: Database, teacherId: string, paperId: string): Promise<boolean> {
  if (!isUuid(paperId)) return false;
  const gone = await db
    .delete(papers)
    .where(and(eq(papers.id, paperId), eq(papers.teacherId, teacherId)))
    .returning({ id: papers.id });
  return gone.length > 0;
}

/** A question of a paper: as frozen when it was made final, or (in a draft) as the bank has it now. */
export type PaperQuestion = { id: string; questionId: string | null; section: PaperSection; position: number; question: PaperQuestionSnapshot | null };

/** The paper's questions, the MCQs first, each part in the teacher's order. */
export async function listPaperQuestions(db: Database, teacherId: string, paperId: string): Promise<PaperQuestion[]> {
  if (!isUuid(paperId)) return [];
  const rows = await db
    .select({
      id: paperQuestions.id,
      questionId: paperQuestions.questionId,
      section: paperQuestions.section,
      position: paperQuestions.position,
      snapshot: paperQuestions.snapshot,
      type: questions.type,
      body: questions.body,
    })
    .from(paperQuestions)
    .innerJoin(papers, eq(papers.id, paperQuestions.paperId))
    .leftJoin(questions, eq(questions.id, paperQuestions.questionId))
    .where(and(eq(paperQuestions.paperId, paperId), eq(papers.teacherId, teacherId)))
    .orderBy(asc(paperQuestions.section), asc(paperQuestions.position), asc(paperQuestions.id));
  return rows.map((row) => ({
    id: row.id,
    questionId: row.questionId,
    section: row.section,
    position: row.position,
    question: row.snapshot ?? (row.type && row.body ? { type: row.type, body: row.body } : null),
  }));
}

/**
 * Adds bank questions to a draft paper, each at the end of its part: only the teacher's own, each
 * once, up to what each part holds (an OMR sheet's worth of MCQs). Returns how many were added.
 */
export async function addPaperQuestions(db: Database, teacherId: string, paperId: string, questionIds: string[]): Promise<number | PaperRefusal> {
  const paper = await getPaper(db, teacherId, paperId);
  if (!paper) return "missing";
  if (paper.status === "final") return "locked";
  const ids = [...new Set(questionIds.filter(isUuid))];
  if (ids.length === 0) return 0;
  return db.transaction(async (tx) => {
    const present = await tx
      .select({ questionId: paperQuestions.questionId, section: paperQuestions.section, position: paperQuestions.position })
      .from(paperQuestions)
      .where(eq(paperQuestions.paperId, paperId));
    const have = new Set(present.map((row) => row.questionId));
    const room = { mcq: ROOM.mcq, written: ROOM.written };
    const next = { mcq: 0, written: 0 };
    for (const row of present) {
      room[row.section]--;
      next[row.section] = Math.max(next[row.section], row.position + 1);
    }
    const found = await tx
      .select({ id: questions.id, type: questions.type })
      .from(questions)
      .where(and(eq(questions.teacherId, teacherId), inArray(questions.id, ids)));
    const typeOf = new Map(found.map((q) => [q.id, q.type]));
    // In the order they were asked for.
    const adding: { questionId: string; section: PaperSection; position: number }[] = [];
    for (const id of ids) {
      const type = typeOf.get(id);
      if (!type || have.has(id)) continue;
      const section = sectionOf(type);
      if (room[section] <= 0) continue;
      room[section]--;
      adding.push({ questionId: id, section, position: next[section]++ });
    }
    if (adding.length === 0) return 0;
    await tx.insert(paperQuestions).values(adding.map((row) => ({ paperId, ...row })));
    return adding.length;
  });
}

/** The ids of up to `n` of the teacher's questions of one tab, in a chapter (or a whole subject), not yet on the paper, picked at random. */
export async function randomPaperQuestionIds(
  db: Database,
  teacherId: string,
  paperId: string,
  place: { subjectId: string; chapterId: string | null },
  tab: BankTab,
  n: number,
): Promise<string[]> {
  if (!isUuid(paperId) || !isUuid(place.subjectId) || (place.chapterId !== null && !isUuid(place.chapterId)) || tab === "board") return [];
  const conditions: SQL[] = [eq(questions.teacherId, teacherId), eq(questions.subjectId, place.subjectId), inArray(questions.type, [...tabTypes(tab)])];
  if (place.chapterId) conditions.push(eq(questions.chapterId, place.chapterId));
  conditions.push(
    sql`${questions.id} not in (select ${paperQuestions.questionId} from ${paperQuestions} where ${paperQuestions.paperId} = ${paperId} and ${paperQuestions.questionId} is not null)`,
  );
  const rows = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(...conditions))
    .orderBy(sql`random()`)
    .limit(Math.max(0, Math.min(n, MAX_PAPER_MCQS)));
  return rows.map((row) => row.id);
}

/** A question of one of the teacher's papers, with that paper's state. */
async function ownPaperQuestion(db: Database, teacherId: string, paperQuestionId: string) {
  if (!isUuid(paperQuestionId)) return null;
  const [row] = await db
    .select({ paperId: paperQuestions.paperId, section: paperQuestions.section, status: papers.status })
    .from(paperQuestions)
    .innerJoin(papers, eq(papers.id, paperQuestions.paperId))
    .where(and(eq(paperQuestions.id, paperQuestionId), eq(papers.teacherId, teacherId)))
    .limit(1);
  return row ?? null;
}

export async function removePaperQuestion(db: Database, teacherId: string, paperQuestionId: string): Promise<boolean | "locked"> {
  const row = await ownPaperQuestion(db, teacherId, paperQuestionId);
  if (!row) return false;
  if (row.status === "final") return "locked";
  await db.delete(paperQuestions).where(eq(paperQuestions.id, paperQuestionId));
  return true;
}

/** Moves a question one place up or down within its part of a draft paper. */
export async function movePaperQuestion(db: Database, teacherId: string, paperQuestionId: string, direction: "up" | "down"): Promise<boolean> {
  const row = await ownPaperQuestion(db, teacherId, paperQuestionId);
  if (!row || row.status === "final") return false;
  const siblings = await db
    .select({ id: paperQuestions.id, position: paperQuestions.position })
    .from(paperQuestions)
    .where(and(eq(paperQuestions.paperId, row.paperId), eq(paperQuestions.section, row.section)))
    .orderBy(asc(paperQuestions.position), asc(paperQuestions.id));
  const order = swapped(siblings, paperQuestionId, direction);
  if (!order) return false;
  await renumber(db, order, (tx, id, position) => tx.update(paperQuestions).set({ position }).where(eq(paperQuestions.id, id)));
  return true;
}

/**
 * Makes a paper final: its questions are frozen as they are now, and so are its sets and their
 * answer keys. A question deleted from the bank meanwhile is dropped. Refused with no questions.
 */
export async function finalizePaper(db: Database, teacherId: string, paperId: string): Promise<{ ok: true } | { ok: false; reason: PaperRefusal }> {
  const paper = await getPaper(db, teacherId, paperId);
  if (!paper) return { ok: false, reason: "missing" };
  if (paper.status === "final") return { ok: true };
  return db.transaction(async (tx) => {
    await tx.delete(paperQuestions).where(and(eq(paperQuestions.paperId, paperId), isNull(paperQuestions.questionId), isNull(paperQuestions.snapshot)));
    const rows = await tx
      .select({ id: paperQuestions.id, type: questions.type, body: questions.body })
      .from(paperQuestions)
      .leftJoin(questions, eq(questions.id, paperQuestions.questionId))
      .where(eq(paperQuestions.paperId, paperId));
    if (rows.length === 0) return { ok: false as const, reason: "noQuestions" as const };
    for (const row of rows) {
      if (!row.type || !row.body) continue;
      await tx
        .update(paperQuestions)
        .set({ snapshot: { type: row.type, body: row.body } })
        .where(eq(paperQuestions.id, row.id));
    }
    await tx.update(papers).set({ status: "final", finalizedAt: new Date() }).where(eq(papers.id, paperId));
    return { ok: true as const };
  });
}

/**
 * Takes a final paper back to a draft: its questions follow the bank again, and can change. Not
 * once any sheet is in: those were marked against its sets as they are.
 */
export async function reopenPaper(db: Database, teacherId: string, paperId: string): Promise<boolean | "locked"> {
  const paper = await getPaper(db, teacherId, paperId);
  if (!paper) return false;
  if (await hasResults(db, paperId)) return "locked";
  await db.transaction(async (tx) => {
    await tx.update(paperQuestions).set({ snapshot: null }).where(eq(paperQuestions.paperId, paperId));
    await tx.update(papers).set({ status: "draft", finalizedAt: null }).where(eq(papers.id, paperId));
  });
  return true;
}

/** An MCQ as one set prints it: the question, and the order of its options (indexes into the question as written). */
export type SetQuestion = { id: string; question: PaperQuestionSnapshot; optionOrder: number[] };
/** One set of a paper: its MCQs in the set's own order, and its answer key (the right option's printed place, 0 = ক). */
export type PaperSet = { code: number; mcqs: SetQuestion[]; key: number[] };

/** The given sets of a paper, from its questions: each set's MCQs in its order, and its key. */
export function paperSets(paper: Pick<Paper, "seed" | "firstSet" | "shuffleQuestions" | "shuffleOptions">, list: PaperQuestion[], codes: number[]): PaperSet[] {
  const mcqs = list.filter((q): q is PaperQuestion & { question: PaperQuestionSnapshot } => q.section === "mcq" && q.question !== null);
  const byId = new Map(mcqs.map((q) => [q.id, q.question]));
  const shape = mcqs.map((q) => ({ id: q.id, optionCount: q.question.body.options?.length ?? OPTION_COUNT }));
  const answers = mcqs.map((q) => ({ id: q.id, answer: q.question.body.answer ?? -1 }));
  return codes.map((code) => {
    const order = setOrder(shape, paper, code);
    return {
      code,
      mcqs: order.questions.map((id) => ({ id, question: byId.get(id)!, optionOrder: order.options[id] })),
      key: setKey(answers, order),
    };
  });
}
