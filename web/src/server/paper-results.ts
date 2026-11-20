import { type SQL, and, count, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { isUuid } from "@/lib/ids";
import { decodeMarks, gradeSheet } from "@/lib/omr";
import { rankResults } from "@/lib/papers";
import type { Database } from "@/server/db";
import { enrollments, paperQuestions, paperResults, papers, students } from "@/server/db/schema";
import { type Paper, getPaper, paperKeys } from "./papers";

// A final paper's answer sheets: typed in by the teacher, or (later) sent by the OMR Scanner app.
// Every function takes the teacher's id and filters on it. A sheet carries a roll, not a person:
// who it is comes from the rolls of the paper's course each time it is read, so a sheet typed in
// before a student is admitted (or with a roll mistyped, then put right) still finds them.

export type PaperResult = typeof paperResults.$inferSelect;

/** Why a sheet was refused: no such paper, a paper still being put together, or a set it doesn't have. */
export type ResultRefusal = "missing" | "notFinal" | "set";

/** The course's students by roll, for naming the paper's sheets. A declined request has no roll. */
async function rollBook(db: Database, paper: Paper): Promise<Map<string, { studentId: string; name: string }>> {
  const rows = await db
    .select({ roll: enrollments.roll, studentId: students.id, name: students.name })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(eq(enrollments.teacherId, paper.teacherId), eq(enrollments.courseId, paper.courseId), isNotNull(enrollments.roll), ne(enrollments.status, "rejected")));
  return new Map(rows.map((row) => [row.roll!, { studentId: row.studentId, name: row.name }]));
}

export type Sheet = {
  roll: string;
  setCode: number;
  /** The app's mark string. */
  marks: string;
  /** The written part's marks; left out, whatever was given before stays. */
  writtenHundredths?: number | null;
  source?: "manual" | "scanner";
  scannedAt?: Date | null;
};

/**
 * Saves one answer sheet of a final paper, marked against its set's key. A sheet for a roll the
 * paper already has replaces it (a sheet scanned or typed again). Returns it with the name of
 * the course's student who has that roll, if anyone does.
 */
export async function saveResult(
  db: Database,
  teacherId: string,
  paperId: string,
  sheet: Sheet,
): Promise<{ ok: true; result: PaperResult; name: string | null } | { ok: false; reason: ResultRefusal }> {
  const paper = await getPaper(db, teacherId, paperId);
  if (!paper) return { ok: false, reason: "missing" };
  if (paper.status !== "final") return { ok: false, reason: "notFinal" };
  const key = (await paperKeys(db, teacherId, paper)).get(sheet.setCode);
  if (!key) return { ok: false, reason: "set" };
  const score = gradeSheet(decodeMarks(sheet.marks), key, paper);
  const changes = {
    setCode: sheet.setCode,
    marks: sheet.marks,
    correct: score.correct,
    wrong: score.wrong,
    blank: score.blank,
    doubled: score.double,
    scoreHundredths: score.scoreHundredths,
    source: sheet.source ?? "manual",
    scannedAt: sheet.scannedAt ?? null,
    ...(sheet.writtenHundredths !== undefined ? { writtenHundredths: sheet.writtenHundredths } : {}),
  };
  const [result] = await db
    .insert(paperResults)
    .values({ teacherId, paperId, roll: sheet.roll, ...changes })
    .onConflictDoUpdate({ target: [paperResults.paperId, paperResults.roll], set: { ...changes, updatedAt: new Date() } })
    .returning();
  const name = (await rollBook(db, paper)).get(sheet.roll)?.name ?? null;
  return { ok: true, result, name };
}

/** Gives (or with null, takes back) a sheet's marks for the written part. */
export async function setWrittenMarks(db: Database, teacherId: string, resultId: string, hundredths: number | null): Promise<boolean> {
  if (!isUuid(resultId)) return false;
  const saved = await db
    .update(paperResults)
    .set({ writtenHundredths: hundredths })
    .where(and(eq(paperResults.id, resultId), eq(paperResults.teacherId, teacherId)))
    .returning({ id: paperResults.id });
  return saved.length > 0;
}

export async function deleteResult(db: Database, teacherId: string, resultId: string): Promise<boolean> {
  if (!isUuid(resultId)) return false;
  const gone = await db
    .delete(paperResults)
    .where(and(eq(paperResults.id, resultId), eq(paperResults.teacherId, teacherId)))
    .returning({ id: paperResults.id });
  return gone.length > 0;
}

/** Lets the paper's students see their results on their own page, or (with false) stops it. */
export async function setResultsPublished(db: Database, teacherId: string, paperId: string, published: boolean): Promise<boolean> {
  if (!isUuid(paperId)) return false;
  const changed = await db
    .update(papers)
    .set({ resultsPublishedAt: published ? new Date() : null })
    .where(and(eq(papers.id, paperId), eq(papers.teacherId, teacherId), eq(papers.status, "final")))
    .returning({ id: papers.id });
  return changed.length > 0;
}

