import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { parseCourse } from "@/lib/courses";
import { createCourse } from "@/server/courses";
import type { Database } from "@/server/db";
import { courses } from "@/server/db/schema";
import { freshDb, makeTeacher } from "../helpers/db";

let db: Database;

beforeAll(async () => {
  db = await freshDb();
});

describe("migration 0003_bank_by_class", () => {
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
