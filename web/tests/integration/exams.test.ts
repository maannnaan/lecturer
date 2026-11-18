import { beforeAll, describe, expect, it } from "vitest";
import { parseSubject } from "@/lib/bank";
import { parseCourse } from "@/lib/courses";
import { parseQuestion } from "@/lib/questions";
import { createBankClass, createSubject, getSubject } from "@/server/bank";
import { createBatch } from "@/server/batches";
import { createCourse, updateCourse } from "@/server/courses";
import type { Database } from "@/server/db";
import { closeEnrollment, enrollStudent } from "@/server/enrollments";
import {
  addExamQuestions,
  createExam,
  deleteExam,
  examResults,
  getStudentExam,
  listExamQuestions,
  listStudentExams,
  publishExam,
  randomQuestionIds,
  removeExamQuestion,
  resultVisible,
  saveAnswer,
  sittingView,
  startAttempt,
  submitAttempt,
  unpublishExam,
  updateExam,
} from "@/server/exams";
import { createQuestion, updateQuestion } from "@/server/questions";
import { createStudent } from "@/server/students";
import type { Teacher } from "@/server/teachers";
import { freshDb, makeTeacher } from "../helpers/db";

let db: Database;
let stranger: Teacher;
let phones = 0;
const phone = () => `0160${String(1000000 + ++phones).slice(-7)}`;

const T0 = new Date("2030-01-10T04:00:00Z");
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);

/** A teacher with a course, a bank chapter of four MCQs (right answers 0–3 in turn) and one CQ, and two students in the course. */
async function setup() {
  const t = await makeTeacher(db);
  const { course: courseInput } = parseCourse({ title: "পদার্থবিজ্ঞান", access: "approval" });
  const created = await createCourse(db, t.id, courseInput);
  const course = (await updateCourse(db, t.id, created.id, { ...courseInput, published: true }))!;
  const bankClass = await createBankClass(db, t.id, { name: "এইচএসসি" });
  const madeSubject = await createSubject(db, t.id, parseSubject({ name: "পদার্থ", classId: bankClass.id }).subject, ["বল"]);
  const subject = (await getSubject(db, t.id, madeSubject!.id))!;
  const chapterId = subject.chapters[0].id;
  const mcqs: string[] = [];
  for (let i = 0; i < 4; i++) {
    const { question } = parseQuestion({ type: "mcq", subjectId: subject.id, chapterId, stem: `প্রশ্ন ${i}`, option0: "ক", option1: "খ", option2: "গ", option3: "ঘ", answer: String(i), explanation: `ব্যাখ্যা ${i}` });
    const r = await createQuestion(db, t.id, question);
    if (!r.ok) throw new Error("no question");
    mcqs.push(r.question.id);
  }
  const { question: cq } = parseQuestion({ type: "creative", subjectId: subject.id, chapterId, stem: "সৃজনশীল", part0: "ক", part1: "খ", part2: "গ", part3: "ঘ" });
  const cqResult = await createQuestion(db, t.id, cq);
  const [a, b] = await Promise.all(["আবির", "বর্ষা"].map((name) => createStudent(db, { teacherId: t.id, name, phone: phone(), password: "secret1" })));
  for (const s of [a, b]) await enrollStudent(db, t.id, s.id, course.id, { batchId: null, roll: null, fee: null });
  return { t, course, subject, chapterId, mcqs, cqId: cqResult.ok ? cqResult.question.id : "", a, b };
}

const settings = (courseId: string, extra: Record<string, unknown> = {}) => ({
  courseId,
  batchId: null,
  title: "সাপ্তাহিক পরীক্ষা",
  instructions: "",
  startsAt: T0,
  endsAt: minutes(60),
  durationMin: 20,
  markHundredths: 100,
  negativeHundredths: 25,
  shuffleQuestions: true,
  shuffleOptions: true,
  results: "after_end" as const,
  showAnswers: true,
  ...extra,
});

/** A published exam of the four MCQs. */
async function published(s: Awaited<ReturnType<typeof setup>>, extra: Record<string, unknown> = {}) {
  const made = await createExam(db, s.t.id, settings(s.course.id, extra));
  if (!made.ok) throw new Error("no exam");
  await addExamQuestions(db, s.t.id, made.exam.id, s.mcqs);
  await publishExam(db, s.t.id, made.exam.id);
  return made.exam;
}

beforeAll(async () => {
  db = await freshDb();
  stranger = await makeTeacher(db);
});

