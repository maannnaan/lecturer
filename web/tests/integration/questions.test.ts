import { beforeAll, describe, expect, it } from "vitest";
import { parseChapter, parseCourse } from "@/lib/courses";
import { parseQuestion } from "@/lib/questions";
import { addChapter, chapterVisibility, createCourse, deleteChapter, deleteCourse, updateCourse } from "@/server/courses";
import type { Database } from "@/server/db";
import { media } from "@/server/db/schema";
import {
  createQuestion,
  deleteQuestion,
  duplicateQuestion,
  getQuestion,
  listChapterQuestions,
  listQuestions,
  moveQuestion,
  publicCountsByChapter,
  updateQuestion,
} from "@/server/questions";
import type { Teacher } from "@/server/teachers";
import { freshDb, makeTeacher } from "../helpers/db";

let db: Database;
let owner: Teacher;
let stranger: Teacher;

const course = (title: string, extra: Record<string, string> = {}) => parseCourse({ title, published: "on", ...extra }).course;
const chapter = (title: string) => parseChapter({ title }).chapter;

/** A valid question of the given type for parseQuestion, with overrides. */
function input(type: string, courseId: string, chapterId: string | null, extra: Record<string, string> = {}) {
  const base: Record<string, string> = { type, courseId, chapterId: chapterId ?? "", stem: `${type} প্রশ্ন` };
  if (type === "mcq" || type === "mcq_multi") Object.assign(base, { option0: "ক", option1: "খ", option2: "গ", option3: "ঘ", answer: "2" });
  if (type === "mcq_multi") Object.assign(base, { statement0: "i", statement1: "ii" });
  if (type === "creative") Object.assign(base, { part0: "ক", part1: "খ", part2: "গ", part3: "ঘ" });
  const { question, errors } = parseQuestion({ ...base, ...extra });
  expect(errors).toEqual({});
  return question;
}

async function setup(t: Teacher) {
  const c = await createCourse(db, t.id, course("পদার্থবিজ্ঞান"));
  const ch1 = (await addChapter(db, t.id, c.id, chapter("ভেক্টর")))!;
  const ch2 = (await addChapter(db, t.id, c.id, chapter("গতিবিদ্যা")))!;
  return { course: c, ch1, ch2 };
}

async function created(t: Teacher, q: ReturnType<typeof input>) {
  const result = await createQuestion(db, t.id, q);
  if (!result.ok) throw new Error(`not created: ${result.reason}`);
  return result.question;
}

beforeAll(async () => {
  db = await freshDb();
  owner = await makeTeacher(db);
  stranger = await makeTeacher(db);
});

