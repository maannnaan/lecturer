import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { parseCourse } from "@/lib/courses";
import {
  bankAddress,
  bankClassAddress,
  createBankClass,
  createSubject,
  deleteBankChapter,
  getSubject,
  listBankClasses,
  listSubjectsWithChapters,
  removeBankClass,
} from "@/server/bank";
import { createCourse, deleteCourse } from "@/server/courses";
import type { Database } from "@/server/db";
import { courses } from "@/server/db/schema";
import { getQuestion } from "@/server/questions";
import { dbBeforeMigration, freshDb, makeTeacher } from "../helpers/db";

describe("migration 0003_bank_by_class", () => {
  let db: Database;
  beforeAll(async () => {
    db = await freshDb();
  });

  it("reads each existing course's class from its old free-text level, or else its title", async () => {
    const t = await makeTeacher(db);
    // [title, old level, the class it should land in]
    const cases: [string, string, string][] = [
      ["পদার্থবিজ্ঞান ১ম পত্র", "এইচএসসি", "hsc"],
      ["HSC Chemistry", "", "hsc"],
      ["একাদশ শ্রেণির গণিত", "", "hsc"],
      ["উচ্চতর গণিত", "এসএসসি", "ssc"],
      ["Physics", "Class 10", "ssc"],
      ["দাখিল গণিত", "", "ssc"],
      ["বিজ্ঞান", "Class 8", "class-8"],
      ["গণিত", "সপ্তম শ্রেণি", "class-7"],
      ["ইংরেজি", "ষষ্ঠ শ্রেণি", "class-6"],
      ["মেডিকেল ভর্তি প্রস্তুতি", "", "admission"],
      ["স্পোকেন ইংলিশ", "", "other"],
    ];
    const ids: string[] = [];
    for (const [title, level] of cases) {
      const course = await createCourse(db, t.id, parseCourse({ title }).course);
      // As the course was before the migration: a level, and no class yet.
      // (`level` has left the schema since, so it is set with plain SQL.)
      await db.execute(sql`update courses set level = ${level}, grade = 'other' where id = ${course.id}`);
      ids.push(course.id);
    }

    const migration = readFileSync(new URL("../../drizzle/0003_bank_by_class.sql", import.meta.url), "utf8");
    const backfill = migration.split("--> statement-breakpoint").find((statement) => statement.includes("UPDATE"));
    await db.execute(sql.raw(backfill!));

    const rows = await db.select({ id: courses.id, grade: courses.grade }).from(courses).where(eq(courses.teacherId, t.id));
    const grades = new Map(rows.map((row) => [row.id, row.grade]));
    expect(ids.map((id) => grades.get(id))).toEqual(cases.map(([, , grade]) => grade));
  });
});

