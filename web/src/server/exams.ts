import { type SQL, and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { type ExamInput, MAX_EXAM_QUESTIONS, attemptOrder, deadlineOf, gradeAttempt, rankAttempts, seedOf } from "@/lib/exams";
import { isUuid } from "@/lib/ids";
import { MCQ_TYPES } from "@/lib/questions";
import type { Database } from "@/server/db";
import {
  type AttemptOrder,
  type ExamQuestionSnapshot,
  attempts,
  batches,
  courses,
  enrollments,
  examQuestions,
  exams,
  questions,
  students,
  teachers,
} from "@/server/db/schema";
import { renumber, swapped, type Tx } from "./ordering";

// Online MCQ exams. Every function takes the teacher's id and filters on it; a student's own
// functions take the student's id too, and check they are in the exam's audience. The server
// alone decides the time (every check uses `now` given by the caller, the server's clock) and the
// score: a student's browser sends only which option they picked.

export type Exam = typeof exams.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type ExamRow = Exam & { courseTitle: string; batchName: string | null; questionCount: number; attemptCount: number };

/** Why an exam's change was refused. */
export type ExamRefusal = "course" | "batch" | "locked" | "noQuestions" | "missing";

/** Whether a course is the teacher's, and a batch (when given) is one of that course's: what's wrong, or null. Shared with papers. */
export async function ownCourseAndBatch(db: Database | Tx, teacherId: string, courseId: string, batchId: string | null): Promise<"course" | "batch" | null> {
  if (!isUuid(courseId)) return "course";
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.teacherId, teacherId)))
    .limit(1);
  if (!course) return "course";
  if (batchId === null) return null;
  if (!isUuid(batchId)) return "batch";
  const [batch] = await db
    .select({ id: batches.id })
    .from(batches)
    .where(and(eq(batches.id, batchId), eq(batches.courseId, courseId), eq(batches.teacherId, teacherId)))
    .limit(1);
  return batch ? null : "batch";
}

/** Whether anyone has started the exam: from then on its questions and marking stay as they are. */
export async function hasAttempts(db: Database | Tx, examId: string): Promise<boolean> {
  const [row] = await db.select({ id: attempts.id }).from(attempts).where(eq(attempts.examId, examId)).limit(1);
  return Boolean(row);
}

// ── The teacher's side ──

export async function listExams(db: Database, teacherId: string): Promise<ExamRow[]> {
  const [rows, questionCounts, attemptCounts] = await Promise.all([
    db
      .select({ exam: exams, courseTitle: courses.title, batchName: batches.name })
      .from(exams)
      .innerJoin(courses, eq(courses.id, exams.courseId))
      .leftJoin(batches, eq(batches.id, exams.batchId))
      .where(eq(exams.teacherId, teacherId))
      .orderBy(desc(exams.startsAt), desc(exams.number)),
    db
      .select({ examId: examQuestions.examId, n: count() })
      .from(examQuestions)
      .innerJoin(exams, eq(exams.id, examQuestions.examId))
      .where(eq(exams.teacherId, teacherId))
      .groupBy(examQuestions.examId),
    db.select({ examId: attempts.examId, n: count() }).from(attempts).where(eq(attempts.teacherId, teacherId)).groupBy(attempts.examId),
  ]);
  const qs = new Map(questionCounts.map((r) => [r.examId, Number(r.n)]));
  const as = new Map(attemptCounts.map((r) => [r.examId, Number(r.n)]));
  return rows.map(({ exam, ...names }) => ({ ...exam, ...names, questionCount: qs.get(exam.id) ?? 0, attemptCount: as.get(exam.id) ?? 0 }));
}

export async function getExam(db: Database, teacherId: string, examId: string): Promise<Exam | null> {
  if (!isUuid(examId)) return null;
  const [row] = await db
    .select()
    .from(exams)
    .where(and(eq(exams.id, examId), eq(exams.teacherId, teacherId)))
    .limit(1);
  return row ?? null;
}

