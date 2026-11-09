import { describe, expect, it } from "vitest";
import { bn } from "@/i18n/bn";
import { en } from "@/i18n/en";
import { type CountRow, buildBankTree, emptyCounts, totalOf, withQuestions } from "@/lib/bank-tree";
import { GRADES, gradeLine, gradeName, gradeOf, isGrade, subjectOf } from "@/lib/grades";
import { BANK_TABS, QUESTION_TYPES, tabFromParam, tabOf, tabTypes } from "@/lib/questions";

describe("bank sections", () => {
  it("list every question type, each in exactly one section", () => {
    const listed = BANK_TABS.flatMap((tab) => tabTypes(tab));
    expect([...listed].sort()).toEqual([...QUESTION_TYPES].sort());
    for (const type of QUESTION_TYPES) expect(tabTypes(tabOf(type))).toContain(type);
  });

  it("put both kinds of MCQ together, and keep textbook and practice problems apart", () => {
    expect(tabOf("mcq")).toBe("mcq");
    expect(tabOf("mcq_multi")).toBe("mcq");
    expect(tabOf("short")).toBe("sq");
    expect(tabOf("creative")).toBe("cq");
    expect(tabOf("textbook")).toBe("textbook");
    expect(tabOf("practice")).toBe("practice");
  });

  it("read a chapter page's ?tab=, the names used before included", () => {
    expect(tabFromParam("cq")).toEqual({ tab: "cq", anyBoard: false });
    expect(tabFromParam("practice")).toEqual({ tab: "practice", anyBoard: false });
    expect(tabFromParam("problem")).toEqual({ tab: "textbook", anyBoard: false });
    expect(tabFromParam("short")).toEqual({ tab: "sq", anyBoard: false });
    expect(tabFromParam("creative")).toEqual({ tab: "cq", anyBoard: false });
    // Board questions were a tab; now they are a filter on the MCQ section.
    expect(tabFromParam("board")).toEqual({ tab: "mcq", anyBoard: true });
    for (const raw of [undefined, "", "MCQ", "constructor", "__proto__"]) expect(tabFromParam(raw)).toBeNull();
  });
});

describe("classes", () => {
  it("are known keys, with anything else read as other", () => {
    expect(GRADES).toContain("hsc");
    expect(isGrade("hsc")).toBe(true);
    expect(isGrade("HSC")).toBe(false);
    expect(isGrade(null)).toBe(false);
    expect(gradeOf({ grade: "class-8" })).toBe("class-8");
    expect(gradeOf({ grade: "nonsense" })).toBe("other");
  });

  it("have names in both languages", () => {
    expect(gradeLine("hsc", bn)).toBe("এইচএসসি (একাদশ-দ্বাদশ শ্রেণি)");
    expect(gradeLine("class-8", en)).toBe("Class 8 (Lower secondary)");
    expect(gradeName("nonsense", bn).label).toBe("অন্যান্য");
  });

  it("call a course by its subject, or its title when it has none", () => {
    expect(subjectOf({ subject: "", title: "পদার্থবিজ্ঞান" })).toBe("পদার্থবিজ্ঞান");
    expect(subjectOf({ subject: "রসায়ন ১ম পত্র", title: "রসায়ন (সকালের ব্যাচ)" })).toBe("রসায়ন ১ম পত্র");
  });
});

describe("buildBankTree", () => {
  const course = (id: string, grade: string, chapters: string[]) => ({ id, grade, chapters: chapters.map((c) => ({ id: c })) });
  const rows: CountRow[] = [
    { courseId: "p1", chapterId: "c1", type: "mcq", n: 3 },
    { courseId: "p1", chapterId: "c1", type: "mcq_multi", n: 2 },
    { courseId: "p1", chapterId: "c2", type: "textbook", n: 1 },
    { courseId: "p1", chapterId: null, type: "short", n: 4 },
    { courseId: "s1", chapterId: "d1", type: "creative", n: 5 },
    // A course that isn't in the list (another teacher's, or unpublished): ignored.
    { courseId: "gone", chapterId: null, type: "mcq", n: 9 },
  ];

  it("groups courses by class in the bank's order, with section counts at every level", () => {
    const tree = buildBankTree([course("s1", "ssc", ["d1"]), course("p1", "hsc", ["c1", "c2", "c3"]), course("e1", "nonsense", [])], rows);
    expect(tree.map((g) => g.grade)).toEqual(["ssc", "hsc", "other"]);

    const [p1] = tree[1].courses;
    expect(p1.chapters.map((c) => [c.chapter.id, c.counts.mcq, c.total])).toEqual([
      ["c1", 5, 5],
      ["c2", 0, 1],
      ["c3", 0, 0],
    ]);
    expect(p1.unfiled).toEqual({ counts: { ...emptyCounts(), sq: 4 }, total: 4 });
    expect(p1.total).toBe(10);
    expect(tree[1].counts).toEqual({ textbook: 1, practice: 0, mcq: 5, sq: 4, cq: 0 });
    expect(totalOf(tree[1].counts)).toBe(tree[1].total);
    expect(tree[0].total).toBe(5);
    expect(tree[2].courses.map((c) => c.course.id)).toEqual(["e1"]);
    expect(tree[2].total).toBe(0);
  });

  it("keeps the teacher's course order within a class", () => {
    const tree = buildBankTree([course("b", "hsc", []), course("x", "ssc", []), course("a", "hsc", [])], []);
    expect(tree.map((g) => [g.grade, g.courses.map((c) => c.course.id)])).toEqual([
      ["ssc", ["x"]],
      ["hsc", ["b", "a"]],
    ]);
  });

  it("leaves out, for the website, courses and classes with no questions", () => {
    const tree = withQuestions(buildBankTree([course("p1", "hsc", ["c1"]), course("p2", "hsc", []), course("e1", "admission", [])], rows));
    expect(tree.map((g) => g.grade)).toEqual(["hsc"]);
    expect(tree[0].courses.map((c) => c.course.id)).toEqual(["p1"]);
  });
});
