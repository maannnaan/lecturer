import { beforeAll, describe, expect, it } from "vitest";
import { parseSubject } from "@/lib/bank";
import { parseQuestion } from "@/lib/questions";
import {
  addBankTopics,
  createBankClass,
  createSubject,
  deleteBankChapter,
  deleteBankTopic,
  deleteSubject,
  getSubject,
  moveBankTopic,
  renameBankTopic,
} from "@/server/bank";
import type { Database } from "@/server/db";
import { media } from "@/server/db/schema";
import {
  bankCounts,
  createQuestion,
  deleteQuestion,
  duplicateQuestion,
  getQuestion,
  listChapterForPrint,
  listChapterQuestions,
  listQuestions,
  moveQuestion,
  updateQuestion,
} from "@/server/questions";
import type { Teacher } from "@/server/teachers";
import { freshDb, makeTeacher } from "../helpers/db";

let db: Database;
let owner: Teacher;
let stranger: Teacher;

/** A valid question of the given type for parseQuestion, with overrides. */
function input(type: string, subjectId: string, chapterId: string | null, extra: Record<string, string> = {}) {
  const base: Record<string, string> = { type, subjectId, chapterId: chapterId ?? "", stem: `${type} প্রশ্ন` };
  if (type === "mcq" || type === "mcq_multi") Object.assign(base, { option0: "ক", option1: "খ", option2: "গ", option3: "ঘ", answer: "2" });
  if (type === "mcq_multi") Object.assign(base, { statement0: "i", statement1: "ii" });
  if (type === "creative") Object.assign(base, { part0: "ক", part1: "খ", part2: "গ", part3: "ঘ" });
  const { question, errors } = parseQuestion({ ...base, ...extra });
  expect(errors).toEqual({});
  return question;
}