/** A new exam, as a draft, with the next exam number. */
export async function createExam(db: Database, teacherId: string, input: ExamInput): Promise<{ ok: true; exam: Exam } | { ok: false; reason: ExamRefusal }> {
  const problem = await ownCourseAndBatch(db, teacherId, input.courseId, input.batchId);
  if (problem) return { ok: false, reason: problem };
  return db.transaction(async (tx) => {
    const [{ number }] = await tx
      .update(teachers)
      .set({ examCounter: sql`${teachers.examCounter} + 1` })
      .where(eq(teachers.id, teacherId))
      .returning({ number: teachers.examCounter });
    const [exam] = await tx
      .insert(exams)
      .values({ ...input, teacherId, number })
      .returning();
    return { ok: true as const, exam };
  });
}

/**
 * Changes an exam's settings. Once anyone has started it, what decides a score (the course and
 * batch, the marking, the shuffling) stays as it was; the title, instructions and times can still change.
 */
export async function updateExam(db: Database, teacherId: string, examId: string, input: ExamInput): Promise<{ ok: true; exam: Exam } | { ok: false; reason: ExamRefusal }> {
  const current = await getExam(db, teacherId, examId);
  if (!current) return { ok: false, reason: "missing" };
  const locked = await hasAttempts(db, examId);
  const settings = locked
    ? {
        ...input,
        courseId: current.courseId,
        batchId: current.batchId,
        markHundredths: current.markHundredths,
        negativeHundredths: current.negativeHundredths,
        shuffleQuestions: current.shuffleQuestions,
        shuffleOptions: current.shuffleOptions,
      }
    : input;
  if (!locked) {
    const problem = await ownCourseAndBatch(db, teacherId, settings.courseId, settings.batchId);
    if (problem) return { ok: false, reason: problem };
  }
  const [exam] = await db
    .update(exams)
    .set(settings)
    .where(and(eq(exams.id, examId), eq(exams.teacherId, teacherId)))
    .returning();
  return { ok: true, exam };
}

/** Deletes an exam with its questions and every sitting of it. */
export async function deleteExam(db: Database, teacherId: string, examId: string): Promise<boolean> {
  if (!isUuid(examId)) return false;
  const gone = await db
    .delete(exams)
    .where(and(eq(exams.id, examId), eq(exams.teacherId, teacherId)))
    .returning({ id: exams.id });
  return gone.length > 0;
}

/** A question of an exam: as frozen at publishing, or (in a draft) as the bank has it now. */
export type ExamQuestion = { id: string; questionId: string | null; position: number; question: ExamQuestionSnapshot | null };

export async function listExamQuestions(db: Database, teacherId: string, examId: string): Promise<ExamQuestion[]> {
  if (!isUuid(examId)) return [];
  const rows = await db
    .select({
      id: examQuestions.id,
      questionId: examQuestions.questionId,
      position: examQuestions.position,
      snapshot: examQuestions.snapshot,
      type: questions.type,
      body: questions.body,
    })
    .from(examQuestions)
    .innerJoin(exams, eq(exams.id, examQuestions.examId))
    .leftJoin(questions, eq(questions.id, examQuestions.questionId))
    .where(and(eq(examQuestions.examId, examId), eq(exams.teacherId, teacherId)))
    .orderBy(asc(examQuestions.position), asc(examQuestions.id));
  return rows.map((row) => ({
    id: row.id,
    questionId: row.questionId,
    position: row.position,
    question: row.snapshot ?? (row.type && row.body ? { type: row.type as ExamQuestionSnapshot["type"], body: row.body } : null),
  }));
}

/** The question as an exam freezes it. */
const snapshotOf = (q: { type: string; body: ExamQuestionSnapshot["body"] }): ExamQuestionSnapshot => ({ type: q.type as ExamQuestionSnapshot["type"], body: q.body });

/**
 * Adds bank questions to an exam, at its end: only the teacher's own MCQs, each once, up to the
 * most an exam holds. Refused once anyone has started the exam. In a published exam they are
 * frozen as they are added. Returns how many were added.
 */