describe("questions", () => {
  it("go to the end of their chapter, keep that order, and move up and down", async () => {
    const { course: c, ch1 } = await setup(owner);
    const a = await created(owner, input("mcq", c.id, ch1.id, { stem: "a" }));
    const b = await created(owner, input("short", c.id, ch1.id, { stem: "b" }));
    const third = await created(owner, input("creative", c.id, ch1.id, { stem: "c" }));
    expect([a.position, b.position, third.position]).toEqual([0, 1, 2]);

    const stems = async () => (await listQuestions(db, owner.id, { chapterId: ch1.id })).items.map((q) => q.body.stem);
    expect(await stems()).toEqual(["a", "b", "c"]);
    await moveQuestion(db, owner.id, third.id, "up");
    expect(await stems()).toEqual(["a", "c", "b"]);
    await moveQuestion(db, owner.id, a.id, "up"); // already first
    expect(await stems()).toEqual(["a", "c", "b"]);
  });

  it("are never reachable through another teacher", async () => {
    const { course: c, ch1 } = await setup(owner);
    const q = await created(owner, input("mcq", c.id, ch1.id));
    expect(await getQuestion(db, stranger.id, q.id)).toBeNull();
    expect((await updateQuestion(db, stranger.id, q.id, input("mcq", c.id, ch1.id, { stem: "hacked" }))).ok).toBe(false);
    expect(await deleteQuestion(db, stranger.id, q.id)).toBe(false);
    expect(await moveQuestion(db, stranger.id, q.id, "down")).toBe(false);
    expect(await duplicateQuestion(db, stranger.id, q.id)).toBeNull();
    expect((await getQuestion(db, owner.id, q.id))?.body.stem).toBe("mcq প্রশ্ন");
    // Nor can a stranger file a question into the owner's course.
    expect(await createQuestion(db, stranger.id, input("mcq", c.id, ch1.id))).toEqual({ ok: false, reason: "course" });
    expect((await listQuestions(db, stranger.id)).items.some((x) => x.id === q.id)).toBe(false);
  });

  it("refuse a chapter of another course and an image of another teacher", async () => {
    const { course: c } = await setup(owner);
    const other = await setup(owner);
    expect(await createQuestion(db, owner.id, input("mcq", c.id, other.ch1.id))).toEqual({ ok: false, reason: "chapter" });

    const [theirs] = await db
      .insert(media)
      .values({ teacherId: stranger.id, storage: "local", key: "x.webp", url: "/media/x.webp", contentType: "image/webp", bytes: 10 })
      .returning();
    const [mine] = await db
      .insert(media)
      .values({ teacherId: owner.id, storage: "local", key: "y.webp", url: "/media/y.webp", contentType: "image/webp", bytes: 10 })
      .returning();
    expect(await createQuestion(db, owner.id, input("mcq", c.id, null, { imageId: theirs.id }))).toEqual({ ok: false, reason: "image" });
    const withImage = await created(owner, input("mcq", c.id, null, { imageId: mine.id }));
    expect(withImage.body.image).toEqual({ mediaId: mine.id, url: "/media/y.webp" });
  });

  it("keep their image on edit, and move to the end of a new chapter", async () => {
    const { course: c, ch1, ch2 } = await setup(owner);
    const [img] = await db
      .insert(media)
      .values({ teacherId: owner.id, storage: "local", key: "z.webp", url: "/media/z.webp", contentType: "image/webp", bytes: 10 })
      .returning();
    await created(owner, input("short", c.id, ch2.id));
    const q = await created(owner, input("mcq", c.id, ch1.id, { imageId: img.id }));
    const moved = await updateQuestion(db, owner.id, q.id, input("mcq", c.id, ch2.id, { imageId: img.id, stem: "নতুন" }));
    expect(moved.ok && moved.question.chapterId).toBe(ch2.id);
    expect(moved.ok && moved.question.position).toBe(1);
    expect(moved.ok && moved.question.body.image?.url).toBe("/media/z.webp");
    const cleared = await updateQuestion(db, owner.id, q.id, input("mcq", c.id, ch2.id));
    expect(cleared.ok && cleared.question.body.image).toBeNull();
  });

  it("filter by type, board, visibility and text", async () => {
    const t = await makeTeacher(db);
    const { course: c, ch1 } = await setup(t);
    await created(t, input("mcq", c.id, ch1.id, { stem: "ঘর্ষণ বল 50% কমে", board: "dhaka", year: "2023" }));
    await created(t, input("mcq_multi", c.id, ch1.id, { stem: "ভরবেগ", board: "rajshahi" }));
    await created(t, input("creative", c.id, ch1.id, { stem: "আনত তল", visibility: "private" }));
    const count = async (filters: Parameters<typeof listQuestions>[2]) => (await listQuestions(db, t.id, filters)).total;
    expect(await count({})).toBe(3);
    expect(await count({ type: "mcq_multi" })).toBe(1);
    expect(await count({ board: "any" })).toBe(2);
    expect(await count({ board: "dhaka" })).toBe(1);
    expect(await count({ visibility: "private" })).toBe(1);
    expect(await count({ search: "ঘর্ষণ" })).toBe(1);
    // Search text is matched literally, wildcards included.
    expect(await count({ search: "50%" })).toBe(1);
    expect(await count({ search: "%" })).toBe(1);
    expect(await count({ search: "_" })).toBe(0);
  });

  it("show only public questions on the chapter page, with tab counts and filters", async () => {
    const t = await makeTeacher(db);
    const { course: c, ch1, ch2 } = await setup(t);
    await created(t, input("mcq", c.id, ch1.id, { board: "dhaka", year: "2023" }));
    await created(t, input("mcq_multi", c.id, ch1.id, { board: "sylhet", year: "2024" }));
    await created(t, input("creative", c.id, ch1.id));
    await created(t, input("short", c.id, ch1.id, { visibility: "private" }));
    await created(t, input("problem", c.id, ch2.id));

    const page = await listChapterQuestions(db, t.id, ch1.id, { tab: "mcq" });
    expect(page.counts).toEqual({ mcq: 2, short: 0, creative: 1, problem: 0, board: 2 });
    expect(page.items.map((q) => q.type)).toEqual(["mcq", "mcq_multi"]);
    expect(page.boards.sort()).toEqual(["dhaka", "sylhet"]);
    expect(page.years).toEqual([2024, 2023]);

    const board = await listChapterQuestions(db, t.id, ch1.id, { tab: "board", year: 2024 });
    expect(board.items.map((q) => q.board)).toEqual(["sylhet"]);
    expect((await listChapterQuestions(db, t.id, ch1.id, { tab: "short" })).items).toEqual([]);

    const counts = await publicCountsByChapter(db, t.id, c.id);
    expect(counts.get(ch1.id)).toBe(3);
    expect(counts.get(ch2.id)).toBe(1);
  });

  it("stay in the course when their chapter is deleted, and go with the course", async () => {
    const t = await makeTeacher(db);
    const { course: c, ch1 } = await setup(t);
    const q = await created(t, input("mcq", c.id, ch1.id));
    await deleteChapter(db, t.id, ch1.id);
    expect((await getQuestion(db, t.id, q.id))?.chapterId).toBeNull();
    expect((await listQuestions(db, t.id, { courseId: c.id, chapterId: "none" })).total).toBe(1);
    await deleteCourse(db, t.id, c.id);
    expect(await getQuestion(db, t.id, q.id)).toBeNull();
  });

  it("duplicate to the end of the same chapter", async () => {
    const t = await makeTeacher(db);
    const { course: c, ch1 } = await setup(t);
    const q = await created(t, input("creative", c.id, ch1.id, { stem: "মূল" }));
    const copy = await duplicateQuestion(db, t.id, q.id);
    expect(copy?.id).not.toBe(q.id);
    expect(copy?.body).toEqual(q.body);
    expect(copy?.position).toBe(1);
  });
});

describe("chapter addresses", () => {
  it("exist only for real chapters, and say whether the course is published", async () => {
    const t = await makeTeacher(db);
    const { course: c, ch2 } = await setup(t);
    expect(await chapterVisibility(db, t.id, c.number, ch2.number)).toBe("published");
    expect(await chapterVisibility(db, t.id, c.number, 99)).toBeNull();
    expect(await chapterVisibility(db, stranger.id, c.number, ch2.number)).toBeNull();
    await updateCourse(db, t.id, c.id, course("পদার্থবিজ্ঞান", { published: "" }));
    expect(await chapterVisibility(db, t.id, c.number, ch2.number)).toBe("draft");
  });
});
