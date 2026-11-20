import { beforeAll, describe, expect, it } from "vitest";
import { parseSubject } from "@/lib/bank";
import { parseCourse } from "@/lib/courses";
import { encodeMarks } from "@/lib/omr";
import { parsePaper } from "@/lib/papers";
import { parseQuestion } from "@/lib/questions";
import { createBankClass, createSubject, getSubject } from "@/server/bank";
import { createCourse } from "@/server/courses";
import type { Database } from "@/server/db";
import { enrollStudent } from "@/server/enrollments";
import { deleteResult, listStudentPaperResults, paperResultsView, saveResult, setResultsPublished, setWrittenMarks } from "@/server/paper-results";
import { addPaperQuestions, createPaper, finalizePaper, getPaper, paperKeys, reopenPaper, updatePaper } from "@/server/papers";
import { createQuestion } from "@/server/questions";
import { createStudent } from "@/server/students";
import type { Teacher } from "@/server/teachers";
import { freshDb, makeTeacher } from "../helpers/db";

let db: Database;
let stranger: Teacher;
let phones = 0;
const phone = () => `0170${String(2000000 + ++phones).slice(-7)}`;

const settings = (courseId: string, extra: Record<string, unknown> = {}) => ({
  ...parsePaper({ title: "সাপ্তাহিক পরীক্ষা", courseId, setCount: "3", mark: "1", negative: "0.25", shuffleQuestions: "on", shuffleOptions: "on" }).paper,
  ...extra,
});

/**
 * A teacher's final three-set paper of four MCQs (right answers 0–3 in turn) and a CQ, for a
 * course with আবির at roll 1, বর্ষা at roll 2 and গৌতম at roll 3.
 */
async function setup() {
  const t = await makeTeacher(db);
  const { course: courseInput } = parseCourse({ title: "পদার্থবিজ্ঞান", access: "approval" });
  const course = await createCourse(db, t.id, courseInput);
  const bankClass = await createBankClass(db, t.id, { name: "এইচএসসি" });
  const madeSubject = await createSubject(db, t.id, parseSubject({ name: "পদার্থ", classId: bankClass.id }).subject, ["বল"]);
  const subject = (await getSubject(db, t.id, madeSubject!.id))!;
  const ids: string[] = [];
  for (let i = 0; i < 4; i++) {
    const { question } = parseQuestion({ type: "mcq", subjectId: subject.id, chapterId: subject.chapters[0].id, stem: `প্রশ্ন ${i}`, option0: "ক", option1: "খ", option2: "গ", option3: "ঘ", answer: String(i) });
    const made = await createQuestion(db, t.id, question);
    if (made.ok) ids.push(made.question.id);
  }
  const { question: cq } = parseQuestion({ type: "creative", subjectId: subject.id, chapterId: subject.chapters[0].id, stem: "সৃজনশীল", part0: "ক", part1: "খ", part2: "গ", part3: "ঘ" });
  const madeCq = await createQuestion(db, t.id, cq);
  if (madeCq.ok) ids.push(madeCq.question.id);
  const people = [];
  for (const [i, name] of ["আবির", "বর্ষা", "গৌতম"].entries()) {
    const student = await createStudent(db, { teacherId: t.id, name, phone: phone(), password: "secret1" });
    await enrollStudent(db, t.id, student.id, course.id, { batchId: null, roll: String(i + 1), fee: null });
    people.push(student);
  }
  const made = await createPaper(db, t.id, settings(course.id));
  if (!made.ok) throw new Error("no paper");
  await addPaperQuestions(db, t.id, made.paper.id, ids);
  await finalizePaper(db, t.id, made.paper.id);
  const paper = (await getPaper(db, t.id, made.paper.id))!;
  const keys = await paperKeys(db, t.id, paper);
  return { t, course, paper, keys, people };
}

beforeAll(async () => {
  db = await freshDb();
  stranger = await makeTeacher(db);
});