export async function addExamQuestions(db: Database, teacherId: string, examId: string, questionIds: string[]): Promise<number | ExamRefusal> {
  const exam = await getExam(db, teacherId, examId);
  if (!exam) return "missing";
  if (await hasAttempts(db, examId)) return "locked";
  const ids = [...new Set(questionIds.filter(isUuid))];
  if (ids.length === 0) return 0;
  return db.transaction(async (tx) => {
    const present = await tx.select({ questionId: examQuestions.questionId }).from(examQuestions).where(eq(examQuestions.examId, examId));
    const have = new Set(present.map((row) => row.questionId));
    const room = MAX_EXAM_QUESTIONS - present.length;
    const found = await tx
      .select({ id: questions.id, type: questions.type, body: questions.body })
      .from(questions)
      .where(and(eq(questions.teacherId, teacherId), inArray(questions.id, ids), inArray(questions.type, [...MCQ_TYPES])));
    // In the order they were asked for.
    const byId = new Map(found.map((q) => [q.id, q]));
    const adding = ids.map((id) => byId.get(id)).filter((q): q is NonNullable<typeof q> => Boolean(q) && !have.has(q!.id)).slice(0, Math.max(0, room));
    if (adding.length === 0) return 0;
    const [{ last }] = await tx
      .select({ last: sql<number>`coalesce(max(${examQuestions.position}), -1)` })
      .from(examQuestions)
      .where(eq(examQuestions.examId, examId));
    await tx.insert(examQuestions).values(
      adding.map((q, i) => ({
        examId,
        questionId: q.id,
        position: Number(last) + 1 + i,
        snapshot: exam.status === "published" ? snapshotOf(q) : null,
      })),
    );
    return adding.length;
  });
}

/** The ids of up to `n` of the teacher's MCQs in a chapter (or a whole subject) not yet in the exam, picked at random. */
export async function randomQuestionIds(
  db: Database,
  teacherId: string,
  examId: string,
  place: { subjectId: string; chapterId: string | null },
  n: number,
): Promise<string[]> {
  if (!isUuid(examId) || !isUuid(place.subjectId) || (place.chapterId !== null && !isUuid(place.chapterId))) return [];
  const conditions: SQL[] = [eq(questions.teacherId, teacherId), eq(questions.subjectId, place.subjectId), inArray(questions.type, [...MCQ_TYPES])];
  if (place.chapterId) conditions.push(eq(questions.chapterId, place.chapterId));
  // Not one already in the exam.
  conditions.push(sql`${questions.id} not in (select ${examQuestions.questionId} from ${examQuestions} where ${examQuestions.examId} = ${examId} and ${examQuestions.questionId} is not null)`);
  const rows = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(...conditions))
    .orderBy(sql`random()`)
    .limit(Math.max(0, Math.min(n, MAX_EXAM_QUESTIONS)));
  return rows.map((row) => row.id);
}

export async function removeExamQuestion(db: Database, teacherId: string, examQuestionId: string): Promise<boolean | "locked"> {
  if (!isUuid(examQuestionId)) return false;
  const [row] = await db
    .select({ examId: examQuestions.examId })
    .from(examQuestions)
    .innerJoin(exams, eq(exams.id, examQuestions.examId))
    .where(and(eq(examQuestions.id, examQuestionId), eq(exams.teacherId, teacherId)))
    .limit(1);
  if (!row) return false;
  if (await hasAttempts(db, row.examId)) return "locked";
  await db.delete(examQuestions).where(eq(examQuestions.id, examQuestionId));
  return true;
}

export async function moveExamQuestion(db: Database, teacherId: string, examQuestionId: string, direction: "up" | "down"): Promise<boolean> {
  if (!isUuid(examQuestionId)) return false;
  const [row] = await db
    .select({ examId: examQuestions.examId })
    .from(examQuestions)
    .innerJoin(exams, eq(exams.id, examQuestions.examId))
    .where(and(eq(examQuestions.id, examQuestionId), eq(exams.teacherId, teacherId)))
    .limit(1);
  if (!row || (await hasAttempts(db, row.examId))) return false;
  const siblings = await db
    .select({ id: examQuestions.id, position: examQuestions.position })
    .from(examQuestions)
    .where(eq(examQuestions.examId, row.examId))
    .orderBy(asc(examQuestions.position), asc(examQuestions.id));
  const order = swapped(siblings, examQuestionId, direction);
  if (!order) return false;
  await renumber(db, order, (tx, id, position) => tx.update(examQuestions).set({ position }).where(eq(examQuestions.id, id)));
  return true;
}

