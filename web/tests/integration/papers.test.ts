import { beforeAll, describe, expect, it } from "vitest";
import { parseSubject } from "@/lib/bank";
import { parseCourse } from "@/lib/courses";
import { parsePaper } from "@/lib/papers";
import { parseQuestion } from "@/lib/questions";
import { createBankClass, createSubject, getSubject } from "@/server/bank";
import { createBatch } from "@/server/batches";
import { createCourse } from "@/server/courses";
import type { Database } from "@/server/db";
import {
  addPaperQuestions,
  createPaper,
  deletePaper,
  finalizePaper,
  getPaper,
  listPaperQuestions,
  listPapers,
  movePaperQuestion,
  paperSets,
  randomPaperQuestionIds,
  removePaperQuestion,
  reopenPaper,
  updatePaper,
} from "@/server/papers";
import { createQuestion, deleteQuestion, updateQuestion } from "@/server/questions";
import type { Teacher } from "@/server/teachers";
import { freshDb, makeTeacher } from "../helpers/db";

let db: Database;
let stranger: Teacher;

/** A teacher with a course and a bank chapter of four MCQs (right answers 0–3 in turn), a CQ and an SQ. */
async function setup() {
  const t = await makeTeacher(db);
  const { course: courseInput } = parseCourse({ title: "পদার্থবিজ্ঞান", access: "approval" });
  const course = await createCourse(db, t.id, courseInput);
  const bankClass = await createBankClass(db, t.id, { name: "এইচএসসি" });
  const madeSubject = await createSubject(db, t.id, parseSubject({ name: "পদার্থ", classId: bankClass.id }).subject, ["বল"]);
  const subject = (await getSubject(db, t.id, madeSubject!.id))!;
  const chapterId = subject.chapters[0].id;
  const make = async (fields: Record<string, string>) => {
    const { question } = parseQuestion({ subjectId: subject.id, chapterId, ...fields });
    const made = await createQuestion(db, t.id, question);
    if (!made.ok) throw new Error("no question");
    return made.question.id;
  };
  const mcqs: string[] = [];
  for (let i = 0; i < 4; i++) mcqs.push(await make({ type: "mcq", stem: `প্রশ্ন ${i}`, option0: "ক", option1: "খ", option2: "গ", option3: "ঘ", answer: String(i) }));
  const cq = await make({ type: "creative", stem: "সৃজনশীল", part0: "ক", part1: "খ", part2: "গ", part3: "ঘ" });
  const sq = await make({ type: "short", stem: "জড়তা কাকে বলে?" });
  return { t, course, subject, chapterId, mcqs, cq, sq };
}

const settings = (courseId: string, extra: Record<string, unknown> = {}) => ({
  ...parsePaper({ title: "সাপ্তাহিক পরীক্ষা", courseId, setCount: "3", mark: "1", negative: "0.25", shuffleQuestions: "on", shuffleOptions: "on" }).paper,
  ...extra,
});

async function made(s: Awaited<ReturnType<typeof setup>>, extra: Record<string, unknown> = {}) {
  const result = await createPaper(db, s.t.id, settings(s.course.id, extra));
  if (!result.ok) throw new Error("no paper");
  return result.paper;
}

beforeAll(async () => {
  db = await freshDb();
  stranger = await makeTeacher(db);
});

