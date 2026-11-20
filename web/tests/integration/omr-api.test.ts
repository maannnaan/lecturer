import { beforeAll, describe, expect, it } from "vitest";
import { parseSubject } from "@/lib/bank";
import { parseCourse } from "@/lib/courses";
import { encodeMarks } from "@/lib/omr";
import { parsePaper } from "@/lib/papers";
import { parseQuestion } from "@/lib/questions";
import { createSession } from "@/server/auth/session";
import { createBankClass, createSubject, getSubject } from "@/server/bank";
import { createCourse } from "@/server/courses";
import type { Database } from "@/server/db";
import { enrollStudent } from "@/server/enrollments";
import { omrPaper, omrPaperList, omrUpload, teacherFromBearer } from "@/server/omr-api";
import { paperResultsView, setWrittenMarks } from "@/server/paper-results";
import { addPaperQuestions, createPaper, finalizePaper, getPaper, paperKeys } from "@/server/papers";
import { createQuestion } from "@/server/questions";
import { createStudent } from "@/server/students";
import type { Teacher } from "@/server/teachers";
import { freshDb, makeTeacher } from "../helpers/db";

let db: Database;
let stranger: Teacher;
let phones = 0;
const phone = () => `0180${String(3000000 + ++phones).slice(-7)}`;

/**
 * A teacher with a final three-set paper of four MCQs (right answers 0–3 in turn), a draft paper,
 * and a final paper of a CQ only; their course has আবির at roll 1 and বর্ষা at roll 2.
 */
async function setup() {
  const t = await makeTeacher(db);
  const course = await createCourse(db, t.id, parseCourse({ title: "পদার্থবিজ্ঞান", access: "approval" }).course);
  const bankClass = await createBankClass(db, t.id, { name: "এইচএসসি" });
  const made = await createSubject(db, t.id, parseSubject({ name: "পদার্থ", classId: bankClass.id }).subject, ["বল"]);
  const subject = (await getSubject(db, t.id, made!.id))!;
  const ask = async (fields: Record<string, string>) => {
    const r = await createQuestion(db, t.id, parseQuestion({ subjectId: subject.id, chapterId: subject.chapters[0].id, ...fields }).question);
    if (!r.ok) throw new Error("no question");
    return r.question.id;
  };
  const mcqs: string[] = [];
  for (let i = 0; i < 4; i++) mcqs.push(await ask({ type: "mcq", stem: `প্রশ্ন ${i}`, option0: "ক", option1: "খ", option2: "গ", option3: "ঘ", answer: String(i) }));
  const cq = await ask({ type: "creative", stem: "সৃজনশীল", part0: "ক", part1: "খ", part2: "গ", part3: "ঘ" });
  for (const [i, name] of ["আবির", "বর্ষা"].entries()) {
    const student = await createStudent(db, { teacherId: t.id, name, phone: phone(), password: "secret1" });
    await enrollStudent(db, t.id, student.id, course.id, { batchId: null, roll: String(i + 1), fee: null });
  }
  const paperOf = async (title: string, ids: string[], final: boolean) => {
    const p = await createPaper(db, t.id, { ...parsePaper({ title, courseId: course.id, setCount: "3", mark: "1", negative: "0.25", shuffleQuestions: "on", shuffleOptions: "on" }).paper });
    if (!p.ok) throw new Error("no paper");
    await addPaperQuestions(db, t.id, p.paper.id, ids);
    if (final) await finalizePaper(db, t.id, p.paper.id);
    return (await getPaper(db, t.id, p.paper.id))!;
  };
  const paper = await paperOf("সাপ্তাহিক পরীক্ষা", mcqs, true);
  const draft = await paperOf("খসড়া পরীক্ষা", mcqs, false);
  const writtenOnly = await paperOf("লিখিত পরীক্ষা", [cq], true);
  const keys = await paperKeys(db, t.id, paper);
  const token = await createSession(db, { kind: "teacher", teacherId: t.id });
  return { t, course, paper, draft, writtenOnly, keys, token };
}

beforeAll(async () => {
  db = await freshDb();
  stranger = await makeTeacher(db);
});

describe("the app's sign-in", () => {
  it("is a teacher session sent as a Bearer token, and nothing else", async () => {
    const s = await setup();
    expect((await teacherFromBearer(db, `Bearer ${s.token}`))?.id).toBe(s.t.id);
    expect(await teacherFromBearer(db, null)).toBeNull();
    expect(await teacherFromBearer(db, s.token)).toBeNull();
    expect(await teacherFromBearer(db, "Bearer not-a-real-token-at-all")).toBeNull();
    // A student's session, even of this teacher's site, is no way in.
    const student = await createStudent(db, { teacherId: s.t.id, name: "ছাত্র", phone: phone(), password: "secret1" });
    const studentToken = await createSession(db, { kind: "student", teacherId: s.t.id, studentId: student.id });
    expect(await teacherFromBearer(db, `Bearer ${studentToken}`)).toBeNull();
  });
});