describe("answer sheets", () => {
  it("are taken only for a final paper of the teacher's, in a set it has", async () => {
    const s = await setup();
    const draft = await createPaper(db, s.t.id, settings(s.course.id));
    if (!draft.ok) throw new Error("no paper");
    expect(await saveResult(db, s.t.id, draft.paper.id, { roll: "1", setCode: 101, marks: "" })).toEqual({ ok: false, reason: "notFinal" });
    expect(await saveResult(db, s.t.id, s.paper.id, { roll: "1", setCode: 104, marks: "" })).toEqual({ ok: false, reason: "set" });
    expect(await saveResult(db, stranger.id, s.paper.id, { roll: "1", setCode: 101, marks: "" })).toEqual({ ok: false, reason: "missing" });
    expect(await paperResultsView(db, stranger.id, s.paper.id)).toBeNull();
  });

  it("are marked against their own set's key, and named from the course's rolls", async () => {
    const s = await setup();
    // আবির answers set 102 by its own key: full marks; বর্ষা answers set 102's paper with set 101's key.
    const key102 = s.keys.get(102)!;
    const abir = await saveResult(db, s.t.id, s.paper.id, { roll: "1", setCode: 102, marks: encodeMarks(key102) });
    expect(abir.ok && abir.result).toMatchObject({ correct: 4, wrong: 0, scoreHundredths: 400, source: "manual" });
    expect(abir.ok && abir.name).toBe("আবির");
    // Right, blank, two marks, wrong: 1 − 0.25 − 0.25.
    const k = s.keys.get(101)!;
    const barsha = await saveResult(db, s.t.id, s.paper.id, { roll: "2", setCode: 101, marks: `${k[0]},-,d0.1,${(k[3] + 1) % 4}` });
    expect(barsha.ok && barsha.result).toMatchObject({ correct: 1, wrong: 1, blank: 1, doubled: 1, scoreHundredths: 50 });
    // A roll nobody in the course has is kept, without a name.
    const stray = await saveResult(db, s.t.id, s.paper.id, { roll: "99", setCode: 101, marks: "" });
    expect(stray.ok && stray.name).toBeNull();

    const view = await paperResultsView(db, s.t.id, s.paper.id);
    expect(view?.rows.map((row) => [row.roll, row.name, row.rank, row.scoreHundredths])).toEqual([
      ["1", "আবির", 1, 400],
      ["2", "বর্ষা", 2, 50],
      ["99", null, 3, 0],
    ]);
    expect(view?.absent.map((p) => p.name)).toEqual(["গৌতম"]);
    expect(view?.mcqCount).toBe(4);
  });

  it("typed again for a roll replace what it had, keeping its written marks unless new ones are given", async () => {
    const s = await setup();
    const first = await saveResult(db, s.t.id, s.paper.id, { roll: "1", setCode: 101, marks: "", writtenHundredths: 700 });
    await saveResult(db, s.t.id, s.paper.id, { roll: "1", setCode: 101, marks: encodeMarks(s.keys.get(101)!) });
    const view = await paperResultsView(db, s.t.id, s.paper.id);
    expect(view?.rows).toHaveLength(1);
    expect(view?.rows[0]).toMatchObject({ id: first.ok ? first.result.id : "", scoreHundredths: 400, writtenHundredths: 700, totalHundredths: 1100 });
  });

  it("take written marks that count towards the place, and can be deleted, by their own teacher only", async () => {
    const s = await setup();
    const a = await saveResult(db, s.t.id, s.paper.id, { roll: "1", setCode: 101, marks: encodeMarks(s.keys.get(101)!) });
    const b = await saveResult(db, s.t.id, s.paper.id, { roll: "2", setCode: 101, marks: "" });
    if (!a.ok || !b.ok) throw new Error("not saved");
    // বর্ষা's written part puts her ahead.
    expect(await setWrittenMarks(db, s.t.id, b.result.id, 850)).toBe(true);
    expect(await setWrittenMarks(db, stranger.id, a.result.id, 10_000)).toBe(false);
    expect((await paperResultsView(db, s.t.id, s.paper.id))?.rows.map((row) => [row.name, row.rank, row.totalHundredths])).toEqual([
      ["বর্ষা", 1, 850],
      ["আবির", 2, 400],
    ]);
    expect(await deleteResult(db, stranger.id, b.result.id)).toBe(false);
    expect(await deleteResult(db, s.t.id, b.result.id)).toBe(true);
    expect((await paperResultsView(db, s.t.id, s.paper.id))?.rows.map((row) => row.name)).toEqual(["আবির"]);
  });
});

describe("a paper with sheets in", () => {
  it("stays final and keeps its course, and is marked again when its marking changes", async () => {
    const s = await setup();
    const k = s.keys.get(101)!;
    // Three right and one wrong.
    await saveResult(db, s.t.id, s.paper.id, { roll: "1", setCode: 101, marks: `${k[0]},${k[1]},${k[2]},${(k[3] + 1) % 4}` });
    expect(await reopenPaper(db, s.t.id, s.paper.id)).toBe("locked");
    const other = await createCourse(db, s.t.id, parseCourse({ title: "রসায়ন", access: "approval" }).course);
    const changed = await updatePaper(db, s.t.id, s.paper.id, settings(other.id, { markHundredths: 200, negativeHundredths: 50 }));
    expect(changed.ok && changed.paper).toMatchObject({ courseId: s.course.id, markHundredths: 200, negativeHundredths: 50 });
    // 3 × 2 − 1 × 0.5.
    expect((await paperResultsView(db, s.t.id, s.paper.id))?.rows[0].scoreHundredths).toBe(550);
  });
});

describe("a student's results", () => {
  it("show on their page once published: their marks, and their place among everyone's", async () => {
    const s = await setup();
    const [abir, barsha] = s.people;
    await saveResult(db, s.t.id, s.paper.id, { roll: "1", setCode: 102, marks: encodeMarks(s.keys.get(102)!), writtenHundredths: 600 });
    await saveResult(db, s.t.id, s.paper.id, { roll: "2", setCode: 103, marks: encodeMarks(s.keys.get(103)!) });
    expect(await listStudentPaperResults(db, s.t.id, abir.id)).toEqual([]);

    expect(await setResultsPublished(db, stranger.id, s.paper.id, true)).toBe(false);
    expect(await setResultsPublished(db, s.t.id, s.paper.id, true)).toBe(true);
    expect(await listStudentPaperResults(db, s.t.id, barsha.id)).toMatchObject([
      { title: "সাপ্তাহিক পরীক্ষা", setCode: 103, scoreHundredths: 400, writtenHundredths: null, totalHundredths: 400, mcqTotalHundredths: 400, rank: 2, of: 2 },
    ]);
    expect((await listStudentPaperResults(db, s.t.id, abir.id))[0]).toMatchObject({ totalHundredths: 1000, rank: 1, of: 2 });
    // Another teacher's lookup of the same student finds nothing; গৌতম, with no sheet, has none.
    expect(await listStudentPaperResults(db, stranger.id, abir.id)).toEqual([]);
    expect(await listStudentPaperResults(db, s.t.id, s.people[2].id)).toEqual([]);

    await setResultsPublished(db, s.t.id, s.paper.id, false);
    expect(await listStudentPaperResults(db, s.t.id, barsha.id)).toEqual([]);
  });
});