/** How many MCQs each of these papers has: its full MCQ marks are that many marks. */
async function mcqCounts(db: Database, paperIds: string[]): Promise<Map<string, number>> {
  if (paperIds.length === 0) return new Map();
  const rows = await db
    .select({ paperId: paperQuestions.paperId, n: count() })
    .from(paperQuestions)
    .where(and(inArray(paperQuestions.paperId, paperIds), eq(paperQuestions.section, "mcq")))
    .groupBy(paperQuestions.paperId);
  return new Map(rows.map((row) => [row.paperId, Number(row.n)]));
}

export type ResultRow = PaperResult & { name: string | null; studentId: string | null; totalHundredths: number; rank: number };

/**
 * A paper's results for the teacher: the merit list of every sheet in (named from the course's
 * rolls), and who of the paper's students (its course, and its batch if it has one) has none.
 */
export async function paperResultsView(db: Database, teacherId: string, paperId: string) {
  const paper = await getPaper(db, teacherId, paperId);
  if (!paper) return null;
  const audience: SQL[] = [eq(enrollments.courseId, paper.courseId), eq(enrollments.status, "active"), eq(students.status, "active")];
  if (paper.batchId) audience.push(eq(enrollments.batchId, paper.batchId));
  const [sheets, book, people, counts] = await Promise.all([
    db.select().from(paperResults).where(eq(paperResults.paperId, paper.id)),
    rollBook(db, paper),
    db
      .select({ studentId: students.id, name: students.name, roll: enrollments.roll })
      .from(enrollments)
      .innerJoin(students, eq(students.id, enrollments.studentId))
      .where(and(...audience)),
    mcqCounts(db, [paper.id]),
  ]);
  const rows: ResultRow[] = rankResults(
    sheets.map((sheet) => {
      const who = book.get(sheet.roll);
      return { ...sheet, name: who?.name ?? null, studentId: who?.studentId ?? null, totalHundredths: sheet.scoreHundredths + (sheet.writtenHundredths ?? 0) };
    }),
  );
  const handedIn = new Set(sheets.map((sheet) => sheet.roll));
  const absent = people.filter((p) => !p.roll || !handedIn.has(p.roll)).sort((a, b) => Number(a.roll ?? Infinity) - Number(b.roll ?? Infinity));
  return { paper, rows, absent, mcqCount: counts.get(paper.id) ?? 0 };
}

export type StudentPaperResult = {
  paperId: string;
  title: string;
  setCode: number;
  scoreHundredths: number;
  writtenHundredths: number | null;
  totalHundredths: number;
  /** The MCQs' full marks. */
  mcqTotalHundredths: number;
  rank: number;
  /** How many sheets the merit list has. */
  of: number;
  publishedAt: Date;
};

/** A student's results on the teacher's papers whose results are out: their marks, and their place among everyone's. */
export async function listStudentPaperResults(db: Database, teacherId: string, studentId: string): Promise<StudentPaperResult[]> {
  if (!isUuid(studentId)) return [];
  const places = await db
    .select({ courseId: enrollments.courseId, roll: enrollments.roll })
    .from(enrollments)
    .where(and(eq(enrollments.teacherId, teacherId), eq(enrollments.studentId, studentId), isNotNull(enrollments.roll), ne(enrollments.status, "rejected")));
  if (places.length === 0) return [];
  const out = await db
    .select()
    .from(papers)
    .where(and(eq(papers.teacherId, teacherId), eq(papers.status, "final"), isNotNull(papers.resultsPublishedAt), inArray(papers.courseId, places.map((p) => p.courseId))));
  if (out.length === 0) return [];
  const ids = out.map((paper) => paper.id);
  const [sheets, counts] = await Promise.all([db.select().from(paperResults).where(inArray(paperResults.paperId, ids)), mcqCounts(db, ids)]);
  const results: StudentPaperResult[] = [];
  for (const paper of out) {
    const roll = places.find((p) => p.courseId === paper.courseId)?.roll;
    const ranked = rankResults(
      sheets.filter((sheet) => sheet.paperId === paper.id).map((sheet) => ({ ...sheet, totalHundredths: sheet.scoreHundredths + (sheet.writtenHundredths ?? 0) })),
    );
    const mine = ranked.find((row) => row.roll === roll);
    if (!mine) continue;
    results.push({
      paperId: paper.id,
      title: paper.title,
      setCode: mine.setCode,
      scoreHundredths: mine.scoreHundredths,
      writtenHundredths: mine.writtenHundredths,
      totalHundredths: mine.totalHundredths,
      mcqTotalHundredths: (counts.get(paper.id) ?? 0) * paper.markHundredths,
      rank: mine.rank,
      of: ranked.length,
      publishedAt: paper.resultsPublishedAt!,
    });
  }
  return results.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