/** A bank subject with two chapters, in a class of its own. */
async function setup(t: Teacher) {
  const bankClass = await createBankClass(db, t.id, { name: "এইচএসসি" });
  const created = await createSubject(db, t.id, parseSubject({ name: "পদার্থবিজ্ঞান", classId: bankClass.id }).subject, ["ভেক্টর", "গতিবিদ্যা"]);
  const subject = (await getSubject(db, t.id, created!.id))!;
  return { subject, ch1: subject.chapters[0], ch2: subject.chapters[1] };
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
  it("go to the end of their chapter, keep that order, and move within their section", async () => {
    const { subject: s, ch1 } = await setup(owner);
    const a = await created(owner, input("mcq", s.id, ch1.id, { stem: "a" }));
    const cq = await created(owner, input("creative", s.id, ch1.id, { stem: "cq" }));
    const b = await created(owner, input("mcq_multi", s.id, ch1.id, { stem: "b" }));
    const third = await created(owner, input("mcq", s.id, ch1.id, { stem: "c" }));
    expect([a.position, cq.position, b.position, third.position]).toEqual([0, 1, 2, 3]);

    const place = { subjectId: s.id, chapterId: ch1.id };
    const stems = async (tab: "mcq" | "cq") => (await listChapterQuestions(db, owner.id, place, { tab })).items.map((q) => q.body.stem);
    expect(await stems("mcq")).toEqual(["a", "b", "c"]);
    // Up from the last MCQ passes the creative question by: it is in another section.
    await moveQuestion(db, owner.id, third.id, "up");
    expect(await stems("mcq")).toEqual(["a", "c", "b"]);
    await moveQuestion(db, owner.id, a.id, "up"); // already first
    expect(await stems("mcq")).toEqual(["a", "c", "b"]);
    expect(await moveQuestion(db, owner.id, cq.id, "down")).toBe(true); // alone in its section
    expect(await stems("mcq")).toEqual(["a", "c", "b"]);
    expect(await stems("cq")).toEqual(["cq"]);
  });

  it("are never reachable through another teacher", async () => {
    const { subject: s, ch1 } = await setup(owner);
    const q = await created(owner, input("mcq", s.id, ch1.id));
    expect(await getQuestion(db, stranger.id, q.id)).toBeNull();
    expect((await updateQuestion(db, stranger.id, q.id, input("mcq", s.id, ch1.id, { stem: "hacked" }))).ok).toBe(false);
    expect(await deleteQuestion(db, stranger.id, q.id)).toBe(false);
    expect(await moveQuestion(db, stranger.id, q.id, "down")).toBe(false);
    expect(await duplicateQuestion(db, stranger.id, q.id)).toBeNull();
    expect((await getQuestion(db, owner.id, q.id))?.body.stem).toBe("mcq প্রশ্ন");
    // Nor can a stranger file a question into the owner's subject.
    expect(await createQuestion(db, stranger.id, input("mcq", s.id, ch1.id))).toEqual({ ok: false, reason: "subject" });
    expect((await listQuestions(db, stranger.id)).items.some((x) => x.id === q.id)).toBe(false);
  });

  it("refuse a chapter of another subject and an image of another teacher", async () => {
    const { subject: s } = await setup(owner);
    const other = await setup(owner);
    expect(await createQuestion(db, owner.id, input("mcq", s.id, other.ch1.id))).toEqual({ ok: false, reason: "chapter" });

    const [theirs] = await db
      .insert(media)
      .values({ teacherId: stranger.id, storage: "local", key: "x.webp", url: "/media/x.webp", contentType: "image/webp", bytes: 10 })
      .returning();
    const [mine] = await db
      .insert(media)
      .values({ teacherId: owner.id, storage: "local", key: "y.webp", url: "/media/y.webp", contentType: "image/webp", bytes: 10 })
      .returning();
    expect(await createQuestion(db, owner.id, input("mcq", s.id, null, { imageId: theirs.id }))).toEqual({ ok: false, reason: "image" });
    const withImage = await created(owner, input("mcq", s.id, null, { imageId: mine.id }));
    expect(withImage.body.image).toEqual({ mediaId: mine.id, url: "/media/y.webp" });
  });

  it("keep rich text as the editor wrote it, its pictures only the teacher's own uploads", async () => {
    const { subject: s, ch1 } = await setup(owner);
    const upload = async (teacherId: string, key: string) =>
      (
        await db
          .insert(media)
          .values({ teacherId, storage: "local", key, url: `/media/${key}`, contentType: "image/webp", bytes: 10 })
          .returning()
      )[0];
    const mine = await upload(owner.id, "rich-mine.webp");
    const theirs = await upload(stranger.id, "rich-theirs.webp");
    const water = { type: "paragraph", content: [{ type: "text", text: "H" }, { type: "text", text: "2", marks: [{ type: "subscript" }] }, { type: "text", text: "O" }] };
    const stem = (mediaId: string) => JSON.stringify({ type: "doc", content: [water, { type: "image", attrs: { src: "https://elsewhere.example/a.png", mediaId } }] });
    const square = { type: "doc", content: [{ type: "paragraph", content: [{ type: "inlineMath", attrs: { latex: "x^2" } }] }] };

    const q = await created(owner, input("mcq", s.id, ch1.id, { stem: stem(mine.id), option0: JSON.stringify(square) }));
    // The picture points at the teacher's stored file, whatever the form said.
    expect(q.body.stem).toEqual({ type: "doc", content: [water, { type: "image", attrs: { src: "/media/rich-mine.webp", mediaId: mine.id } }] });
    expect(q.body.options?.[0]).toEqual(square);
    // Another teacher's picture is refused, when written and when edited in.
    expect(await createQuestion(db, owner.id, input("mcq", s.id, ch1.id, { stem: stem(theirs.id) }))).toEqual({ ok: false, reason: "image" });
    expect(await updateQuestion(db, owner.id, q.id, input("mcq", s.id, ch1.id, { stem: stem(theirs.id) }))).toEqual({ ok: false, reason: "image" });
    // Plain text from before the editor stays plain text.
    expect((await created(owner, input("short", s.id, ch1.id, { stem: "আগের লেখা $x$" }))).body.stem).toBe("আগের লেখা $x$");
  });

  it("keep their image on edit, and move to the end of a new chapter", async () => {
    const { subject: s, ch1, ch2 } = await setup(owner);
    const [img] = await db
      .insert(media)
      .values({ teacherId: owner.id, storage: "local", key: "z.webp", url: "/media/z.webp", contentType: "image/webp", bytes: 10 })
      .returning();
    await created(owner, input("short", s.id, ch2.id));
    const q = await created(owner, input("mcq", s.id, ch1.id, { imageId: img.id }));
    const moved = await updateQuestion(db, owner.id, q.id, input("mcq", s.id, ch2.id, { imageId: img.id, stem: "নতুন" }));
    expect(moved.ok && moved.question.chapterId).toBe(ch2.id);
    expect(moved.ok && moved.question.position).toBe(1);
    expect(moved.ok && moved.question.body.image?.url).toBe("/media/z.webp");
    const cleared = await updateQuestion(db, owner.id, q.id, input("mcq", s.id, ch2.id));
    expect(cleared.ok && cleared.question.body.image).toBeNull();
  });

  it("filter by subject, type, board, visibility and text", async () => {
    const t = await makeTeacher(db);
    const { subject: s, ch1 } = await setup(t);
    const other = await setup(t);
    await created(t, input("mcq", s.id, ch1.id, { stem: "ঘর্ষণ বল 50% কমে", board: "dhaka", year: "2023" }));
    await created(t, input("mcq_multi", s.id, ch1.id, { stem: "ভরবেগ", board: "rajshahi" }));
    await created(t, input("creative", s.id, ch1.id, { stem: "আনত তল", visibility: "private" }));
    await created(t, input("practice", other.subject.id, null));
    const count = async (filters: Parameters<typeof listQuestions>[2]) => (await listQuestions(db, t.id, filters)).total;
    expect(await count({})).toBe(4);
    expect(await count({ subjectId: s.id })).toBe(3);
    expect(await count({ subjectId: other.subject.id, chapterId: "none" })).toBe(1);
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

  it("list a chapter one section at a time: public only on the website, with counts and board filters", async () => {
    const t = await makeTeacher(db);
    const { subject: s, ch1, ch2 } = await setup(t);
    await created(t, input("mcq", s.id, ch1.id, { board: "dhaka", year: "2023" }));
    await created(t, input("mcq_multi", s.id, ch1.id, { board: "sylhet", year: "2024" }));
    await created(t, input("creative", s.id, ch1.id, { board: "rajshahi", year: "2022" }));
    await created(t, input("short", s.id, ch1.id, { visibility: "private" }));
    await created(t, input("textbook", s.id, ch1.id, { solution: "$F = ma$" }));
    await created(t, input("practice", s.id, ch1.id, { finalAnswer: "৫ N" }));
    await created(t, input("practice", s.id, ch2.id));
    const place = { subjectId: s.id, chapterId: ch1.id };

    const mcq = await listChapterQuestions(db, t.id, place, { tab: "mcq" });
    expect(mcq.counts).toEqual({ textbook: 1, practice: 1, mcq: 2, sq: 0, cq: 1, board: 3 });
    expect(mcq.items.map((q) => q.type)).toEqual(["mcq", "mcq_multi"]);
    // The filter menus offer every board and year the chapter's board questions come from.
    expect(mcq.boards).toEqual(["dhaka", "rajshahi", "sylhet"]);
    expect(mcq.years).toEqual([2024, 2023, 2022]);
    const mcqWith = async (filters: Parameters<typeof listChapterQuestions>[3]["filters"]) =>
      listChapterQuestions(db, t.id, place, { tab: "mcq", filters });
    expect((await mcqWith({ year: 2024 })).items.map((q) => q.board)).toEqual(["sylhet"]);
    expect((await mcqWith({ board: "dhaka" })).total).toBe(1);
    expect((await listChapterQuestions(db, t.id, place, { tab: "cq", filters: { board: "any" } })).total).toBe(1);
    expect((await listChapterQuestions(db, t.id, place, { tab: "textbook", filters: { board: "any" } })).total).toBe(0);
    // The tabs' counts follow the filters.
    expect((await mcqWith({ board: "dhaka" })).counts).toEqual({ textbook: 0, practice: 0, mcq: 1, sq: 0, cq: 0, board: 1 });

    // The board tab lists the board questions of every type, sections in order.
    const board = await listChapterQuestions(db, t.id, place, { tab: "board" });
    expect(board.items.map((q) => q.type)).toEqual(["mcq", "mcq_multi", "creative"]);

    // Textbook and practice problems keep to their own sections.
    expect((await listChapterQuestions(db, t.id, place, { tab: "textbook" })).items.map((q) => q.body.solution)).toEqual(["$F = ma$"]);
    expect((await listChapterQuestions(db, t.id, place, { tab: "practice" })).items.map((q) => q.body.finalAnswer)).toEqual(["৫ N"]);

    // The private short question is the teacher's alone.
    expect((await listChapterQuestions(db, t.id, place, { tab: "sq" })).items).toEqual([]);
    const own = await listChapterQuestions(db, t.id, place, { tab: "sq", includePrivate: true });
    expect(own.items.map((q) => q.visibility)).toEqual(["private"]);
    expect(own.counts.sq).toBe(1);
    expect((await listChapterQuestions(db, stranger.id, place, { tab: "mcq", includePrivate: true })).total).toBe(0);
  });

  it("are counted by subject, chapter and type, and listed when filed under no chapter", async () => {
    const t = await makeTeacher(db);
    const { subject: s, ch1, ch2 } = await setup(t);
    await created(t, input("mcq", s.id, ch1.id));
    await created(t, input("mcq_multi", s.id, ch1.id, { visibility: "private" }));
    await created(t, input("practice", s.id, ch2.id));
    await created(t, input("short", s.id, null));
    const sum = (rows: { n: number }[]) => rows.reduce((n, row) => n + row.n, 0);

    expect(sum(await bankCounts(db, t.id))).toBe(4);
    const shown = await bankCounts(db, t.id, { publicOnly: true });
    expect(sum(shown)).toBe(3);
    expect(shown.find((row) => row.chapterId === null)).toEqual({ subjectId: s.id, chapterId: null, type: "short", board: false, n: 1 });
    expect(await bankCounts(db, stranger.id)).toEqual([]);

    const unfiled = await listChapterQuestions(db, t.id, { subjectId: s.id, chapterId: null }, { tab: "sq" });
    expect(unfiled.items.map((q) => q.type)).toEqual(["short"]);
    expect(unfiled.counts).toEqual({ textbook: 0, practice: 0, mcq: 0, sq: 1, cq: 0, board: 0 });
    // Ids that aren't ids find nothing rather than failing.
    expect((await listChapterQuestions(db, t.id, { subjectId: "x", chapterId: null }, { tab: "sq" })).total).toBe(0);
  });

  it("stay in the subject when their chapter is deleted, and go with the subject", async () => {
    const t = await makeTeacher(db);
    const { subject: s, ch1 } = await setup(t);
    const q = await created(t, input("mcq", s.id, ch1.id));
    await deleteBankChapter(db, t.id, ch1.id);
    expect((await getQuestion(db, t.id, q.id))?.chapterId).toBeNull();
    expect((await listQuestions(db, t.id, { subjectId: s.id, chapterId: "none" })).total).toBe(1);
    await deleteSubject(db, t.id, s.id);
    expect(await getQuestion(db, t.id, q.id)).toBeNull();
  });

  it("duplicate to the end of the same chapter", async () => {
    const t = await makeTeacher(db);
    const { subject: s, ch1 } = await setup(t);
    const q = await created(t, input("creative", s.id, ch1.id, { stem: "মূল", difficulty: "hard" }));
    const copy = await duplicateQuestion(db, t.id, q.id);
    expect(copy?.id).not.toBe(q.id);
    expect(copy?.body).toEqual(q.body);
    expect(copy?.difficulty).toBe("hard");
    expect(copy?.position).toBe(1);
  });

  it("filter a chapter by source and difficulty, open on a question's page, and print whole", async () => {
    const t = await makeTeacher(db);
    const { subject: s, ch1 } = await setup(t);
    await created(t, input("mcq", s.id, ch1.id, { stem: "বোর্ড", board: "dhaka", year: "2024", difficulty: "easy" }));
    await created(t, input("mcq", s.id, ch1.id, { stem: "টেস্ট", source: "নটর ডেম কলেজ", difficulty: "hard" }));
    await created(t, input("mcq", s.id, ch1.id, { stem: "নিজস্ব" }));
    await created(t, input("creative", s.id, ch1.id, { stem: "সৃজনশীল", difficulty: "hard" }));
    const place = { subjectId: s.id, chapterId: ch1.id };
    const stems = async (filters: Parameters<typeof listChapterQuestions>[3]["filters"]) =>
      (await listChapterQuestions(db, t.id, place, { tab: "mcq", filters })).items.map((q) => q.body.stem);

    expect(await stems({})).toEqual(["বোর্ড", "টেস্ট", "নিজস্ব"]);
    expect(await stems({ sources: ["board"] })).toEqual(["বোর্ড"]);
    expect(await stems({ sources: ["school", "own"] })).toEqual(["টেস্ট", "নিজস্ব"]);
    expect(await stems({ sources: [] })).toEqual([]);
    expect(await stems({ difficulty: "hard" })).toEqual(["টেস্ট"]);
    expect((await listChapterQuestions(db, t.id, place, { tab: "mcq", filters: { difficulty: "hard" } })).counts.cq).toBe(1);

    // Ten more MCQs, two to a page: the last one is on page 7, and `focus` opens that page.
    for (let i = 0; i < 10; i++) await created(t, input("mcq", s.id, ch1.id, { stem: `আরও ${i}` }));
    const last = (await listQuestions(db, t.id, { subjectId: s.id, chapterId: ch1.id, type: "mcq", search: "আরও 9" })).items[0];
    const focused = await listChapterQuestions(db, t.id, place, { tab: "mcq", pageSize: 2, focus: last.id });
    expect(focused.page).toBe(7);
    expect(focused.items.map((q) => q.id)).toContain(last.id);
    // A page past the end shows the last one; a focus that isn't in the list changes nothing.
    expect((await listChapterQuestions(db, t.id, place, { tab: "mcq", pageSize: 2, page: 99 })).page).toBe(7);
    expect((await listChapterQuestions(db, t.id, place, { tab: "mcq", pageSize: 2, page: 2, focus: "nope" })).page).toBe(2);

    // The printout holds every section, in order, with the filters applied.
    const all = await listChapterForPrint(db, t.id, place, {});
    expect(all).toHaveLength(14);
    expect(all.at(-1)?.type).toBe("creative");
    expect((await listChapterForPrint(db, t.id, place, { boardOnly: true })).map((q) => q.body.stem)).toEqual(["বোর্ড"]);
    expect((await listChapterForPrint(db, t.id, place, { filters: { difficulty: "hard" } })).map((q) => q.body.stem)).toEqual(["টেস্ট", "সৃজনশীল"]);
    expect(await listChapterForPrint(db, stranger.id, place, {})).toEqual([]);
  });
});

describe("sub-chapters", () => {
  it("are numbered on, never reused, come with their chapter in order, and move and rename", async () => {
    const t = await makeTeacher(db);
    const { subject: s, ch1 } = await setup(t);
    const first = (await addBankTopics(db, t.id, ch1.id, ["বল", "ভরবেগ"]))!;
    expect(first.map((x) => [x.number, x.position, x.title])).toEqual([
      [1, 0, "বল"],
      [2, 1, "ভরবেগ"],
    ]);
    await deleteBankTopic(db, t.id, first[1].id);
    const more = (await addBankTopics(db, t.id, ch1.id, ["ঘর্ষণ"]))!;
    // Number 2 was handed out once already: links that used it don't land on another sub-chapter.
    expect(more[0].number).toBe(3);

    await moveBankTopic(db, t.id, more[0].id, "up");
    await renameBankTopic(db, t.id, first[0].id, "বল ও গতি");
    const subject = (await getSubject(db, t.id, s.id))!;
    expect(subject.chapters[0].topics.map((x) => x.title)).toEqual(["ঘর্ষণ", "বল ও গতি"]);
    expect(subject.chapters[1].topics).toEqual([]);
  });

  it("belong to the teacher and their own chapter", async () => {
    const t = await makeTeacher(db);
    const { subject: s, ch1, ch2 } = await setup(t);
    const [topic] = (await addBankTopics(db, t.id, ch1.id, ["বল"]))!;
    expect(await addBankTopics(db, stranger.id, ch1.id, ["অন্যের"])).toBeNull();
    expect(await renameBankTopic(db, stranger.id, topic.id, "x")).toBeNull();
    expect(await deleteBankTopic(db, stranger.id, topic.id)).toBe(false);

    // A question can't be filed under a sub-chapter of another chapter.
    const elsewhere = await createQuestion(db, t.id, input("mcq", s.id, ch2.id, { topicId: topic.id }));
    expect(elsewhere).toEqual({ ok: false, reason: "topic" });
    // Without a chapter, a sub-chapter is ignored.
    expect(input("mcq", s.id, null, { topicId: topic.id }).topicId).toBeNull();
    const q = await created(t, input("mcq", s.id, ch1.id, { topicId: topic.id }));
    expect(q.topicId).toBe(topic.id);
    // Moved to another chapter, the edit must drop it.
    expect(await updateQuestion(db, t.id, q.id, input("mcq", s.id, ch2.id, { topicId: topic.id }))).toEqual({ ok: false, reason: "topic" });
    expect((await duplicateQuestion(db, t.id, q.id))?.topicId).toBe(topic.id);
  });

  it("filter a chapter's tabs, and leave their questions in the chapter when deleted", async () => {
    const t = await makeTeacher(db);
    const { subject: s, ch1 } = await setup(t);
    const [force, momentum] = (await addBankTopics(db, t.id, ch1.id, ["বল", "ভরবেগ"]))!;
    await created(t, input("mcq", s.id, ch1.id, { stem: "বলের প্রশ্ন", topicId: force.id }));
    await created(t, input("mcq", s.id, ch1.id, { stem: "ভরবেগের প্রশ্ন", topicId: momentum.id }));
    await created(t, input("creative", s.id, ch1.id, { stem: "বলের সৃজনশীল", topicId: force.id }));
    await created(t, input("mcq", s.id, ch1.id, { stem: "কোনোটিতে নয়" }));
    const place = { subjectId: s.id, chapterId: ch1.id };
    const mcqs = async (topic?: number) => (await listChapterQuestions(db, t.id, place, { tab: "mcq", filters: { topic } })).items.map((q) => q.body.stem);

    expect(await mcqs()).toEqual(["বলের প্রশ্ন", "ভরবেগের প্রশ্ন", "কোনোটিতে নয়"]);
    expect(await mcqs(force.number)).toEqual(["বলের প্রশ্ন"]);
    const byForce = await listChapterQuestions(db, t.id, place, { tab: "mcq", filters: { topic: force.number } });
    expect([byForce.counts.mcq, byForce.counts.cq]).toEqual([1, 1]);
    // A number this chapter doesn't have shows nothing, rather than everything.
    expect(await mcqs(99)).toEqual([]);
    expect((await listChapterForPrint(db, t.id, place, { filters: { topic: momentum.number } })).map((q) => q.body.stem)).toEqual(["ভরবেগের প্রশ্ন"]);

    await deleteBankTopic(db, t.id, force.id);
    expect(await mcqs()).toEqual(["বলের প্রশ্ন", "ভরবেগের প্রশ্ন", "কোনোটিতে নয়"]);
    expect((await listQuestions(db, t.id, { search: "বলের প্রশ্ন" })).items[0].topicId).toBeNull();
  });
});
