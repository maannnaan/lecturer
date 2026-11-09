import { beforeAll, describe, expect, it } from "vitest";
import { parseSubject } from "@/lib/bank";
import {
  addBankChapters,
  bankAddress,
  createSubject,
  deleteBankChapter,
  deleteSubject,
  getSubject,
  getSubjectByNumber,
  listSubjectsWithChapters,
  moveBankChapter,
  updateBankChapter,
  updateSubject,
} from "@/server/bank";
import type { Database } from "@/server/db";
import type { Teacher } from "@/server/teachers";
import { freshDb, makeTeacher } from "../helpers/db";

let db: Database;
let stranger: Teacher;

const subject = (name: string, grade = "hsc") => parseSubject({ name, grade }).subject;
const titles = async (t: Teacher, subjectId: string) => (await getSubject(db, t.id, subjectId))!.chapters.map((ch) => [ch.number, ch.title]);

beforeAll(async () => {
  db = await freshDb();
  stranger = await makeTeacher(db);
});

describe("bank subjects", () => {
  it("are numbered per teacher, and a deleted subject's number is never handed out again", async () => {
    const t = await makeTeacher(db);
    const first = await createSubject(db, t.id, subject("পদার্থবিজ্ঞান ১ম পত্র"));
    const second = await createSubject(db, t.id, subject("রসায়ন ১ম পত্র"));
    expect([first.number, second.number]).toEqual([1, 2]);
    await deleteSubject(db, t.id, second.id);
    expect((await createSubject(db, t.id, subject("জীববিজ্ঞান"))).number).toBe(3);
    expect((await listSubjectsWithChapters(db, t.id)).map((s) => s.name)).toEqual(["পদার্থবিজ্ঞান ১ম পত্র", "জীববিজ্ঞান"]);
    expect((await getSubjectByNumber(db, t.id, 1))?.id).toBe(first.id);
    expect(await getSubjectByNumber(db, t.id, 2)).toBeNull();
  });

  it("start with their chapters in order, and later chapters number on from the last ever", async () => {
    const t = await makeTeacher(db);
    const s = await createSubject(db, t.id, subject("গণিত", "ssc"), ["সেট", "বীজগণিত", "জ্যামিতি"]);
    expect(await titles(t, s.id)).toEqual([
      [1, "সেট"],
      [2, "বীজগণিত"],
      [3, "জ্যামিতি"],
    ]);
    const third = (await getSubject(db, t.id, s.id))!.chapters[2];
    await deleteBankChapter(db, t.id, third.id);
    const added = await addBankChapters(db, t.id, s.id, ["ত্রিকোণমিতি", "সম্ভাবনা"]);
    expect(added?.map((ch) => ch.number)).toEqual([4, 5]);
    expect(await titles(t, s.id)).toEqual([
      [1, "সেট"],
      [2, "বীজগণিত"],
      [4, "ত্রিকোণমিতি"],
      [5, "সম্ভাবনা"],
    ]);
  });

  it("rename and reorder their chapters, and move to another class", async () => {
    const t = await makeTeacher(db);
    const s = await createSubject(db, t.id, subject("পদার্থবিজ্ঞান"), ["ক", "খ", "গ"]);
    const [a, b] = (await getSubject(db, t.id, s.id))!.chapters;
    expect(await updateBankChapter(db, t.id, a.id, { label: "অধ্যায় ১০", title: "তরঙ্গ" })).toMatchObject({ label: "অধ্যায় ১০", title: "তরঙ্গ" });
    await moveBankChapter(db, t.id, b.id, "up");
    expect((await titles(t, s.id)).map(([, title]) => title)).toEqual(["খ", "তরঙ্গ", "গ"]);
    expect(await updateSubject(db, t.id, s.id, subject("পদার্থবিজ্ঞান", "admission"))).toMatchObject({ grade: "admission" });
  });

  it("are never reachable through another teacher", async () => {
    const t = await makeTeacher(db);
    const s = await createSubject(db, t.id, subject("রসায়ন"), ["পরমাণুর গঠন"]);
    const [chapter] = (await getSubject(db, t.id, s.id))!.chapters;
    expect(await getSubject(db, stranger.id, s.id)).toBeNull();
    expect(await getSubjectByNumber(db, stranger.id, s.number)).toBeNull();
    expect(await updateSubject(db, stranger.id, s.id, subject("hacked"))).toBeNull();
    expect(await deleteSubject(db, stranger.id, s.id)).toBe(false);
    expect(await addBankChapters(db, stranger.id, s.id, ["hacked"])).toBeNull();
    expect(await updateBankChapter(db, stranger.id, chapter.id, { label: "", title: "hacked" })).toBeNull();
    expect(await deleteBankChapter(db, stranger.id, chapter.id)).toBe(false);
    expect(await moveBankChapter(db, stranger.id, chapter.id, "down")).toBe(false);
    expect(await bankAddress(db, stranger.id, s.number)).toBeNull();
    expect(await titles(t, s.id)).toEqual([[1, "পরমাণুর গঠন"]]);
    expect((await getSubject(db, t.id, s.id))?.name).toBe("রসায়ন");
  });

  it("answer the website's addresses with the class they are in now", async () => {
    const t = await makeTeacher(db);
    const s = await createSubject(db, t.id, subject("ইংরেজি", "class-8"), ["Grammar"]);
    expect(await bankAddress(db, t.id, s.number)).toEqual({ grade: "class-8" });
    expect(await bankAddress(db, t.id, s.number, 1)).toEqual({ grade: "class-8" });
    expect(await bankAddress(db, t.id, s.number, 2)).toBeNull();
    expect(await bankAddress(db, t.id, 999)).toBeNull();
    expect(await bankAddress(db, t.id, 0)).toBeNull();
  });
});