describe("papers for the app", () => {
  it("are the teacher's final papers with MCQs, in the app's own shape", async () => {
    const s = await setup();
    const list = await omrPaperList(db, s.t, "");
    expect(list).toEqual([
      {
        id: s.paper.id,
        title: "সাপ্তাহিক পরীক্ষা",
        code: `P-${s.paper.number}`,
        subject: "পদার্থবিজ্ঞান",
        questions: 4,
        options: 4,
        setCount: 3,
        firstSet: "101",
        lastSet: "103",
        author: s.t.nameEn,
        updated: expect.stringMatching(/^\d{1,2} \w{3} \d{4}$/),
      },
    ]);
    // Searching by code or title; another teacher sees none of them.
    expect(await omrPaperList(db, s.t, `p-${s.paper.number}`)).toHaveLength(1);
    expect(await omrPaperList(db, s.t, "নেই এমন")).toEqual([]);
    expect(await omrPaperList(db, stranger, "")).toEqual([]);
  });

  it("come with every set's key, the sheet's layout and the students by their sheet's roll", async () => {
    const s = await setup();
    const paper = await omrPaper(db, s.t, s.paper.id);
    if (typeof paper === "string") throw new Error(paper);
    expect(paper.sets["101"]).toEqual([0, 1, 2, 3]);
    expect(Object.keys(paper.sets)).toEqual(["101", "102", "103"]);
    for (const code of ["102", "103"]) expect(paper.sets[code]).toEqual(s.keys.get(Number(code)));
    expect(paper.layout).toEqual({ labels: "BANGLA", language: "Bangla", rollDigits: 2, setCode: true, institution: "", examName: "সাপ্তাহিক পরীক্ষা" });
    expect(paper.students).toEqual([
      { roll: "01", name: "আবির" },
      { roll: "02", name: "বর্ষা" },
    ]);
    // Not another teacher's, not a draft, not one without MCQs.
    expect(await omrPaper(db, stranger, s.paper.id)).toBe("missing");
    expect(await omrPaper(db, s.t, s.draft.id)).toBe("notFinal");
    expect(await omrPaper(db, s.t, s.writtenOnly.id)).toBe("missing");
  });
});

describe("sheets from the app", () => {
  it("are each checked, marked here against their own set's key, and named from the rolls", async () => {
    const s = await setup();
    const result = await omrUpload(db, s.t, s.paper.id, {
      sheets: [
        { roll: "01", setCode: "102", marks: encodeMarks(s.keys.get(102)!), scannedAt: Date.UTC(2030, 0, 10) },
        { roll: "9x", setCode: "101", marks: "" },
        { roll: "02", setCode: 104, marks: "" },
        { roll: "02", setCode: "101", marks: "<script>" },
        { roll: "07", setCode: 101, marks: "0,-,d1.3,3f" },
      ],
    });
    expect(result).toEqual({
      saved: 2,
      sheets: [
        { roll: "01", ok: true, name: "আবির", score: 4, total: 4 },
        { roll: "9x", ok: false, error: "roll" },
        { roll: "02", ok: false, error: "set" },
        { roll: "02", ok: false, error: "marks" },
        // Right, blank, two marks, right: 2 − 0.25; nobody in the course has roll 7.
        { roll: "07", ok: true, name: null, score: 1.75, total: 4 },
      ],
    });
    const view = await paperResultsView(db, s.t.id, s.paper.id);
    expect(view?.rows.map((row) => [row.roll, row.source, row.setCode, row.scoreHundredths])).toEqual([
      ["1", "scanner", 102, 400],
      ["7", "scanner", 101, 175],
    ]);
    expect(view?.rows[0].scannedAt).toEqual(new Date(Date.UTC(2030, 0, 10)));
  });

  it("sent again replace the roll's sheet, keeping the teacher's written marks", async () => {
    const s = await setup();
    const first = await omrUpload(db, s.t, s.paper.id, { sheets: [{ roll: "02", setCode: "101", marks: "" }] });
    if (typeof first === "string") throw new Error(first);
    const view = await paperResultsView(db, s.t.id, s.paper.id);
    await setWrittenMarks(db, s.t.id, view!.rows[0].id, 700);
    await omrUpload(db, s.t, s.paper.id, { sheets: [{ roll: "2", setCode: "101", marks: "0,1,2,3" }] });
    expect((await paperResultsView(db, s.t.id, s.paper.id))?.rows).toMatchObject([{ roll: "2", scoreHundredths: 400, writtenHundredths: 700, totalHundredths: 1100 }]);
  });

  it("are refused for a paper that isn't the teacher's or isn't final, and when the upload makes no sense", async () => {
    const s = await setup();
    const sheet = { roll: "01", setCode: "101", marks: "" };
    expect(await omrUpload(db, stranger, s.paper.id, { sheets: [sheet] })).toBe("missing");
    expect(await omrUpload(db, s.t, s.draft.id, { sheets: [sheet] })).toBe("notFinal");
    expect(await omrUpload(db, s.t, s.paper.id, { sheets: [] })).toBe("invalid");
    expect(await omrUpload(db, s.t, s.paper.id, null)).toBe("invalid");
    expect(await omrUpload(db, s.t, s.paper.id, { sheets: Array.from({ length: 501 }, () => sheet) })).toBe("invalid");
  });
});
