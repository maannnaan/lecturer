import { and, asc, eq, notExists, sql } from "drizzle-orm";
import type { Database } from "@/server/db";
import { bankChapters, bankClasses, bankSubjects, teachers } from "@/server/db/schema";
import type { BankChapterInput, SubjectInput } from "@/lib/bank";
import { GRADES, type Grade } from "@/lib/grades";
import { isUuid } from "@/lib/ids";
import { type Tx, renumber, swapped } from "./ordering";

// The question bank's own classes, subjects and chapters (courses are what the website
// advertises). Like courses, every function takes the teacher's id from the session and filters on
// it: another teacher's subject or chapter id simply isn't found.

export type Subject = typeof bankSubjects.$inferSelect;
export type BankChapter = typeof bankChapters.$inferSelect;
export type SubjectWithChapters = Subject & { chapters: BankChapter[] };

const subjectOrder = [asc(bankSubjects.position), asc(bankSubjects.number)];
const chapterOrder = [asc(bankChapters.position), asc(bankChapters.number)];

/** The classes in the teacher's bank, in GRADES order. */
export async function listBankClasses(db: Database, teacherId: string): Promise<Grade[]> {
  const rows = await db.select({ grade: bankClasses.grade }).from(bankClasses).where(eq(bankClasses.teacherId, teacherId));
  const added = new Set(rows.map((row) => row.grade));
  return GRADES.filter((grade) => added.has(grade));
}

/** Adds a class to the teacher's bank; a class that is already there stays as it is. */
export async function addBankClass(db: Database | Tx, teacherId: string, grade: Grade): Promise<void> {
  await db.insert(bankClasses).values({ teacherId, grade }).onConflictDoNothing();
}

/**
 * Takes a class out of the teacher's bank, but only while it has no subject: nothing else is ever
 * deleted with it. False when the class has subjects, or wasn't in the bank.
 */
export async function removeBankClass(db: Database, teacherId: string, grade: string): Promise<boolean> {
  const inUse = db
    .select({ id: bankSubjects.id })
    .from(bankSubjects)
    .where(and(eq(bankSubjects.teacherId, teacherId), eq(bankSubjects.grade, grade)));
  const gone = await db
    .delete(bankClasses)
    .where(and(eq(bankClasses.teacherId, teacherId), eq(bankClasses.grade, grade), notExists(inUse)))
    .returning({ grade: bankClasses.grade });
  return gone.length > 0;
}

export async function listSubjects(db: Database, teacherId: string): Promise<Subject[]> {
  return db.select().from(bankSubjects).where(eq(bankSubjects.teacherId, teacherId)).orderBy(...subjectOrder);
}

/** Every subject of the teacher, in order, each with its chapters in order. */
export async function listSubjectsWithChapters(db: Database, teacherId: string): Promise<SubjectWithChapters[]> {
  const [list, all] = await Promise.all([
    listSubjects(db, teacherId),
    db.select().from(bankChapters).where(eq(bankChapters.teacherId, teacherId)).orderBy(...chapterOrder),
  ]);
  return list.map((subject) => ({ ...subject, chapters: all.filter((ch) => ch.subjectId === subject.id) }));
}

async function withChapters(db: Database, teacherId: string, subject: Subject | undefined): Promise<SubjectWithChapters | null> {
  if (!subject) return null;
  const chapters = await db
    .select()
    .from(bankChapters)
    .where(and(eq(bankChapters.subjectId, subject.id), eq(bankChapters.teacherId, teacherId)))
    .orderBy(...chapterOrder);
  return { ...subject, chapters };
}

export async function getSubject(db: Database, teacherId: string, subjectId: string): Promise<SubjectWithChapters | null> {
  if (!isUuid(subjectId)) return null;
  const [subject] = await db
    .select()
    .from(bankSubjects)
    .where(and(eq(bankSubjects.id, subjectId), eq(bankSubjects.teacherId, teacherId)))
    .limit(1);
  return withChapters(db, teacherId, subject);
}