describe("migration 0004_bank_subjects", () => {
  it("turns each course that has questions into a bank subject, keeping every question where it was", async () => {
    const { db, finish } = await dbBeforeMigration(4);
    const one = async <T>(query: ReturnType<typeof sql>) => ((await db.execute(query)) as unknown as { rows: T[] }).rows[0];
    const teacher = await one<{ id: string }>(
      sql`insert into teachers (handle, name_bn, name_en, phone, password_hash) values ('t1', 'ক', 'K', '01711111111', 'x') returning id`,
    );
    const course = async (number: number, title: string, subject: string, grade: string, position: number) =>
      one<{ id: string }>(
        sql`insert into courses (teacher_id, number, title, subject, grade, position, chapter_counter, published)
            values (${teacher.id}, ${number}, ${title}, ${subject}, ${grade}, ${position}, 2, true) returning id`,
      );
    const chapter = async (courseId: string, number: number, title: string) =>
      one<{ id: string }>(
        sql`insert into chapters (teacher_id, course_id, number, title, position) values (${teacher.id}, ${courseId}, ${number}, ${title}, ${number - 1}) returning id`,
      );
    const question = async (courseId: string, chapterId: string | null, stem: string) =>
      one<{ id: string }>(
        sql`insert into questions (teacher_id, course_id, chapter_id, type, body)
            values (${teacher.id}, ${courseId}, ${chapterId}, 'mcq', ${JSON.stringify({ stem })}::jsonb) returning id`,
      );

    // An advert-only course with no questions, and two courses with questions (listed second, then first).
    await course(1, "বিজ্ঞাপনের কোর্স", "", "ssc", 0);
    const chem = await course(2, "রসায়ন সকাল", "রসায়ন ১ম পত্র", "hsc", 2);
    const phys = await course(3, "পদার্থবিজ্ঞান ১ম পত্র", "", "hsc", 1);
    const vectors = await chapter(phys.id, 1, "ভেক্টর");
    await chapter(phys.id, 2, "গতিবিদ্যা");
    const filed = await question(phys.id, vectors.id, "ভেক্টর প্রশ্ন");
    const loose = await question(phys.id, null, "অধ্যায়বিহীন প্রশ্ন");
    await question(chem.id, null, "রসায়ন প্রশ্ন");

    await finish();

    // Only the courses with questions, in the teacher's course order, named by subject or title.
    const subjects = await listSubjectsWithChapters(db, teacher.id);
    expect(subjects.map((s) => [s.id, s.number, s.name])).toEqual([
      [phys.id, 1, "পদার্থবিজ্ঞান ১ম পত্র"],
      [chem.id, 2, "রসায়ন ১ম পত্র"],
    ]);
    expect(subjects[0].chapters.map((ch) => [ch.id, ch.number, ch.title])).toEqual([
      [vectors.id, 1, "ভেক্টর"],
      [expect.any(String), 2, "গতিবিদ্যা"],
    ]);

    // Every question kept its place: its subject, and its chapter (now the subject's).
    expect(await getQuestion(db, teacher.id, filed.id)).toMatchObject({ subjectId: phys.id, chapterId: vectors.id });
    expect(await getQuestion(db, teacher.id, loose.id)).toMatchObject({ subjectId: phys.id, chapterId: null });

    // The bank no longer hangs on the courses: deleting one leaves the questions alone…
    expect(await deleteCourse(db, teacher.id, phys.id)).toBe(true);
    expect(await getQuestion(db, teacher.id, filed.id)).not.toBeNull();
    // …while deleting a bank chapter unfiles its questions, as it should.
    await deleteBankChapter(db, teacher.id, vectors.id);
    expect((await getQuestion(db, teacher.id, filed.id))?.chapterId).toBeNull();

    // Migrations 0006 and 0007: the subjects' class became a class of the teacher's own, by name.
    const [hsc] = await listBankClasses(db, teacher.id);
    expect(hsc).toMatchObject({ number: 1, name: "এইচএসসি", legacyGrade: "hsc" });
    expect(subjects.every((s) => s.classId === hsc.id)).toBe(true);
    // New subjects number on from the migrated ones.
    const next = await createSubject(db, teacher.id, { classId: hsc.id, group: "", name: "গণিত" });
    expect(next?.number).toBe(3);
    expect((await getSubject(db, teacher.id, chem.id))?.chapters).toEqual([]);
    // Migration 0005: subjects and questions from before start with no group and no difficulty.
    expect((await getSubject(db, teacher.id, chem.id))?.group).toBe("");
    expect((await getQuestion(db, teacher.id, filed.id))?.difficulty).toBe("");
  });
});

describe("migration 0006_bank_classes", () => {
  it("keeps in the bank every class that has subjects, each teacher's own", async () => {
    const { db, finish } = await dbBeforeMigration(6);
    const one = async <T>(query: ReturnType<typeof sql>) => ((await db.execute(query)) as unknown as { rows: T[] }).rows[0];
    const teacher = async (handle: string, phone: string) =>
      one<{ id: string }>(sql`insert into teachers (handle, name_bn, name_en, phone, password_hash) values (${handle}, 'ক', 'K', ${phone}, 'x') returning id`);
    const subject = async (teacherId: string, number: number, grade: string) =>
      db.execute(sql`insert into bank_subjects (teacher_id, number, grade, name) values (${teacherId}, ${number}, ${grade}, 'বিষয়')`);
    const a = await teacher("t1", "01711111111");
    const b = await teacher("t2", "01722222222");
    const none = await teacher("t3", "01733333333");
    await subject(a.id, 1, "hsc");
    await subject(a.id, 2, "hsc");
    await subject(a.id, 3, "class-6");
    await subject(b.id, 1, "admission");

    await finish();

    const keys = async (teacherId: string) => (await listBankClasses(db, teacherId)).map((c) => c.legacyGrade);
    expect(await keys(a.id)).toEqual(["class-6", "hsc"]);
    expect(await keys(b.id)).toEqual(["admission"]);
    expect(await keys(none.id)).toEqual([]);
  });
});