describe("making an exam", () => {
  it("takes the teacher's own MCQs only, each once, and is numbered in turn", async () => {
    const s = await setup();
    const first = await createExam(db, s.t.id, settings(s.course.id));
    const second = await createExam(db, s.t.id, settings(s.course.id));
    expect([first.ok && first.exam.number, second.ok && second.exam.number]).toEqual([1, 2]);
    expect(first.ok && first.exam.status).toBe("draft");
    if (!first.ok) return;

    // The CQ is no MCQ; a repeat and another teacher's question are left out.
    const other = await setup();
    expect(await addExamQuestions(db, s.t.id, first.exam.id, [s.mcqs[0], s.mcqs[1], s.cqId, s.mcqs[0], other.mcqs[0]])).toBe(2);
    expect(await addExamQuestions(db, s.t.id, first.exam.id, [s.mcqs[1], s.mcqs[2]])).toBe(1);
    expect((await listExamQuestions(db, s.t.id, first.exam.id)).map((q) => q.questionId)).toEqual([s.mcqs[0], s.mcqs[1], s.mcqs[2]]);
    // At random from the chapter: only the one not yet in it.
    expect(await randomQuestionIds(db, s.t.id, first.exam.id, { subjectId: s.subject.id, chapterId: s.chapterId }, 10)).toEqual([s.mcqs[3]]);

    // Another teacher can't see, change, fill or publish it; nor make one in this course.
    expect(await createExam(db, stranger.id, settings(s.course.id))).toEqual({ ok: false, reason: "course" });
    expect(await addExamQuestions(db, stranger.id, first.exam.id, [s.mcqs[3]])).toBe("missing");
    expect(await listExamQuestions(db, stranger.id, first.exam.id)).toEqual([]);
    expect(await publishExam(db, stranger.id, first.exam.id)).toEqual({ ok: false, reason: "missing" });
    expect(await deleteExam(db, stranger.id, first.exam.id)).toBe(false);
    // A batch of another course doesn't fit.
    const otherBatch = (await createBatch(db, other.t.id, other.course.id, { name: "ক", schedule: "", capacity: null, open: true }))!;
    expect(await createExam(db, s.t.id, settings(s.course.id, { batchId: otherBatch.id }))).toEqual({ ok: false, reason: "batch" });
  });

  it("can't be published empty, and freezes its questions when published", async () => {
    const s = await setup();
    const made = await createExam(db, s.t.id, settings(s.course.id));
    if (!made.ok) return;
    expect(await publishExam(db, s.t.id, made.exam.id)).toEqual({ ok: false, reason: "noQuestions" });
    await addExamQuestions(db, s.t.id, made.exam.id, [s.mcqs[0]]);
    expect(await publishExam(db, s.t.id, made.exam.id)).toEqual({ ok: true });

    // The bank question is changed afterwards: the exam keeps it as it was.
    const { question } = parseQuestion({ type: "mcq", subjectId: s.subject.id, chapterId: s.chapterId, stem: "বদলে গেছে", option0: "ক", option1: "খ", option2: "গ", option3: "ঘ", answer: "3" });
    await updateQuestion(db, s.t.id, s.mcqs[0], question);
    expect((await listExamQuestions(db, s.t.id, made.exam.id))[0].question?.body).toMatchObject({ stem: "প্রশ্ন 0", answer: 0 });
  });
});

