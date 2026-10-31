import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/server/db";
import { chapters, courses, teachers } from "@/server/db/schema";
import type { parseChapter, parseCourse } from "@/lib/courses";
import { isUuid } from "@/lib/ids";

// Every function takes the teacher's id from the session and filters on it as well as on the
// record's own id: a course or chapter id belonging to another teacher simply isn't found.

export type Course = typeof courses.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type CourseInput = ReturnType<typeof parseCourse>["course"];
export type ChapterInput = ReturnType<typeof parseChapter>["chapter"];
export type CourseWithChapters = Course & { chapters: Chapter[] };

const byOrder = [asc(courses.position), asc(courses.number)];
const chapterOrder = [asc(chapters.position), asc(chapters.number)];

export async function listCourses(db: Database, teacherId: string): Promise<Course[]> {
  return db.select().from(courses).where(eq(courses.teacherId, teacherId)).orderBy(...byOrder);
}

export async function getCourse(db: Database, teacherId: string, courseId: string): Promise<Course | null> {
  if (!isUuid(courseId)) return null;
  const [row] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.teacherId, teacherId)))
    .limit(1);
  return row ?? null;
}

/** Adds a course at the end of the teacher's list, with the next never-used course number. */
export async function createCourse(db: Database, teacherId: string, input: CourseInput): Promise<Course> {
  return db.transaction(async (tx) => {
    const [{ number }] = await tx
      .update(teachers)
      .set({ courseCounter: sql`${teachers.courseCounter} + 1` })
      .where(eq(teachers.id, teacherId))
      .returning({ number: teachers.courseCounter });
    const [{ last }] = await tx
      .select({ last: sql<number>`coalesce(max(${courses.position}), -1)` })
      .from(courses)
      .where(eq(courses.teacherId, teacherId));
    const [course] = await tx
      .insert(courses)
      .values({ ...input, teacherId, number, position: Number(last) + 1 })
      .returning();
    return course;
  });
}

export async function updateCourse(
  db: Database,
  teacherId: string,
  courseId: string,
  input: CourseInput,
): Promise<Course | null> {
  if (!isUuid(courseId)) return null;
  const [row] = await db
    .update(courses)
    .set(input)
    .where(and(eq(courses.id, courseId), eq(courses.teacherId, teacherId)))
    .returning();
  return row ?? null;
}

/** Deletes a course and, with it, its chapters. Its number is never handed out again. */
export async function deleteCourse(db: Database, teacherId: string, courseId: string): Promise<boolean> {
  if (!isUuid(courseId)) return false;
  const gone = await db
    .delete(courses)
    .where(and(eq(courses.id, courseId), eq(courses.teacherId, teacherId)))
    .returning({ id: courses.id });
  return gone.length > 0;
}

/** Rewrites positions 0…n-1 in the given order, touching only rows whose position changed. */
async function renumber<T extends { id: string; position: number }>(
  db: Database,
  rows: T[],
  write: (tx: Parameters<Parameters<Database["transaction"]>[0]>[0], id: string, position: number) => Promise<unknown>,
) {
  await db.transaction(async (tx) => {
    for (const [position, row] of rows.entries()) if (row.position !== position) await write(tx, row.id, position);
  });
}