/**
 * Opens the exam to its students: its questions are frozen as they are now. A question deleted
 * from the bank meanwhile is dropped. Refused with no questions.
 */
export async function publishExam(db: Database, teacherId: string, examId: string): Promise<{ ok: true } | { ok: false; reason: ExamRefusal }> {
  const exam = await getExam(db, teacherId, examId);
  if (!exam) return { ok: false, reason: "missing" };
  return db.transaction(async (tx) => {
    await tx.delete(examQuestions).where(and(eq(examQuestions.examId, examId), isNull(examQuestions.questionId), isNull(examQuestions.snapshot)));
    const rows = await tx
      .select({ id: examQuestions.id, snapshot: examQuestions.snapshot, type: questions.type, body: questions.body })
      .from(examQuestions)
      .leftJoin(questions, eq(questions.id, examQuestions.questionId))
      .where(eq(examQuestions.examId, examId));
    if (rows.length === 0) return { ok: false as const, reason: "noQuestions" as const };
    for (const row of rows) {
      if (row.snapshot || !row.type || !row.body) continue;
      await tx.update(examQuestions).set({ snapshot: snapshotOf({ type: row.type, body: row.body }) }).where(eq(examQuestions.id, row.id));
    }
    await tx.update(exams).set({ status: "published", publishedAt: exam.publishedAt ?? new Date() }).where(eq(exams.id, examId));
    return { ok: true as const };
  });
}

/** Takes an exam back to a draft (students no longer see it), while nobody has started it. */
export async function unpublishExam(db: Database, teacherId: string, examId: string): Promise<boolean | "locked"> {
  const exam = await getExam(db, teacherId, examId);
  if (!exam) return false;
  if (await hasAttempts(db, examId)) return "locked";
  await db.transaction(async (tx) => {
    await tx.update(examQuestions).set({ snapshot: null }).where(eq(examQuestions.examId, examId));
    await tx.update(exams).set({ status: "draft" }).where(eq(exams.id, examId));
  });
  return true;
}

// ── Sittings ──

/** The frozen questions of a published exam, for sitting and marking it. */
async function sittingQuestions(db: Database | Tx, examId: string) {
  const rows = await db
    .select({ id: examQuestions.id, snapshot: examQuestions.snapshot })
    .from(examQuestions)
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.position), asc(examQuestions.id));
  return rows.filter((row): row is { id: string; snapshot: ExamQuestionSnapshot } => row.snapshot !== null);
}

/** Marks a sitting (or marks it again) from its answers as they stand. */
async function grade(db: Database | Tx, exam: Exam, attempt: Attempt, submittedAt: Date): Promise<Attempt> {
  const qs = await sittingQuestions(db, exam.id);
  const score = gradeAttempt(
    qs.map((q) => ({ id: q.id, answer: q.snapshot.body.answer ?? -1 })),
    attempt.answers,
    exam,
  );
  const [graded] = await db
    .update(attempts)
    .set({ ...score, submittedAt })
    .where(and(eq(attempts.id, attempt.id), isNull(attempts.submittedAt)))
    .returning();
  // Someone else's request finished it first: what that one saved stands.
  if (graded) return graded;
  const [current] = await db.select().from(attempts).where(eq(attempts.id, attempt.id)).limit(1);
  return current;
}

/** Finishes every sitting of the exam whose time ran out without being submitted: as at its deadline. */
async function closeExpired(db: Database, exam: Exam, now: Date): Promise<void> {
  const open = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.examId, exam.id), isNull(attempts.submittedAt), sql`${attempts.deadlineAt} <= ${now}`));
  for (const attempt of open) await grade(db, exam, attempt, attempt.deadlineAt);
}