describe("sitting an exam", () => {
  it("is for the course's active students only, while it is open, once each", async () => {
    const s = await setup();
    const exam = await published(s);
    const outsider = await createStudent(db, { teacherId: s.t.id, name: "বাইরের", phone: phone(), password: "secret1" });

    expect(await startAttempt(db, s.t.id, s.a.id, exam.id, minutes(-1))).toEqual({ ok: false, reason: "notYet" });
    expect(await startAttempt(db, s.t.id, s.a.id, exam.id, minutes(60))).toEqual({ ok: false, reason: "closed" });
    expect(await startAttempt(db, s.t.id, outsider.id, exam.id, minutes(1))).toEqual({ ok: false, reason: "missing" });
    // Another teacher's student, through this teacher's exam, is nobody.
    expect(await startAttempt(db, stranger.id, s.a.id, exam.id, minutes(1))).toEqual({ ok: false, reason: "missing" });

    const started = await startAttempt(db, s.t.id, s.a.id, exam.id, minutes(1));
    if (!started.ok) throw new Error("not started");
    // Twenty minutes from the start.
    expect(started.attempt.deadlineAt).toEqual(minutes(21));
    // A reload gives the same sitting and the same order.
    const again = await startAttempt(db, s.t.id, s.a.id, exam.id, minutes(5));
    expect(again.ok && again.attempt.id).toBe(started.attempt.id);
    expect(again.ok && again.attempt.order).toEqual(started.attempt.order);

    // Starting late: the time left is what the window has left.
    const late = await startAttempt(db, s.t.id, s.b.id, exam.id, minutes(50));
    expect(late.ok && late.attempt.deadlineAt).toEqual(minutes(60));

    // A student who has left the course no longer sees it.
    const leaving = await createStudent(db, { teacherId: s.t.id, name: "চলে গেছে", phone: phone(), password: "secret1" });
    const placed = await enrollStudent(db, s.t.id, leaving.id, s.course.id, { batchId: null, roll: null, fee: null });
    if (placed.ok) await closeEnrollment(db, s.t.id, placed.enrollment.id, "left");
    expect(await getStudentExam(db, s.t.id, leaving.id, exam.number, minutes(1))).toBeNull();
    expect(await listStudentExams(db, s.t.id, leaving.id, minutes(1))).toEqual([]);
  });

  it("never hands the answers to a sitting student, and refuses answers after the time is up", async () => {
    const s = await setup();
    const exam = await published(s);
    const started = await startAttempt(db, s.t.id, s.a.id, exam.id, minutes(0));
    if (!started.ok) throw new Error("not started");
    const view = await sittingView(db, started.attempt, false);
    expect(view).toHaveLength(4);
    for (const q of view) {
      expect(q.answer).toBeNull();
      expect(q.explanation).toBeNull();
      expect(JSON.stringify(q)).not.toContain("ব্যাখ্যা");
    }
    const [q0] = view;
    expect(await saveAnswer(db, s.t.id, s.a.id, started.attempt.id, q0.id, 2, minutes(1))).toBe(true);
    // An option the question doesn't have, a question not in the exam, someone else's sitting: refused.
    expect(await saveAnswer(db, s.t.id, s.a.id, started.attempt.id, q0.id, 7, minutes(1))).toBe(false);
    expect(await saveAnswer(db, s.t.id, s.a.id, started.attempt.id, "not-a-question", 1, minutes(1))).toBe(false);
    expect(await saveAnswer(db, s.t.id, s.b.id, started.attempt.id, q0.id, 1, minutes(1))).toBe(false);
    // After the deadline nothing is saved.
    expect(await saveAnswer(db, s.t.id, s.a.id, started.attempt.id, q0.id, 1, minutes(21))).toBe(false);
  });

  it("is marked on the server: a mark for each right answer, less for each wrong one", async () => {
    const s = await setup();
    const exam = await published(s, { results: "immediate" });
    const started = await startAttempt(db, s.t.id, s.a.id, exam.id, minutes(0));
    if (!started.ok) throw new Error("not started");
    const qs = await listExamQuestions(db, s.t.id, exam.id);
    // Right, right, wrong, and one left blank.
    await saveAnswer(db, s.t.id, s.a.id, started.attempt.id, qs[0].id, 0, minutes(1));
    await saveAnswer(db, s.t.id, s.a.id, started.attempt.id, qs[1].id, 1, minutes(1));
    await saveAnswer(db, s.t.id, s.a.id, started.attempt.id, qs[2].id, 0, minutes(1));
    // A changed mind: the last answer counts; a cleared one counts as blank.
    await saveAnswer(db, s.t.id, s.a.id, started.attempt.id, qs[3].id, 3, minutes(2));
    await saveAnswer(db, s.t.id, s.a.id, started.attempt.id, qs[3].id, null, minutes(3));

    const done = await submitAttempt(db, s.t.id, s.a.id, started.attempt.id, minutes(10));
    expect(done).toMatchObject({ correct: 2, wrong: 1, skipped: 1, scoreHundredths: 175, submittedAt: minutes(10) });
    // Handed in: no more answers, and handing in again changes nothing.
    expect(await saveAnswer(db, s.t.id, s.a.id, started.attempt.id, qs[2].id, 2, minutes(11))).toBe(false);
    expect((await submitAttempt(db, s.t.id, s.a.id, started.attempt.id, minutes(12)))?.submittedAt).toEqual(minutes(10));
    expect(resultVisible(exam, done, minutes(10))).toBe(true);
    // With the results, the answers may be shown.
    expect((await sittingView(db, done!, true)).find((q) => q.id === qs[0].id)?.answer).toBe(0);
  });

  it("a sitting whose time ran out counts as handed in at its deadline, with what was saved", async () => {
    const s = await setup();
    const exam = await published(s);
    const started = await startAttempt(db, s.t.id, s.a.id, exam.id, minutes(0));
    if (!started.ok) throw new Error("not started");
    const qs = await listExamQuestions(db, s.t.id, exam.id);
    await saveAnswer(db, s.t.id, s.a.id, started.attempt.id, qs[0].id, 0, minutes(5));

    // While the exam is open, the result waits ("after the end").
    const seen = await getStudentExam(db, s.t.id, s.a.id, exam.number, minutes(30));
    expect(seen?.attempt).toMatchObject({ submittedAt: minutes(20), correct: 1, skipped: 3, scoreHundredths: 100 });
    expect(resultVisible(exam, seen!.attempt, minutes(30))).toBe(false);
    expect(resultVisible(exam, seen!.attempt, minutes(60))).toBe(true);
    // A start after it is finished doesn't open it again.
    expect(await startAttempt(db, s.t.id, s.a.id, exam.id, minutes(30))).toEqual({ ok: false, reason: "finished" });
  });

  it("once anyone has started, its questions and marking stay as they are", async () => {
    const s = await setup();
    const exam = await published(s);
    await startAttempt(db, s.t.id, s.a.id, exam.id, minutes(0));
    const qs = await listExamQuestions(db, s.t.id, exam.id);
    expect(await removeExamQuestion(db, s.t.id, qs[0].id)).toBe("locked");
    expect(await addExamQuestions(db, s.t.id, exam.id, [s.mcqs[0]])).toBe("locked");
    expect(await unpublishExam(db, s.t.id, exam.id)).toBe("locked");
    const changed = await updateExam(db, s.t.id, exam.id, settings(s.course.id, { title: "নতুন নাম", markHundredths: 500, negativeHundredths: 0 }));
    expect(changed.ok && changed.exam).toMatchObject({ title: "নতুন নাম", markHundredths: 100, negativeHundredths: 25 });
  });
});

