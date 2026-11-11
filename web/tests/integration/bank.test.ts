import { beforeAll, describe, expect, it } from "vitest";
import { parseSubject } from "@/lib/bank";
import {
  type BankClass,
  addBankChapters,
  bankAddress,
  bankClassAddress,
  createBankClass,
  createSubject,
  deleteBankChapter,
  deleteSubject,
  getBankClass,
  getSubject,
  getSubjectByNumber,
  listBankClasses,
  listSubjectsWithChapters,
  moveBankChapter,
  removeBankClass,
  renameBankClass,
  updateBankChapter,
  updateSubject,
} from "@/server/bank";
import type { Database } from "@/server/db";
import type { Teacher } from "@/server/teachers";
import { freshDb, makeTeacher } from "../helpers/db";

let db: Database;
let stranger: Teacher;

const classOf = (t: Teacher, name: string) => createBankClass(db, t.id, { name });
const subject = (name: string, bankClass: BankClass) => parseSubject({ name, classId: bankClass.id }).subject;
/** A subject that must be created: the class is the teacher's own. */
const made = async (t: Teacher, name: string, bankClass: BankClass, chapters: string[] = []) =>
  (await createSubject(db, t.id, subject(name, bankClass), chapters))!;
const titles = async (t: Teacher, subjectId: string) => (await getSubject(db, t.id, subjectId))!.chapters.map((ch) => [ch.number, ch.title]);

beforeAll(async () => {
  db = await freshDb();
  stranger = await makeTeacher(db);
});

describe("bank classes", () => {
  it("are named by the teacher, numbered for good, and listed by the class each name reads as", async () => {
    const t = await makeTeacher(db);
    expect(await listBankClasses(db, t.id)).toEqual([]);
    const hsc = await classOf(t, "এইচএসসি ২০২৬ ব্যাচ");
    const spoken = await classOf(t, "স্পোকেন ইংলিশ");
    const nine = await classOf(t, "নবম শ্রেণি");
    expect([hsc.number, spoken.number, nine.number]).toEqual([1, 2, 3]);
    expect((await listBankClasses(db, t.id)).map((c) => c.name)).toEqual(["নবম শ্রেণি", "এইচএসসি ২০২৬ ব্যাচ", "স্পোকেন ইংলিশ"]);

    // A rename keeps the class's number, so its website address stays.
    expect(await renameBankClass(db, t.id, nine.id, { name: "নবম-দশম শ্রেণি" })).toMatchObject({ number: 3, name: "নবম-দশম শ্রেণি" });
    expect(await bankClassAddress(db, t.id, "3")).toEqual({ number: 3 });
    // Classes made from now on have no old fixed-list key.
    expect(await bankClassAddress(db, t.id, "hsc")).toBeNull();
    expect(await bankClassAddress(db, t.id, "9")).toBeNull();

    // A removed class's number is never handed out again.
    expect(await removeBankClass(db, t.id, spoken.id)).toBe(true);
    expect((await classOf(t, "ভর্তি পরীক্ষা")).number).toBe(4);
  });

  it("can be removed only while no subject is in them", async () => {
    const t = await makeTeacher(db);
    const hsc = await classOf(t, "এইচএসসি");
    const s = await made(t, "পদার্থবিজ্ঞান ১ম পত্র", hsc, ["ভেক্টর"]);
    expect(await removeBankClass(db, t.id, hsc.id)).toBe(false);
    expect((await getSubject(db, t.id, s.id))?.chapters).toHaveLength(1);

    // With its last subject gone, the class stays, empty, until the teacher removes it.
    await deleteSubject(db, t.id, s.id);
    expect((await listBankClasses(db, t.id)).map((c) => c.id)).toEqual([hsc.id]);
    expect(await removeBankClass(db, t.id, hsc.id)).toBe(true);
    expect(await removeBankClass(db, t.id, hsc.id)).toBe(false);
    expect(await listBankClasses(db, t.id)).toEqual([]);
  });

  it("are each teacher's own", async () => {
    const t = await makeTeacher(db);
    const mine = await classOf(t, "অষ্টম শ্রেণি");
    expect(await listBankClasses(db, stranger.id)).toEqual([]);
    expect(await getBankClass(db, stranger.id, mine.id)).toBeNull();
    expect(await renameBankClass(db, stranger.id, mine.id, { name: "hacked" })).toBeNull();
    expect(await removeBankClass(db, stranger.id, mine.id)).toBe(false);
    expect(await bankClassAddress(db, stranger.id, String(mine.number))).toBeNull();
    // Nobody files a subject under another teacher's class, or moves one there.
    const other = await makeTeacher(db);
    expect(await createSubject(db, other.id, subject("hacked", mine))).toBeNull();
    const own = await made(other, "গণিত", await classOf(other, "সপ্তম শ্রেণি"));
    expect(await updateSubject(db, other.id, own.id, subject("গণিত", mine))).toBeNull();
    expect((await getBankClass(db, t.id, mine.id))?.name).toBe("অষ্টম শ্রেণি");
  });
});