/** The active students the exam is for: in its course, and in its batch if it has one. */
async function audience(db: Database, exam: Exam) {
  const conditions: SQL[] = [eq(enrollments.courseId, exam.courseId), eq(enrollments.status, "active"), eq(students.status, "active")];
  if (exam.batchId) conditions.push(eq(enrollments.batchId, exam.batchId));
  return db
    .select({ studentId: students.id, name: students.name, phone: students.phone, roll: enrollments.roll })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(...conditions));
}

export type MeritRow = { attemptId: string; studentId: string; name: string; roll: string | null; correct: number; wrong: number; skipped: number; scoreHundredths: number; tookMs: number; submittedAt: Date; rank: number };

/**
 * An exam's results for the teacher: the merit list of everyone who sat it (sittings whose time ran
 * out are finished first), who is still sitting it, who of its students hasn't, and how many got
 * each question right, with how often each option was picked.
 */
export async function examResults(db: Database, teacherId: string, examId: string, now: Date) {
  const exam = await getExam(db, teacherId, examId);
  if (!exam) return null;
  await closeExpired(db, exam, now);
  const [all, people, qs] = await Promise.all([
    db
      .select({ attempt: attempts, name: students.name })
      .from(attempts)
      .innerJoin(students, eq(students.id, attempts.studentId))
      .where(eq(attempts.examId, examId)),
    audience(db, exam),
    sittingQuestions(db, examId),
  ]);
  const rollOf = new Map(people.map((p) => [p.studentId, p.roll]));
  const done = all.filter((row) => row.attempt.submittedAt !== null);
  const merit = rankAttempts(
    done.map(({ attempt, name }) => ({
      attemptId: attempt.id,
      studentId: attempt.studentId,
      name,
      roll: rollOf.get(attempt.studentId) ?? null,
      correct: attempt.correct ?? 0,
      wrong: attempt.wrong ?? 0,
      skipped: attempt.skipped ?? 0,
      scoreHundredths: attempt.scoreHundredths ?? 0,
      tookMs: attempt.submittedAt!.getTime() - attempt.startedAt.getTime(),
      submittedAt: attempt.submittedAt!,
    })),
  );
  const sitting = all.filter((row) => row.attempt.submittedAt === null).map((row) => ({ studentId: row.attempt.studentId, name: row.name, deadlineAt: row.attempt.deadlineAt }));
  const sat = new Set(all.map((row) => row.attempt.studentId));
  const absent = people.filter((p) => !sat.has(p.studentId));
  const questionStats = qs.map((q) => {
    const picks = [0, 0, 0, 0];
    let right = 0;
    for (const { attempt } of done) {
      const given = attempt.answers[q.id];
      if (given === undefined) continue;
      if (given >= 0 && given < picks.length) picks[given]++;
      if (given === q.snapshot.body.answer) right++;
    }
    return { id: q.id, question: q.snapshot, right, picks, sat: done.length };
  });
  return { exam, merit, sitting, absent, questions: questionStats };
}

// ── The student's side ──

/** Whether the exam is open to this student: published, and they are an active student of its course (and batch). */
async function forStudent(db: Database, teacherId: string, studentId: string, exam: Exam): Promise<boolean> {
  if (exam.teacherId !== teacherId || exam.status !== "published") return false;
  const conditions: SQL[] = [eq(enrollments.studentId, studentId), eq(enrollments.courseId, exam.courseId), eq(enrollments.status, "active")];
  if (exam.batchId) conditions.push(eq(enrollments.batchId, exam.batchId));
  const [row] = await db.select({ id: enrollments.id }).from(enrollments).where(and(...conditions)).limit(1);
  return Boolean(row);
}

/** Whether a sitting's result may be shown: right after submitting, or once the exam has closed. */
export function resultVisible(exam: Pick<Exam, "results" | "endsAt">, attempt: Pick<Attempt, "submittedAt"> | null, now: Date): boolean {
  if (!attempt?.submittedAt) return false;
  return exam.results === "immediate" || now >= exam.endsAt;
}

export type StudentExam = Exam & { courseTitle: string; questionCount: number; attempt: Attempt | null };