describe("results", () => {
  it("rank who sat it, list who is sitting and who hasn't, and count each question's answers", async () => {
    const s = await setup();
    const third = await createStudent(db, { teacherId: s.t.id, name: "গৌতম", phone: phone(), password: "secret1" });
    await enrollStudent(db, s.t.id, third.id, s.course.id, { batchId: null, roll: null, fee: null });
    const exam = await published(s);
    const qs = await listExamQuestions(db, s.t.id, exam.id);

    const a = await startAttempt(db, s.t.id, s.a.id, exam.id, minutes(0));
    const b = await startAttempt(db, s.t.id, s.b.id, exam.id, minutes(0));
    if (!a.ok || !b.ok) throw new Error("not started");
    for (const [i, q] of qs.entries()) await saveAnswer(db, s.t.id, s.a.id, a.attempt.id, q.id, i, minutes(1));
    await saveAnswer(db, s.t.id, s.b.id, b.attempt.id, qs[0].id, 0, minutes(1));
    await submitAttempt(db, s.t.id, s.a.id, a.attempt.id, minutes(8));

    // While বর্ষা's time runs, she is "sitting"; গৌতম hasn't started.
    const during = await examResults(db, s.t.id, exam.id, minutes(10));
    expect(during?.merit.map((m) => [m.name, m.rank, m.scoreHundredths])).toEqual([["আবির", 1, 400]]);
    expect(during?.sitting.map((x) => x.name)).toEqual(["বর্ষা"]);
    expect(during?.absent.map((x) => x.name)).toEqual(["গৌতম"]);

    // After her deadline she is on the list, as at her deadline.
    const after = await examResults(db, s.t.id, exam.id, minutes(30));
    expect(after?.merit.map((m) => [m.name, m.rank, m.scoreHundredths, m.tookMs])).toEqual([
      ["আবির", 1, 400, 8 * 60_000],
      ["বর্ষা", 2, 100, 20 * 60_000],
    ]);
    expect(after?.sitting).toEqual([]);
    expect(after?.questions[0]).toMatchObject({ right: 2, sat: 2, picks: [2, 0, 0, 0] });
    expect(after?.questions[1]).toMatchObject({ right: 1, sat: 2, picks: [0, 1, 0, 0] });
    expect(await examResults(db, stranger.id, exam.id, minutes(30))).toBeNull();
  });
});
