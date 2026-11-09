import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { parseCourse } from "@/lib/courses";
import { createSubject, deleteBankChapter, getSubject, listSubjectsWithChapters } from "@/server/bank";
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
      await db.update(courses).set({ level, grade: "other" }).where(eq(courses.id, course.id));
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
    expect(subjects.map((s) => [s.id, s.number, s.grade, s.name])).toEqual([
      [phys.id, 1, "hsc", "পদার্থবিজ্ঞান ১ম পত্র"],
      [chem.id, 2, "hsc", "রসায়ন ১ম পত্র"],
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

    // New subjects number on from the migrated ones.
    const next = await createSubject(db, teacher.id, { grade: "ssc", name: "গণিত" });
    expect(next.number).toBe(3);
    expect((await getSubject(db, teacher.id, chem.id))?.chapters).toEqual([]);
  });
});
