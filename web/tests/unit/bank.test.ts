import { describe, expect, it } from "vitest";
import { bn } from "@/i18n/bn";
import { en } from "@/i18n/en";
import { type FieldErrors } from "@/lib/form-input";
import { MAX_CHAPTERS_AT_ONCE, chapterLines, parseBankChapter, parseSubject } from "@/lib/bank";
import { type CountRow, buildBankTree, emptyCounts, totalOf, withQuestions } from "@/lib/bank-tree";
import { GRADES, gradeLine, gradeName, gradeOf, isGrade } from "@/lib/grades";
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
});

describe("subjects and chapters", () => {
  it("take a pasted chapter list, dropping numbering, bullets and blank lines", () => {
    const errors: FieldErrors = {};
    const pasted = [
      "অধ্যায় ১: ভৌতজগৎ ও পরিমাপ",
      "২. ভেক্টর",
      "",
      "  3) Dynamics  ",
      "• নিউটনিয়ান বলবিদ্যা",
      "Chapter 5 – Work, energy and power",
      "৬। মহাকর্ষ ও অভিকর্ষ",
      "3D জ্যামিতি",
    ].join("\r\n");
    expect(chapterLines(pasted, errors)).toEqual([
      "ভৌতজগৎ ও পরিমাপ",
      "ভেক্টর",
      "Dynamics",
      "নিউটনিয়ান বলবিদ্যা",
      "Work, energy and power",
      "মহাকর্ষ ও অভিকর্ষ",
      // A number that isn't numbering stays.
      "3D জ্যামিতি",
    ]);
    expect(errors).toEqual({});
  });

  it("refuse too many chapters at once, or one too long", () => {
    const many: FieldErrors = {};
    expect(chapterLines(Array.from({ length: MAX_CHAPTERS_AT_ONCE + 1 }, (_, i) => `Topic ${i}`).join("\n"), many)).toHaveLength(
      MAX_CHAPTERS_AT_ONCE,
    );
    // A line that is nothing but numbering has no title, so it is dropped.
    expect(chapterLines("অধ্যায় ৫\n৬.", {})).toEqual([]);
    expect(many.chapters).toBe("tooLong");
    const long: FieldErrors = {};
    chapterLines("ক".repeat(161), long);
    expect(long.chapters).toBe("tooLong");
  });

  it("need a name, and fall back to other for an unknown class", () => {
    expect(parseSubject({ name: " পদার্থবিজ্ঞান ১ম পত্র ", grade: "hsc", chapters: "ভেক্টর\nগতিবিদ্যা" })).toEqual({
      subject: { grade: "hsc", name: "পদার্থবিজ্ঞান ১ম পত্র" },
      chapters: ["ভেক্টর", "গতিবিদ্যা"],
      errors: {},
    });
    const { subject, errors } = parseSubject({ name: "", grade: "HSC" });
    expect(subject.grade).toBe("other");
    expect(errors.name).toBe("required");
    expect(parseBankChapter({ title: "", label: "ক".repeat(31) }).errors).toEqual({ title: "required", label: "tooLong" });
  });
});

describe("buildBankTree", () => {
  const subject = (id: string, grade: string, chapters: string[]) => ({ id, grade, chapters: chapters.map((c) => ({ id: c })) });
  const rows: CountRow[] = [
    { subjectId: "p1", chapterId: "c1", type: "mcq", n: 3 },
    { subjectId: "p1", chapterId: "c1", type: "mcq_multi", n: 2 },
    { subjectId: "p1", chapterId: "c2", type: "textbook", n: 1 },
    { subjectId: "p1", chapterId: null, type: "short", n: 4 },
    { subjectId: "s1", chapterId: "d1", type: "creative", n: 5 },
    // A subject that isn't in the list (another teacher's): ignored.
    { subjectId: "gone", chapterId: null, type: "mcq", n: 9 },
  ];

  it("groups subjects by class in the bank's order, with section counts at every level", () => {
    const tree = buildBankTree([subject("s1", "ssc", ["d1"]), subject("p1", "hsc", ["c1", "c2", "c3"]), subject("e1", "nonsense", [])], rows);
    expect(tree.map((g) => g.grade)).toEqual(["ssc", "hsc", "other"]);

    const [p1] = tree[1].subjects;
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
    expect(tree[2].subjects.map((s) => s.subject.id)).toEqual(["e1"]);
    expect(tree[2].total).toBe(0);
  });

  it("keeps the teacher's subject order within a class", () => {
    const tree = buildBankTree([subject("b", "hsc", []), subject("x", "ssc", []), subject("a", "hsc", [])], []);
    expect(tree.map((g) => [g.grade, g.subjects.map((s) => s.subject.id)])).toEqual([
      ["ssc", ["x"]],
      ["hsc", ["b", "a"]],
    ]);
  });

  it("leaves out, for the website, subjects and classes with no questions", () => {
    const tree = withQuestions(buildBankTree([subject("p1", "hsc", ["c1"]), subject("p2", "hsc", []), subject("e1", "admission", [])], rows));
    expect(tree.map((g) => g.grade)).toEqual(["hsc"]);
    expect(tree[0].subjects.map((s) => s.subject.id)).toEqual(["p1"]);
  });
});