describe("bank subjects", () => {
  it("are numbered per teacher, and a deleted subject's number is never handed out again", async () => {
    const t = await makeTeacher(db);
    const hsc = await classOf(t, "এইচএসসি");
    const first = await made(t, "পদার্থবিজ্ঞান ১ম পত্র", hsc);
    const second = await made(t, "রসায়ন ১ম পত্র", hsc);
    expect([first.number, second.number]).toEqual([1, 2]);
    await deleteSubject(db, t.id, second.id);
    expect((await made(t, "জীববিজ্ঞান", hsc)).number).toBe(3);
    expect((await listSubjectsWithChapters(db, t.id)).map((s) => s.name)).toEqual(["পদার্থবিজ্ঞান ১ম পত্র", "জীববিজ্ঞান"]);
    expect((await getSubjectByNumber(db, t.id, 1))?.id).toBe(first.id);
    expect(await getSubjectByNumber(db, t.id, 2)).toBeNull();
  });

  it("start with their chapters in order, and later chapters number on from the last ever", async () => {
    const t = await makeTeacher(db);
    const s = await made(t, "গণিত", await classOf(t, "এসএসসি"), ["সেট", "বীজগণিত", "জ্যামিতি"]);
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
    const hsc = await classOf(t, "এইচএসসি");
    const s = await made(t, "পদার্থবিজ্ঞান", hsc, ["ক", "খ", "গ"]);
    const [a, b] = (await getSubject(db, t.id, s.id))!.chapters;
    expect(await updateBankChapter(db, t.id, a.id, { label: "অধ্যায় ১০", title: "তরঙ্গ" })).toMatchObject({ label: "অধ্যায় ১০", title: "তরঙ্গ" });
    await moveBankChapter(db, t.id, b.id, "up");
    expect((await titles(t, s.id)).map(([, title]) => title)).toEqual(["খ", "তরঙ্গ", "গ"]);
    const admission = await classOf(t, "ভর্তি পরীক্ষা");
    expect(await updateSubject(db, t.id, s.id, subject("পদার্থবিজ্ঞান", admission))).toMatchObject({ classId: admission.id });
    // The class it left is empty now and can go.
    expect(await removeBankClass(db, t.id, hsc.id)).toBe(true);
  });

  it("are never reachable through another teacher", async () => {
    const t = await makeTeacher(db);
    const hsc = await classOf(t, "এইচএসসি");
    const s = await made(t, "রসায়ন", hsc, ["পরমাণুর গঠন"]);
    const [chapter] = (await getSubject(db, t.id, s.id))!.chapters;
    const theirs = await classOf(stranger, "দ্বাদশ শ্রেণি");
    expect(await getSubject(db, stranger.id, s.id)).toBeNull();
    expect(await getSubjectByNumber(db, stranger.id, s.number)).toBeNull();
    expect(await updateSubject(db, stranger.id, s.id, subject("hacked", theirs))).toBeNull();
    expect(await deleteSubject(db, stranger.id, s.id)).toBe(false);
    expect(await addBankChapters(db, stranger.id, s.id, ["hacked"])).toBeNull();
    expect(await updateBankChapter(db, stranger.id, chapter.id, { label: "", title: "hacked" })).toBeNull();
    expect(await deleteBankChapter(db, stranger.id, chapter.id)).toBe(false);
    expect(await moveBankChapter(db, stranger.id, chapter.id, "down")).toBe(false);
    expect(await bankAddress(db, stranger.id, s.number)).toBeNull();
    expect(await titles(t, s.id)).toEqual([[1, "পরমাণুর গঠন"]]);
    expect(await getSubject(db, t.id, s.id)).toMatchObject({ name: "রসায়ন", classId: hsc.id });
  });

  it("answer the website's addresses with the number of the class they are in now", async () => {
    const t = await makeTeacher(db);
    await classOf(t, "সপ্তম শ্রেণি");
    const eight = await classOf(t, "অষ্টম শ্রেণি");
    const s = await made(t, "ইংরেজি", eight, ["Grammar"]);
    expect(await bankAddress(db, t.id, s.number)).toEqual({ classNumber: 2 });
    expect(await bankAddress(db, t.id, s.number, 1)).toEqual({ classNumber: 2 });
    expect(await bankAddress(db, t.id, s.number, 2)).toBeNull();
    expect(await bankAddress(db, t.id, 999)).toBeNull();
    expect(await bankAddress(db, t.id, 0)).toBeNull();
  });
});