/** A subject by its public number (lecturer.bd/<handle>/bank/<class>/<number>), with its chapters. */
export async function getSubjectByNumber(db: Database, teacherId: string, number: number): Promise<SubjectWithChapters | null> {
  if (!Number.isSafeInteger(number) || number < 1) return null;
  const [subject] = await db
    .select()
    .from(bankSubjects)
    .where(and(eq(bankSubjects.teacherId, teacherId), eq(bankSubjects.number, number)))
    .limit(1);
  return withChapters(db, teacherId, subject);
}

/**
 * Adds a subject at the end of the teacher's list, with the next never-used subject number, and
 * its first chapters (numbered 1, 2, 3… in the order given). Its class joins the bank if it wasn't
 * there yet.
 */
export async function createSubject(db: Database, teacherId: string, input: SubjectInput, chapterTitles: string[] = []): Promise<Subject> {
  return db.transaction(async (tx) => {
    await addBankClass(tx, teacherId, input.grade);
    const [{ number }] = await tx
      .update(teachers)
      .set({ subjectCounter: sql`${teachers.subjectCounter} + 1` })
      .where(eq(teachers.id, teacherId))
      .returning({ number: teachers.subjectCounter });
    const [{ last }] = await tx
      .select({ last: sql<number>`coalesce(max(${bankSubjects.position}), -1)` })
      .from(bankSubjects)
      .where(eq(bankSubjects.teacherId, teacherId));
    const [subject] = await tx
      .insert(bankSubjects)
      .values({ ...input, teacherId, number, position: Number(last) + 1, chapterCounter: chapterTitles.length })
      .returning();
    if (chapterTitles.length > 0) {
      await tx
        .insert(bankChapters)
        .values(chapterTitles.map((title, i) => ({ teacherId, subjectId: subject.id, number: i + 1, position: i, title })));
    }
    return subject;
  });
}

/** Changes a subject's class, group or name; a class it moves to joins the bank. */
export async function updateSubject(db: Database, teacherId: string, subjectId: string, input: SubjectInput): Promise<Subject | null> {
  if (!isUuid(subjectId)) return null;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(bankSubjects)
      .set(input)
      .where(and(eq(bankSubjects.id, subjectId), eq(bankSubjects.teacherId, teacherId)))
      .returning();
    if (!row) return null;
    await addBankClass(tx, teacherId, input.grade);
    return row;
  });
}

/** Deletes a subject with its chapters and every question in it. Its number is never reused. */
export async function deleteSubject(db: Database, teacherId: string, subjectId: string): Promise<boolean> {
  if (!isUuid(subjectId)) return false;
  const gone = await db
    .delete(bankSubjects)
    .where(and(eq(bankSubjects.id, subjectId), eq(bankSubjects.teacherId, teacherId)))
    .returning({ id: bankSubjects.id });
  return gone.length > 0;
}

/** Moves a subject one place up or down the teacher's list (each class shows them in this order). */
export async function moveSubject(db: Database, teacherId: string, subjectId: string, direction: "up" | "down"): Promise<boolean> {
  const order = swapped(await listSubjects(db, teacherId), subjectId, direction);
  if (!order) return false;
  await renumber(db, order, (tx, id, position) =>
    tx.update(bankSubjects).set({ position }).where(and(eq(bankSubjects.id, id), eq(bankSubjects.teacherId, teacherId))),
  );
  return true;
}

/**
 * Adds chapters at the end of a subject, numbered on from its last-ever chapter number. Null when
 * the subject isn't this teacher's.
 */