/** The published exams of the courses (and batches) a student is in now, soonest and latest first, each with their own sitting. */
export async function listStudentExams(db: Database, teacherId: string, studentId: string, now: Date): Promise<StudentExam[]> {
  if (!isUuid(studentId)) return [];
  const places = await db
    .select({ courseId: enrollments.courseId, batchId: enrollments.batchId })
    .from(enrollments)
    .where(and(eq(enrollments.teacherId, teacherId), eq(enrollments.studentId, studentId), eq(enrollments.status, "active")));
  if (places.length === 0) return [];
  const rows = await db
    .select({ exam: exams, courseTitle: courses.title })
    .from(exams)
    .innerJoin(courses, eq(courses.id, exams.courseId))
    .where(and(eq(exams.teacherId, teacherId), eq(exams.status, "published"), inArray(exams.courseId, places.map((p) => p.courseId))))
    .orderBy(desc(exams.startsAt));
  const mine = rows.filter(({ exam }) => places.some((p) => p.courseId === exam.courseId && (!exam.batchId || exam.batchId === p.batchId)));
  if (mine.length === 0) return [];
  const ids = mine.map(({ exam }) => exam.id);
  const [sittings, counts] = await Promise.all([
    db.select().from(attempts).where(and(eq(attempts.studentId, studentId), inArray(attempts.examId, ids))),
    db.select({ examId: examQuestions.examId, n: count() }).from(examQuestions).where(inArray(examQuestions.examId, ids)).groupBy(examQuestions.examId),
  ]);
  const result: StudentExam[] = [];
  for (const { exam, courseTitle } of mine) {
    let attempt = sittings.find((a) => a.examId === exam.id) ?? null;
    if (attempt && !attempt.submittedAt && attempt.deadlineAt <= now) attempt = await grade(db, exam, attempt, attempt.deadlineAt);
    result.push({ ...exam, courseTitle, questionCount: Number(counts.find((c) => c.examId === exam.id)?.n ?? 0), attempt });
  }
  return result;
}

/** An exam of the teacher's by its number, if this student may sit it, with their sitting (finished first if its time ran out). */
export async function getStudentExam(
  db: Database,
  teacherId: string,
  studentId: string,
  number: number,
  now: Date,
): Promise<{ exam: Exam; attempt: Attempt | null; questionCount: number } | null> {
  if (!Number.isSafeInteger(number) || number < 1) return null;
  const [exam] = await db
    .select()
    .from(exams)
    .where(and(eq(exams.teacherId, teacherId), eq(exams.number, number)))
    .limit(1);
  if (!exam || !(await forStudent(db, teacherId, studentId, exam))) return null;
  let [attempt] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.examId, exam.id), eq(attempts.studentId, studentId)))
    .limit(1);
  if (attempt && !attempt.submittedAt && attempt.deadlineAt <= now) attempt = await grade(db, exam, attempt, attempt.deadlineAt);
  const [{ n }] = await db.select({ n: count() }).from(examQuestions).where(eq(examQuestions.examId, exam.id));
  return { exam, attempt: attempt ?? null, questionCount: Number(n) };
}

export type StartResult = { ok: true; attempt: Attempt } | { ok: false; reason: "missing" | "notYet" | "closed" | "finished" };

/**
 * A student starts an exam: only while it is open, only once. Their order of questions and options
 * is fixed now, and their deadline: the duration from now, never past the exam's end. Starting
 * again (a reload) returns the same sitting.
 */
export async function startAttempt(db: Database, teacherId: string, studentId: string, examId: string, now: Date): Promise<StartResult> {
  if (!isUuid(examId)) return { ok: false, reason: "missing" };
  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam || !(await forStudent(db, teacherId, studentId, exam))) return { ok: false, reason: "missing" };
  const [existing] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.examId, examId), eq(attempts.studentId, studentId)))
    .limit(1);
  if (existing) return existing.submittedAt || existing.deadlineAt <= now ? { ok: false, reason: "finished" } : { ok: true, attempt: existing };
  if (now < exam.startsAt) return { ok: false, reason: "notYet" };
  if (now >= exam.endsAt) return { ok: false, reason: "closed" };

  const qs = await sittingQuestions(db, examId);
  const order: AttemptOrder = attemptOrder(
    qs.map((q) => ({ id: q.id, optionCount: q.snapshot.body.options?.length ?? 4 })),
    seedOf(`${examId}:${studentId}`),
    exam,
  );
  const [attempt] = await db
    .insert(attempts)
    .values({ teacherId, examId, studentId, startedAt: now, deadlineAt: deadlineOf(now, exam.durationMin, exam.endsAt), order })
    .onConflictDoNothing()
    .returning();
  if (attempt) return { ok: true, attempt };
  // Two starts at once: the other one made it.
  const [made] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.examId, examId), eq(attempts.studentId, studentId)))
    .limit(1);
  return { ok: true, attempt: made };
}