function swapped<T extends { id: string }>(rows: T[], id: string, direction: "up" | "down"): T[] | null {
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return rows;
  const next = rows.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Moves a course one place up or down the teacher's list. False if it isn't this teacher's. */
export async function moveCourse(
  db: Database,
  teacherId: string,
  courseId: string,
  direction: "up" | "down",
): Promise<boolean> {
  const order = swapped(await listCourses(db, teacherId), courseId, direction);
  if (!order) return false;
  await renumber(db, order, (tx, id, position) =>
    tx.update(courses).set({ position }).where(and(eq(courses.id, id), eq(courses.teacherId, teacherId))),
  );
  return true;
}

export async function listChapters(db: Database, teacherId: string, courseId: string): Promise<Chapter[]> {
  if (!isUuid(courseId)) return [];
  return db
    .select()
    .from(chapters)
    .where(and(eq(chapters.courseId, courseId), eq(chapters.teacherId, teacherId)))
    .orderBy(...chapterOrder);
}

/** Adds a chapter at the end of a course. Null when the course isn't this teacher's. */
export async function addChapter(
  db: Database,
  teacherId: string,
  courseId: string,
  input: ChapterInput,
): Promise<Chapter | null> {
  if (!isUuid(courseId)) return null;
  return db.transaction(async (tx) => {
    const [course] = await tx
      .update(courses)
      .set({ chapterCounter: sql`${courses.chapterCounter} + 1` })
      .where(and(eq(courses.id, courseId), eq(courses.teacherId, teacherId)))
      .returning({ number: courses.chapterCounter });
    if (!course) return null;
    const [{ last }] = await tx
      .select({ last: sql<number>`coalesce(max(${chapters.position}), -1)` })
      .from(chapters)
      .where(eq(chapters.courseId, courseId));
    const [chapter] = await tx
      .insert(chapters)
      .values({ ...input, teacherId, courseId, number: course.number, position: Number(last) + 1 })
      .returning();
    return chapter;
  });
}

export async function updateChapter(
  db: Database,
  teacherId: string,
  chapterId: string,
  input: ChapterInput,
): Promise<Chapter | null> {
  if (!isUuid(chapterId)) return null;
  const [row] = await db
    .update(chapters)
    .set(input)
    .where(and(eq(chapters.id, chapterId), eq(chapters.teacherId, teacherId)))
    .returning();
  return row ?? null;
}

export async function deleteChapter(db: Database, teacherId: string, chapterId: string): Promise<boolean> {
  if (!isUuid(chapterId)) return false;
  const gone = await db
    .delete(chapters)
    .where(and(eq(chapters.id, chapterId), eq(chapters.teacherId, teacherId)))
    .returning({ id: chapters.id });
  return gone.length > 0;
}

export async function moveChapter(
  db: Database,
  teacherId: string,
  chapterId: string,
  direction: "up" | "down",
): Promise<boolean> {
  if (!isUuid(chapterId)) return false;
  const [chapter] = await db
    .select({ courseId: chapters.courseId })
    .from(chapters)
    .where(and(eq(chapters.id, chapterId), eq(chapters.teacherId, teacherId)))
    .limit(1);
  if (!chapter) return false;
  const order = swapped(await listChapters(db, teacherId, chapter.courseId), chapterId, direction);
  if (!order) return false;
  await renumber(db, order, (tx, id, position) =>
    tx.update(chapters).set({ position }).where(and(eq(chapters.id, id), eq(chapters.teacherId, teacherId))),
  );
  return true;
}

/** What the teacher's website lists: published courses in order, each with its chapters. */
export async function listPublishedCourses(db: Database, teacherId: string): Promise<CourseWithChapters[]> {
  const list = await db
    .select()
    .from(courses)
    .where(and(eq(courses.teacherId, teacherId), eq(courses.published, true)))
    .orderBy(...byOrder);
  if (list.length === 0) return [];
  const all = await db
    .select()
    .from(chapters)
    .where(
      and(
        eq(chapters.teacherId, teacherId),
        inArray(
          chapters.courseId,
          list.map((c) => c.id),
        ),
      ),
    )
    .orderBy(...chapterOrder);
  return list.map((course) => ({ ...course, chapters: all.filter((ch) => ch.courseId === course.id) }));
}

/** Whether a course number exists for this teacher, and if so whether it is published. */
export async function courseVisibility(
  db: Database,
  teacherId: string,
  number: number,
): Promise<"published" | "draft" | null> {
  if (!Number.isSafeInteger(number) || number < 1) return null;
  const [row] = await db
    .select({ published: courses.published })
    .from(courses)
    .where(and(eq(courses.teacherId, teacherId), eq(courses.number, number)))
    .limit(1);
  return row ? (row.published ? "published" : "draft") : null;
}

/** How many chapters each of the teacher's courses has, by course id. */
export async function chapterCounts(db: Database, teacherId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ courseId: chapters.courseId, n: sql<number>`count(*)` })
    .from(chapters)
    .where(eq(chapters.teacherId, teacherId))
    .groupBy(chapters.courseId);
  return new Map(rows.map((r) => [r.courseId, Number(r.n)]));
}

/** One course by its public number, with its chapters; drafts only when `includeDrafts`. */
export async function getCourseByNumber(
  db: Database,
  teacherId: string,
  number: number,
  includeDrafts = false,
): Promise<CourseWithChapters | null> {
  if (!Number.isSafeInteger(number) || number < 1) return null;
  const [course] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.teacherId, teacherId), eq(courses.number, number)))
    .limit(1);
  if (!course || (!course.published && !includeDrafts)) return null;
  return { ...course, chapters: await listChapters(db, teacherId, course.id) };
}