describe("making a paper", () => {
  it("takes the teacher's own questions, each once, each in its part, and is numbered in turn", async () => {
    const s = await setup();
    const first = await made(s);
    const second = await made(s);
    expect([first.number, second.number]).toEqual([1, 2]);
    expect(first).toMatchObject({ status: "draft", setCount: 3, firstSet: 101 });
    expect(first.seed).toBeGreaterThan(0);

    // A repeat and another teacher's question are left out; the CQ goes to the written part.
    const other = await setup();
    expect(await addPaperQuestions(db, s.t.id, first.id, [s.mcqs[0], s.cq, s.mcqs[1], s.mcqs[0], other.mcqs[0]])).toBe(3);
    const list = await listPaperQuestions(db, s.t.id, first.id);
    expect(list.map((q) => [q.section, q.questionId])).toEqual([
      ["mcq", s.mcqs[0]],
      ["mcq", s.mcqs[1]],
      ["written", s.cq],
    ]);
    // At random, of one type, from what isn't on it yet.
    expect((await randomPaperQuestionIds(db, s.t.id, first.id, { subjectId: s.subject.id, chapterId: s.chapterId }, "mcq", 10)).sort()).toEqual([s.mcqs[2], s.mcqs[3]].sort());
    expect(await randomPaperQuestionIds(db, s.t.id, first.id, { subjectId: s.subject.id, chapterId: s.chapterId }, "sq", 10)).toEqual([s.sq]);
    expect((await listPapers(db, s.t.id)).find((p) => p.id === first.id)).toMatchObject({ mcqCount: 2, writtenCount: 1, courseTitle: "পদার্থবিজ্ঞান" });

    // Another teacher can't see, fill, finalize or delete it; nor make one for this course.
    expect(await createPaper(db, stranger.id, settings(s.course.id))).toEqual({ ok: false, reason: "course" });
    expect(await getPaper(db, stranger.id, first.id)).toBeNull();
    expect(await addPaperQuestions(db, stranger.id, first.id, [s.mcqs[2]])).toBe("missing");
    expect(await listPaperQuestions(db, stranger.id, first.id)).toEqual([]);
    expect(await removePaperQuestion(db, stranger.id, list[0].id)).toBe(false);
    expect(await finalizePaper(db, stranger.id, first.id)).toEqual({ ok: false, reason: "missing" });
    expect(await deletePaper(db, stranger.id, first.id)).toBe(false);
    // A batch of another course doesn't fit.
    const otherBatch = (await createBatch(db, other.t.id, other.course.id, { name: "ক", schedule: "", capacity: null, open: true }))!;
    expect(await createPaper(db, s.t.id, settings(s.course.id, { batchId: otherBatch.id }))).toEqual({ ok: false, reason: "batch" });
  });

  it("moves a question within its own part", async () => {
    const s = await setup();
    const paper = await made(s);
    await addPaperQuestions(db, s.t.id, paper.id, [s.mcqs[0], s.mcqs[1], s.cq, s.sq]);
    const list = await listPaperQuestions(db, s.t.id, paper.id);
    const byQuestion = (id: string) => list.find((q) => q.questionId === id)!.id;
    expect(await movePaperQuestion(db, s.t.id, byQuestion(s.mcqs[1]), "up")).toBe(true);
    // The first written question can't go up into the MCQs.
    await movePaperQuestion(db, s.t.id, byQuestion(s.cq), "up");
    expect((await listPaperQuestions(db, s.t.id, paper.id)).map((q) => q.questionId)).toEqual([s.mcqs[1], s.mcqs[0], s.cq, s.sq]);
  });
});

describe("a final paper", () => {
  it("can't be made final empty", async () => {
    const s = await setup();
    const paper = await made(s);
    expect(await finalizePaper(db, s.t.id, paper.id)).toEqual({ ok: false, reason: "noQuestions" });
  });

  it("freezes its questions, and with them its sets and their keys", async () => {
    const s = await setup();
    const paper = await made(s);
    await addPaperQuestions(db, s.t.id, paper.id, [...s.mcqs, s.cq]);
    const codes = [101, 102, 103];
    const before = paperSets(paper, await listPaperQuestions(db, s.t.id, paper.id), codes);
    // The first set is the teacher's order, so its key is the answers as written.
    expect(before[0].key).toEqual([0, 1, 2, 3]);
    expect(await finalizePaper(db, s.t.id, paper.id)).toEqual({ ok: true });
    expect((await getPaper(db, s.t.id, paper.id))?.status).toBe("final");

    // The bank question changes afterwards: the paper keeps it as it was.
    const { question } = parseQuestion({ type: "mcq", subjectId: s.subject.id, chapterId: s.chapterId, stem: "বদলে গেছে", option0: "ক", option1: "খ", option2: "গ", option3: "ঘ", answer: "3" });
    await updateQuestion(db, s.t.id, s.mcqs[0], question);
    const frozen = await listPaperQuestions(db, s.t.id, paper.id);
    expect(frozen[0].question?.body).toMatchObject({ stem: "প্রশ্ন 0", answer: 0 });
    expect(paperSets(paper, frozen, codes)).toEqual(before);

    // Its questions can't change, nor what decides its sets.
    expect(await addPaperQuestions(db, s.t.id, paper.id, [s.sq])).toBe("locked");
    expect(await removePaperQuestion(db, s.t.id, frozen[0].id)).toBe("locked");
    expect(await movePaperQuestion(db, s.t.id, frozen[1].id, "up")).toBe(false);
    const changed = await updatePaper(db, s.t.id, paper.id, settings(s.course.id, { title: "নতুন নাম", setCount: 9, shuffleQuestions: false, shuffleOptions: false }));
    expect(changed.ok && changed.paper).toMatchObject({ title: "নতুন নাম", setCount: 3, shuffleQuestions: true, shuffleOptions: true });

    // Back to a draft, it follows the bank again.
    expect(await reopenPaper(db, s.t.id, paper.id)).toBe(true);
    expect((await listPaperQuestions(db, s.t.id, paper.id))[0].question?.body).toMatchObject({ stem: "বদলে গেছে", answer: 3 });
  });

  it("drops a question deleted from the bank before it was made final", async () => {
    const s = await setup();
    const paper = await made(s);
    await addPaperQuestions(db, s.t.id, paper.id, [s.mcqs[0], s.mcqs[1]]);
    await deleteQuestion(db, s.t.id, s.mcqs[0]);
    expect((await listPaperQuestions(db, s.t.id, paper.id)).map((q) => q.question !== null)).toEqual([false, true]);
    await finalizePaper(db, s.t.id, paper.id);
    expect((await listPaperQuestions(db, s.t.id, paper.id)).map((q) => q.questionId)).toEqual([s.mcqs[1]]);
  });
});