describe("migration 0007_typed_classes", () => {
  it("names and numbers the classes so far, keeps their old keys for old addresses, and files each subject in its class", async () => {
    const { db, finish } = await dbBeforeMigration(7);
    const one = async <T>(query: ReturnType<typeof sql>) => ((await db.execute(query)) as unknown as { rows: T[] }).rows[0];
    const teacher = async (handle: string, phone: string, locale: string) =>
      one<{ id: string }>(
        sql`insert into teachers (handle, name_bn, name_en, phone, password_hash, locale) values (${handle}, 'ক', 'K', ${phone}, 'x', ${locale}) returning id`,
      );
    const addClass = (teacherId: string, grade: string) => db.execute(sql`insert into bank_classes (teacher_id, grade) values (${teacherId}, ${grade})`);
    const subject = async (teacherId: string, number: number, grade: string) =>
      one<{ id: string }>(sql`insert into bank_subjects (teacher_id, number, grade, name) values (${teacherId}, ${number}, ${grade}, 'বিষয়') returning id`);
    const bn = await teacher("t1", "01711111111", "bn");
    const en = await teacher("t2", "01722222222", "en");
    await addClass(bn.id, "hsc");
    await addClass(bn.id, "ssc");
    await addClass(bn.id, "admission");
    const physics = await subject(bn.id, 1, "hsc");
    const maths = await subject(bn.id, 2, "ssc");
    // A subject whose class has no row (an older deployment made it while 0006 went live).
    const loose = await subject(bn.id, 3, "class-7");
    await addClass(en.id, "hsc");

    await finish();

    // Numbered in the old list's order, named as it called them, listed by the class each reads as.
    const classes = await listBankClasses(db, bn.id);
    expect(classes.map((c) => [c.name, c.number, c.legacyGrade])).toEqual([
      ["সপ্তম শ্রেণি", 1, "class-7"],
      ["এসএসসি", 2, "ssc"],
      ["এইচএসসি", 3, "hsc"],
      ["ভর্তি পরীক্ষা", 4, "admission"],
    ]);
    const idOf = new Map(classes.map((c) => [c.legacyGrade, c.id]));
    expect((await getSubject(db, bn.id, physics.id))?.classId).toBe(idOf.get("hsc"));
    expect((await getSubject(db, bn.id, maths.id))?.classId).toBe(idOf.get("ssc"));
    expect((await getSubject(db, bn.id, loose.id))?.classId).toBe(idOf.get("class-7"));
    // A website that opens in English gets English names.
    expect((await listBankClasses(db, en.id)).map((c) => [c.name, c.number])).toEqual([["HSC", 1]]);

    // Old addresses find their classes, and subjects answer with their class's number.
    expect(await bankClassAddress(db, bn.id, "hsc")).toEqual({ number: 3 });
    expect(await bankClassAddress(db, bn.id, "class-6")).toBeNull();
    expect(await bankAddress(db, bn.id, 1)).toEqual({ classNumber: 3 });
    // New classes number on, and the empty admission class can go while the others can't.
    expect((await createBankClass(db, bn.id, { name: "দশম শ্রেণি" })).number).toBe(5);
    expect(await removeBankClass(db, bn.id, idOf.get("admission")!)).toBe(true);
    expect(await removeBankClass(db, bn.id, idOf.get("hsc")!)).toBe(false);
  });
});