export async function addBankChapters(
  db: Database,
  teacherId: string,
  subjectId: string,
  titles: string[],
): Promise<BankChapter[] | null> {
  if (!isUuid(subjectId)) return null;
  return db.transaction(async (tx) => {
    const [subject] = await tx
      .update(bankSubjects)
      .set({ chapterCounter: sql`${bankSubjects.chapterCounter} + ${titles.length}` })
      .where(and(eq(bankSubjects.id, subjectId), eq(bankSubjects.teacherId, teacherId)))
      .returning({ last: bankSubjects.chapterCounter });
    if (!subject) return null;
    if (titles.length === 0) return [];
    const [{ last }] = await tx
      .select({ last: sql<number>`coalesce(max(${bankChapters.position}), -1)` })
      .from(bankChapters)
      .where(eq(bankChapters.subjectId, subjectId));
    const first = subject.last - titles.length + 1;
    return tx
      .insert(bankChapters)
      .values(titles.map((title, i) => ({ teacherId, subjectId, number: first + i, position: Number(last) + 1 + i, title })))
      .returning();
  });
}

export async function updateBankChapter(
  db: Database,
  teacherId: string,
  chapterId: string,
  input: BankChapterInput,
): Promise<BankChapter | null> {
  if (!isUuid(chapterId)) return null;
  const [row] = await db
    .update(bankChapters)
    .set(input)
    .where(and(eq(bankChapters.id, chapterId), eq(bankChapters.teacherId, teacherId)))
    .returning();
  return row ?? null;
}

/** Deletes a chapter; its questions stay in the subject, under no chapter. */
export async function deleteBankChapter(db: Database, teacherId: string, chapterId: string): Promise<boolean> {
  if (!isUuid(chapterId)) return false;
  const gone = await db
    .delete(bankChapters)
    .where(and(eq(bankChapters.id, chapterId), eq(bankChapters.teacherId, teacherId)))
    .returning({ id: bankChapters.id });
  return gone.length > 0;
}

export async function moveBankChapter(db: Database, teacherId: string, chapterId: string, direction: "up" | "down"): Promise<boolean> {
  if (!isUuid(chapterId)) return false;
  const [chapter] = await db
    .select({ subjectId: bankChapters.subjectId })
    .from(bankChapters)
    .where(and(eq(bankChapters.id, chapterId), eq(bankChapters.teacherId, teacherId)))
    .limit(1);
  if (!chapter) return false;
  const siblings = await db
    .select({ id: bankChapters.id, position: bankChapters.position })
    .from(bankChapters)
    .where(and(eq(bankChapters.subjectId, chapter.subjectId), eq(bankChapters.teacherId, teacherId)))
    .orderBy(...chapterOrder);
  const order = swapped(siblings, chapterId, direction);
  if (!order) return false;
  await renumber(db, order, (tx, id, position) =>
    tx.update(bankChapters).set({ position }).where(and(eq(bankChapters.id, id), eq(bankChapters.teacherId, teacherId))),
  );
  return true;
}

/**
 * For proxy.ts: the class of the subject behind lecturer.bd/<handle>/bank/<class>/<subject>
 * [/<chapter>], or null when the subject (or that chapter of it) doesn't exist.
 */
export async function bankAddress(
  db: Database,
  teacherId: string,
  subjectNumber: number,
  chapterNumber?: number,
): Promise<{ grade: string } | null> {
  if (!Number.isSafeInteger(subjectNumber) || subjectNumber < 1) return null;
  const [subject] = await db
    .select({ id: bankSubjects.id, grade: bankSubjects.grade })
    .from(bankSubjects)
    .where(and(eq(bankSubjects.teacherId, teacherId), eq(bankSubjects.number, subjectNumber)))
    .limit(1);
  if (!subject) return null;
  if (chapterNumber === undefined) return { grade: subject.grade };
  if (!Number.isSafeInteger(chapterNumber) || chapterNumber < 1) return null;
  const [chapter] = await db
    .select({ id: bankChapters.id })
    .from(bankChapters)
    .where(and(eq(bankChapters.subjectId, subject.id), eq(bankChapters.number, chapterNumber)))
    .limit(1);
  return chapter ? { grade: subject.grade } : null;
}