/** The student's own sitting that is still open (not submitted, time left), or null. */
async function openAttempt(db: Database | Tx, teacherId: string, studentId: string, attemptId: string, now: Date): Promise<Attempt | null> {
  if (!isUuid(attemptId)) return null;
  const [attempt] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.id, attemptId), eq(attempts.teacherId, teacherId), eq(attempts.studentId, studentId)))
    .limit(1);
  return attempt && !attempt.submittedAt && attempt.deadlineAt > now ? attempt : null;
}

/**
 * Saves one answer (an option's index in the question as written, or null to clear it), only while
 * the sitting is open. False when it isn't: the time is up, or it was submitted.
 */
export async function saveAnswer(db: Database, teacherId: string, studentId: string, attemptId: string, examQuestionId: string, choice: number | null, now: Date): Promise<boolean> {
  const attempt = await openAttempt(db, teacherId, studentId, attemptId, now);
  if (!attempt) return false;
  const options = attempt.order.options[examQuestionId];
  if (!options) return false;
  if (choice !== null && !options.includes(choice)) return false;
  const value = choice === null ? sql`${attempts.answers} - ${examQuestionId}` : sql`${attempts.answers} || ${JSON.stringify({ [examQuestionId]: choice })}::jsonb`;
  const saved = await db
    .update(attempts)
    .set({ answers: value })
    .where(and(eq(attempts.id, attemptId), isNull(attempts.submittedAt), sql`${attempts.deadlineAt} > ${now}`))
    .returning({ id: attempts.id });
  return saved.length > 0;
}

/** The student hands their sitting in: it is marked from the answers saved. Handing in a finished one changes nothing. */
export async function submitAttempt(db: Database, teacherId: string, studentId: string, attemptId: string, now: Date): Promise<Attempt | null> {
  if (!isUuid(attemptId)) return null;
  const [attempt] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.id, attemptId), eq(attempts.teacherId, teacherId), eq(attempts.studentId, studentId)))
    .limit(1);
  if (!attempt) return null;
  if (attempt.submittedAt) return attempt;
  const [exam] = await db.select().from(exams).where(eq(exams.id, attempt.examId)).limit(1);
  // Past the deadline it counts as handed in at the deadline.
  return grade(db, exam, attempt, now < attempt.deadlineAt ? now : attempt.deadlineAt);
}

/** The questions of a sitting, in the student's own order, for drawing. Their answers are left out unless `withAnswers`. */
export async function sittingView(db: Database, attempt: Attempt, withAnswers: boolean) {
  const qs = new Map((await sittingQuestions(db, attempt.examId)).map((q) => [q.id, q.snapshot]));
  return attempt.order.questions
    .map((id) => {
      const snapshot = qs.get(id);
      if (!snapshot) return null;
      const { answer, explanation, ...body } = snapshot.body;
      return {
        id,
        type: snapshot.type,
        stem: body.stem,
        image: body.image ?? null,
        statements: body.statements ?? [],
        prompt: body.prompt ?? "",
        options: body.options ?? [],
        /** The order to show the options in: indexes into `options`. */
        optionOrder: attempt.order.options[id] ?? (body.options ?? []).map((_, i) => i),
        answer: withAnswers ? (answer ?? null) : null,
        explanation: withAnswers ? (explanation ?? null) : null,
      };
    })
    .filter((q): q is NonNullable<typeof q> => q !== null);
}
