import { beforeAll, describe, expect, it } from "vitest";
import { parseChapter, parseCourse } from "@/lib/courses";
import {
  addChapter,
  createCourse,
  deleteChapter,
  deleteCourse,
  getCourse,
  getCourseByNumber,
  listChapters,
  listCourses,
  listPublishedCourses,
  moveChapter,
  moveCourse,
  updateChapter,
  updateCourse,
} from "@/server/courses";
import type { Database } from "@/server/db";
import type { Teacher } from "@/server/teachers";
import { freshDb, makeTeacher } from "../helpers/db";

const course = (title: string, extra: Record<string, string> = {}) => parseCourse({ title, ...extra }).course;
const chapter = (title: string, extra: Record<string, string> = {}) => parseChapter({ title, ...extra }).chapter;

let db: Database;
let owner: Teacher;
let stranger: Teacher;

beforeAll(async () => {
  db = await freshDb();
  owner = await makeTeacher(db);
  stranger = await makeTeacher(db);
});

describe("courses", () => {
  it("get numbers 1, 2, 3… per teacher, never reused after a delete", async () => {
    const t = await makeTeacher(db);
    const a = await createCourse(db, t.id, course("A"));
    const b = await createCourse(db, t.id, course("B"));
    expect([a.number, b.number]).toEqual([1, 2]);
    await deleteCourse(db, t.id, b.id);
    const c = await createCourse(db, t.id, course("C"));
    expect(c.number).toBe(3);
    // Another teacher counts from 1 on their own.
    expect((await createCourse(db, (await makeTeacher(db)).id, course("X"))).number).toBe(1);
  });

  it("keep the teacher's order and move up and down", async () => {
    const t = await makeTeacher(db);
    for (const title of ["one", "two", "three"]) await createCourse(db, t.id, course(title));
    const titles = async () => (await listCourses(db, t.id)).map((c) => c.title);
    expect(await titles()).toEqual(["one", "two", "three"]);
    const [, two] = await listCourses(db, t.id);
    await moveCourse(db, t.id, two.id, "up");
    expect(await titles()).toEqual(["two", "one", "three"]);
    await moveCourse(db, t.id, two.id, "up"); // already first: nothing changes
    expect(await titles()).toEqual(["two", "one", "three"]);
    await moveCourse(db, t.id, two.id, "down");
    await moveCourse(db, t.id, two.id, "down");
    expect(await titles()).toEqual(["one", "three", "two"]);
  });

  it("show on the website only once published, drafts only on request", async () => {
    const t = await makeTeacher(db);
    const draft = await createCourse(db, t.id, course("Draft"));
    const live = await createCourse(db, t.id, course("Live", { published: "on" }));
    expect((await listPublishedCourses(db, t.id)).map((c) => c.id)).toEqual([live.id]);
    expect(await getCourseByNumber(db, t.id, draft.number)).toBeNull();
    expect(await getCourseByNumber(db, t.id, draft.number, true)).toMatchObject({ id: draft.id });
    expect(await getCourseByNumber(db, t.id, 999)).toBeNull();
  });
});

describe("chapters", () => {
  it("are numbered within their course, ordered, movable and removable", async () => {
    const c = await createCourse(db, owner.id, course("পদার্থবিজ্ঞান ১ম পত্র", { published: "on" }));
    const ch1 = await addChapter(db, owner.id, c.id, chapter("ভৌতজগৎ ও পরিমাপ", { status: "done" }));
    const ch2 = await addChapter(db, owner.id, c.id, chapter("ভেক্টর", { status: "ongoing" }));
    const ch3 = await addChapter(db, owner.id, c.id, chapter("গতিবিদ্যা"));
    expect([ch1?.number, ch2?.number, ch3?.number]).toEqual([1, 2, 3]);

    await moveChapter(db, owner.id, ch3!.id, "up");
    expect((await listChapters(db, owner.id, c.id)).map((x) => x.title)).toEqual(["ভৌতজগৎ ও পরিমাপ", "গতিবিদ্যা", "ভেক্টর"]);

    await deleteChapter(db, owner.id, ch1!.id);
    const ch4 = await addChapter(db, owner.id, c.id, chapter("নিউটনিয়ান বলবিদ্যা"));
    expect(ch4?.number).toBe(4);

    const published = await listPublishedCourses(db, owner.id);
    expect(published.find((p) => p.id === c.id)?.chapters.map((x) => x.title)).toEqual([
      "গতিবিদ্যা",
      "ভেক্টর",
      "নিউটনিয়ান বলবিদ্যা",
    ]);
  });

  it("go when their course is deleted", async () => {
    const c = await createCourse(db, owner.id, course("temp"));
    await addChapter(db, owner.id, c.id, chapter("x"));
    await deleteCourse(db, owner.id, c.id);
    expect(await listChapters(db, owner.id, c.id)).toEqual([]);
  });
});

describe("another teacher", () => {
  it("can't see, change, move or delete a course that isn't theirs", async () => {
    const c = await createCourse(db, owner.id, course("Mine", { published: "on" }));
    expect(await getCourse(db, stranger.id, c.id)).toBeNull();
    expect(await updateCourse(db, stranger.id, c.id, course("Hijacked"))).toBeNull();
    expect(await moveCourse(db, stranger.id, c.id, "up")).toBe(false);
    expect(await deleteCourse(db, stranger.id, c.id)).toBe(false);
    expect(await getCourseByNumber(db, stranger.id, c.number)).toBeNull();
    expect((await getCourse(db, owner.id, c.id))?.title).toBe("Mine");
  });

  it("can't add to, change, move or delete chapters of a course that isn't theirs", async () => {
    const c = await createCourse(db, owner.id, course("Mine too"));
    const ch = await addChapter(db, owner.id, c.id, chapter("Original"));
    expect(await addChapter(db, stranger.id, c.id, chapter("Injected"))).toBeNull();
    expect(await listChapters(db, stranger.id, c.id)).toEqual([]);
    expect(await updateChapter(db, stranger.id, ch!.id, chapter("Hijacked"))).toBeNull();
    expect(await moveChapter(db, stranger.id, ch!.id, "down")).toBe(false);
    expect(await deleteChapter(db, stranger.id, ch!.id)).toBe(false);
    expect((await listChapters(db, owner.id, c.id)).map((x) => x.title)).toEqual(["Original"]);
  });

  it("is refused gracefully for ids that aren't even ids", async () => {
    expect(await getCourse(db, owner.id, "../../etc")).toBeNull();
    expect(await deleteChapter(db, owner.id, "1 or 1=1")).toBe(false);
  });
});
