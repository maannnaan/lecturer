import { describe, expect, it } from "vitest";
import { bn } from "@/i18n/bn";
import { en } from "@/i18n/en";
import { type FieldErrors } from "@/lib/form-input";
import { MAX_CHAPTERS_AT_ONCE, chapterLines, parseBankChapter, parseSubject } from "@/lib/bank";
import { subjectAbbr, subjectTone } from "@/lib/bank-look";
import { type CountRow, buildBankTree, emptyCounts, totalOf, withQuestions } from "@/lib/bank-tree";
import { GRADES, gradeLine, gradeName, gradeOf, isGrade } from "@/lib/grades";
import {
  BANK_TABS,
  QUESTION_TYPES,
  SECTION_TABS,
  activeFilters,
  filterParams,
  filtersFromParams,
  sourceOf,
  tabFromParam,
  tabOf,
  tabTypes,
} from "@/lib/questions";

describe("bank sections", () => {
  it("list every question type, each in exactly one section", () => {
    const listed = SECTION_TABS.flatMap((tab) => tabTypes(tab));
    expect([...listed].sort()).toEqual([...QUESTION_TYPES].sort());
    for (const type of QUESTION_TYPES) expect(tabTypes(tabOf(type))).toContain(type);
  });

  it("end with the board tab, which lists every type", () => {
    expect(BANK_TABS).toEqual([...SECTION_TABS, "board"]);
    expect([...tabTypes("board")].sort()).toEqual([...QUESTION_TYPES].sort());
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
    expect(tabFromParam("cq")).toBe("cq");
    expect(tabFromParam("practice")).toBe("practice");
    expect(tabFromParam("board")).toBe("board");
    expect(tabFromParam("problem")).toBe("textbook");
    expect(tabFromParam("short")).toBe("sq");
    expect(tabFromParam("creative")).toBe("cq");
    for (const raw of [undefined, "", "MCQ", "constructor", "__proto__"]) expect(tabFromParam(raw)).toBeNull();
  });
});

describe("chapter filters", () => {
  it("read the address, ignoring anything unknown", () => {
    expect(filtersFromParams({})).toEqual({});
    expect(filtersFromParams({ board: "dhaka", year: "২০২৪", diff: "hard", src: "board,own" })).toEqual({
      board: "dhaka",
      year: 2024,
      difficulty: "hard",
      sources: ["board", "own"],
    });
    expect(filtersFromParams({ board: "any" }).board).toBe("any");
    expect(filtersFromParams({ board: "nowhere", year: "24", diff: "brutal" })).toEqual({});
    // Every source ticked is the same as none chosen; none ticked shows nothing.
    expect(filtersFromParams({ src: "own,board,school" }).sources).toBeUndefined();
    expect(filtersFromParams({ src: "" }).sources).toEqual([]);
  });

  it("write the address back in a fixed order, leaving out what shows everything", () => {
    const filters = { sources: ["board" as const, "school" as const], difficulty: "easy" as const, year: 2023, board: "sylhet" };
    expect(filterParams(filters)).toEqual({ board: "sylhet", year: "2023", diff: "easy", src: "board,school" });
    expect(filtersFromParams(filterParams(filters))).toEqual(filters);
    expect(activeFilters(filters)).toBe(4);
    expect(filterParams({ sources: ["board", "school", "own"] })).toEqual({});
    expect(activeFilters({})).toBe(0);
  });

  it("tell a board question, one from another source and the teacher's own apart", () => {
    expect(sourceOf({ board: "dhaka", source: "টেস্ট" })).toBe("board");
    expect(sourceOf({ board: "", source: "নটর ডেম কলেজ" })).toBe("school");
    expect(sourceOf({ board: "", source: "" })).toBe("own");
  });
});

describe("the bank's look", () => {
  it("abbreviates a subject's name, with its paper", () => {
    expect(subjectAbbr("Physics")).toBe("Ph");
    expect(subjectAbbr("ICT")).toBe("ICT");
    expect(subjectAbbr("Physics 2nd Paper")).toBe("Ph2");
    expect(subjectAbbr("পদার্থবিজ্ঞান ১ম পত্র")).toBe("প১");
    // ২য় written with য + nukta, and with the single character য়.
    expect(subjectAbbr("রসায়ন ২য় পত্র")).toBe("র২");
    expect(subjectAbbr("রসায়ন ২য় পত্র")).toBe("র২");
    // A first letter with a vowel sign stays whole.
    expect(subjectAbbr("জীববিজ্ঞান")).toBe("জী");
    expect(subjectAbbr("  ")).toBe("?");
  });

  it("colours a class's subjects in turn", () => {
    expect([0, 1, 2, 3, 4].map(subjectTone)).toEqual(["blue", "green", "orange", "purple", "blue"]);
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

  it("need a name, and fall back to other for an unknown class and to no group", () => {
    expect(parseSubject({ name: " পদার্থবিজ্ঞান ১ম পত্র ", grade: "hsc", group: "science", chapters: "ভেক্টর\nগতিবিদ্যা" })).toEqual({
      subject: { grade: "hsc", group: "science", name: "পদার্থবিজ্ঞান ১ম পত্র" },
      chapters: ["ভেক্টর", "গতিবিদ্যা"],
      errors: {},
    });
    const { subject, errors } = parseSubject({ name: "", grade: "HSC", group: "arts" });
    expect(subject.grade).toBe("other");
    expect(subject.group).toBe("");
    expect(errors.name).toBe("required");
    expect(parseBankChapter({ title: "", label: "ক".repeat(31) }).errors).toEqual({ title: "required", label: "tooLong" });
  });
});

describe("buildBankTree", () => {
  const subject = (id: string, grade: string, chapters: string[]) => ({ id, grade, chapters: chapters.map((c) => ({ id: c })) });
  const rows: CountRow[] = [
    { subjectId: "p1", chapterId: "c1", type: "mcq", board: false, n: 1 },
    { subjectId: "p1", chapterId: "c1", type: "mcq", board: true, n: 2 },
    { subjectId: "p1", chapterId: "c1", type: "mcq_multi", board: false, n: 2 },
    { subjectId: "p1", chapterId: "c2", type: "textbook", board: false, n: 1 },
    { subjectId: "p1", chapterId: null, type: "short", board: true, n: 4 },
    { subjectId: "s1", chapterId: "d1", type: "creative", board: false, n: 5 },
    // A subject that isn't in the list (another teacher's): ignored.
    { subjectId: "gone", chapterId: null, type: "mcq", board: false, n: 9 },
  ];

  it("groups subjects by class in the bank's order, with each tab's count at every level", () => {
    const tree = buildBankTree([subject("s1", "ssc", ["d1"]), subject("p1", "hsc", ["c1", "c2", "c3"]), subject("e1", "nonsense", [])], rows);
    expect(tree.map((g) => g.grade)).toEqual(["ssc", "hsc", "other"]);

    const [p1] = tree[1].subjects;
    expect(p1.chapters.map((c) => [c.chapter.id, c.counts.mcq, c.counts.board, c.total])).toEqual([
      ["c1", 5, 2, 5],
      ["c2", 0, 0, 1],
      ["c3", 0, 0, 0],
    ]);
    expect(p1.unfiled).toEqual({ counts: { ...emptyCounts(), sq: 4, board: 4 }, total: 4 });
    expect(p1.total).toBe(10);
    // Board questions are counted in their own section too, so they don't add to the total.
    expect(tree[1].counts).toEqual({ textbook: 1, practice: 0, mcq: 5, sq: 4, cq: 0, board: 6 });
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
