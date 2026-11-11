import { and, asc, eq, notExists, sql } from "drizzle-orm";
import type { Database } from "@/server/db";
import { bankChapters, bankClasses, bankSubjects, teachers } from "@/server/db/schema";
import type { BankChapterInput, BankClassInput, SubjectInput } from "@/lib/bank";
import { sortClasses } from "@/lib/bank-look";
import { isGrade } from "@/lib/grades";
import { isUuid } from "@/lib/ids";
import { type Tx, renumber, swapped } from "./ordering";

// The question bank's own classes, subjects and chapters (courses are what the website
// advertises). Like courses, every function takes the teacher's id from the session and filters on
// it: another teacher's class, subject or chapter id simply isn't found.

export type BankClass = typeof bankClasses.$inferSelect;
export type Subject = typeof bankSubjects.$inferSelect;
export type BankChapter = typeof bankChapters.$inferSelect;
export type SubjectWithChapters = Subject & { chapters: BankChapter[] };

const subjectOrder = [asc(bankSubjects.position), asc(bankSubjects.number)];
const chapterOrder = [asc(bankChapters.position), asc(bankChapters.number)];

/** The teacher's classes in the bank's order: by the class each name reads as, then as added. */
export async function listBankClasses(db: Database, teacherId: string): Promise<BankClass[]> {
  return sortClasses(await db.select().from(bankClasses).where(eq(bankClasses.teacherId, teacherId)));
}

export async function getBankClass(db: Database, teacherId: string, classId: string): Promise<BankClass | null> {
  if (!isUuid(classId)) return null;
  const [row] = await db
    .select()
    .from(bankClasses)
    .where(and(eq(bankClasses.id, classId), eq(bankClasses.teacherId, teacherId)))
    .limit(1);
  return row ?? null;
}

/** Whether a class id is one of this teacher's. */
async function ownsClass(db: Database | Tx, teacherId: string, classId: string): Promise<boolean> {
  if (!isUuid(classId)) return false;
  const [row] = await db
    .select({ id: bankClasses.id })
    .from(bankClasses)
    .where(and(eq(bankClasses.id, classId), eq(bankClasses.teacherId, teacherId)))
    .limit(1);
  return Boolean(row);
}

/**
 * For proxy.ts: the class behind lecturer.bd/<handle>/bank/<segment>, where the segment is the
 * class's number, or the fixed-list key ("hsc") of a class made before teachers named their own.
 */
export async function bankClassAddress(db: Database, teacherId: string, segment: string): Promise<{ number: number } | null> {
  const where = /^\d{1,6}$/.test(segment)
    ? eq(bankClasses.number, Number(segment))
    : isGrade(segment)
      ? eq(bankClasses.legacyGrade, segment)
      : null;
  if (!where) return null;
  const [row] = await db
    .select({ number: bankClasses.number })
    .from(bankClasses)
    .where(and(eq(bankClasses.teacherId, teacherId), where))
    .limit(1);
  return row ?? null;
}

/** Adds a class at the end of the teacher's list, with the next never-used class number. */
export async function createBankClass(db: Database, teacherId: string, input: BankClassInput): Promise<BankClass> {
  return db.transaction(async (tx) => {
    const [{ number }] = await tx
      .update(teachers)
      .set({ classCounter: sql`${teachers.classCounter} + 1` })
      .where(eq(teachers.id, teacherId))
      .returning({ number: teachers.classCounter });
    const [{ last }] = await tx
      .select({ last: sql<number>`coalesce(max(${bankClasses.position}), -1)` })
      .from(bankClasses)
      .where(eq(bankClasses.teacherId, teacherId));
    const [row] = await tx
      .insert(bankClasses)
      .values({ teacherId, number, name: input.name, position: Number(last) + 1 })
      .returning();
    return row;
  });
}

export async function renameBankClass(db: Database, teacherId: string, classId: string, input: BankClassInput): Promise<BankClass | null> {
  if (!isUuid(classId)) return null;
  const [row] = await db
    .update(bankClasses)
    .set({ name: input.name })
    .where(and(eq(bankClasses.id, classId), eq(bankClasses.teacherId, teacherId)))
    .returning();
  return row ?? null;
}

/**
 * Deletes a class, but only while it has no subject: nothing else is ever deleted with it. False
 * when the class has subjects, or isn't this teacher's. Its number is never reused.
 */
export async function removeBankClass(db: Database, teacherId: string, classId: string): Promise<boolean> {
  if (!isUuid(classId)) return false;
  const inUse = db.select({ id: bankSubjects.id }).from(bankSubjects).where(eq(bankSubjects.classId, classId));
  const gone = await db
    .delete(bankClasses)
    .where(and(eq(bankClasses.id, classId), eq(bankClasses.teacherId, teacherId), notExists(inUse)))
    .returning({ id: bankClasses.id });
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
 * its first chapters (numbered 1, 2, 3… in the order given). Null when the class isn't this
 * teacher's.
 */
export async function createSubject(
  db: Database,
  teacherId: string,
  input: SubjectInput,
  chapterTitles: string[] = [],
): Promise<Subject | null> {
  return db.transaction(async (tx) => {
    if (!(await ownsClass(tx, teacherId, input.classId))) return null;
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

/** Changes a subject's class, group or name. Null when the subject or the class isn't this teacher's. */
export async function updateSubject(db: Database, teacherId: string, subjectId: string, input: SubjectInput): Promise<Subject | null> {
  if (!isUuid(subjectId) || !(await ownsClass(db, teacherId, input.classId))) return null;
  const [row] = await db
    .update(bankSubjects)
    .set(input)
    .where(and(eq(bankSubjects.id, subjectId), eq(bankSubjects.teacherId, teacherId)))
    .returning();
  return row ?? null;
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
 * For proxy.ts: the number of the class the subject behind lecturer.bd/<handle>/bank/<class>/
 * <subject>[/<chapter>] is in now, or null when the subject (or that chapter of it) doesn't exist.
 */
export async function bankAddress(
  db: Database,
  teacherId: string,
  subjectNumber: number,
  chapterNumber?: number,
): Promise<{ classNumber: number } | null> {
  if (!Number.isSafeInteger(subjectNumber) || subjectNumber < 1) return null;
  const [subject] = await db
    .select({ id: bankSubjects.id, classNumber: bankClasses.number })
    .from(bankSubjects)
    .innerJoin(bankClasses, eq(bankClasses.id, bankSubjects.classId))
    .where(and(eq(bankSubjects.teacherId, teacherId), eq(bankSubjects.number, subjectNumber)))
    .limit(1);
  if (!subject) return null;
  if (chapterNumber === undefined) return { classNumber: subject.classNumber };
  if (!Number.isSafeInteger(chapterNumber) || chapterNumber < 1) return null;
  const [chapter] = await db
    .select({ id: bankChapters.id })
    .from(bankChapters)
    .where(and(eq(bankChapters.subjectId, subject.id), eq(bankChapters.number, chapterNumber)))
    .limit(1);
  return chapter ? { classNumber: subject.classNumber } : null;
}
