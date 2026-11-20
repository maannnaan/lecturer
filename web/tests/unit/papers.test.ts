import { describe, expect, it } from "vitest";
import { SETS_PER_PRINT, parsePaper, parseResult, printRuns, printSets, rankResults, setCodes, setKey, setOrder } from "@/lib/papers";

const paper = { seed: 12345, firstSet: 101, shuffleQuestions: true, shuffleOptions: true };
/** Twenty four-option questions, the right answer cycling through ক–ঘ. */
const questions = Array.from({ length: 20 }, (_, i) => ({ id: `q${i}`, optionCount: 4, answer: i % 4 }));

describe("a paper's settings", () => {
  it("reads the form, Bangla digits and all", () => {
    const { paper: p, errors } = parsePaper({
      title: " সাপ্তাহিক পরীক্ষা ",
      courseId: "c1",
      setCount: "৪",
      mark: "১",
      negative: "০.২৫",
      institution: "তানভীর স্যারের ফিজিক্স",
      shuffleQuestions: "on",
    });
    expect(errors).toEqual({});
    expect(p).toMatchObject({
      title: "সাপ্তাহিক পরীক্ষা",
      courseId: "c1",
      batchId: null,
      setCount: 4,
      markHundredths: 100,
      negativeHundredths: 25,
      shuffleQuestions: true,
      shuffleOptions: false,
    });
    expect(p.header).toMatchObject({ institution: "তানভীর স্যারের ফিজিক্স", subject: "", fullMarks: "" });
  });

  it("refuses what doesn't fit", () => {
    expect(parsePaper({ courseId: "c1", setCount: "" }).errors).toMatchObject({ title: "required", setCount: "required" });
    expect(parsePaper({ title: "x", setCount: "4" }).errors).toEqual({ courseId: "required" });
    expect(parsePaper({ title: "x", courseId: "c1", setCount: "0" }).errors).toEqual({ setCount: "number" });
    expect(parsePaper({ title: "x", courseId: "c1", setCount: "101" }).errors).toEqual({ setCount: "number" });
    expect(parsePaper({ title: "x", courseId: "c1", setCount: "4", mark: "0" }).errors).toEqual({ mark: "number" });
    expect(parsePaper({ title: "x", courseId: "c1", setCount: "4", mark: "1", negative: "2" }).errors).toEqual({ negative: "invalid" });
  });
});

describe("a paper's sets", () => {
  it("are coded from the first set on", () => {
    expect(setCodes({ firstSet: 101, setCount: 4 })).toEqual([101, 102, 103, 104]);
  });

  it("keep the teacher's order in the first set and shuffle every other one the same way each time", () => {
    const first = setOrder(questions, paper, 101);
    expect(first.questions).toEqual(questions.map((q) => q.id));
    expect(Object.values(first.options).every((o) => o.join() === "0,1,2,3")).toBe(true);

    const second = setOrder(questions, paper, 102);
    expect(setOrder(questions, paper, 102)).toEqual(second);
    expect(second.questions).not.toEqual(first.questions);
    expect(setOrder(questions, paper, 103).questions).not.toEqual(second.questions);
    // A shuffle, not a pick: every question once, and every option of each once.
    expect([...second.questions].sort()).toEqual([...first.questions].sort());
    for (const order of Object.values(second.options)) expect([...order].sort()).toEqual([0, 1, 2, 3]);
    // Another paper (another seed) shuffles its sets differently.
    expect(setOrder(questions, { ...paper, seed: 999 }, 102).questions).not.toEqual(second.questions);
  });

  it("shuffle only what the paper says", () => {
    const questionsOnly = setOrder(questions, { ...paper, shuffleOptions: false }, 102);
    expect(Object.values(questionsOnly.options).every((o) => o.join() === "0,1,2,3")).toBe(true);
    expect(questionsOnly.questions).not.toEqual(questions.map((q) => q.id));
    const neither = setOrder(questions, { ...paper, shuffleQuestions: false, shuffleOptions: false }, 102);
    expect(neither.questions).toEqual(questions.map((q) => q.id));
  });

  it("each come with a key that points at the right answer as that set prints it", () => {
    for (const code of setCodes({ firstSet: 101, setCount: 6 })) {
      const order = setOrder(questions, paper, code);
      const key = setKey(questions, order);
      expect(key).toHaveLength(questions.length);
      key.forEach((printed, place) => {
        const id = order.questions[place];
        // The option printed at that place is the question's right answer.
        expect(order.options[id][printed]).toBe(questions.find((q) => q.id === id)!.answer);
      });
    }
    // A question without an answer has none in the key.
    expect(setKey([{ id: "q0", answer: -1 }], setOrder([{ id: "q0", optionCount: 4 }], paper, 101))).toEqual([-1]);
  });
});

describe("an answer sheet typed in", () => {
  const sets = { firstSet: 101, setCount: 3 };
  it("reads the roll, set, answers and written marks, Bangla digits and all", () => {
    expect(parseResult({ roll: "০১২", setCode: "১০২", answers: "কখ-গ", written: "৮.৫" }, sets, 4)).toEqual({
      result: { roll: "12", setCode: 102, marks: "0,1,-,2", writtenHundredths: 850 },
      errors: {},
    });
    // Written marks left empty stay as they were.
    expect(parseResult({ roll: "7", setCode: "101", answers: "ক" }, sets, 4).result.writtenHundredths).toBeUndefined();
  });

  it("refuses what doesn't fit", () => {
    expect(parseResult({ roll: "", setCode: "101", answers: "" }, sets, 4).errors).toEqual({ roll: "required" });
    expect(parseResult({ roll: "1", setCode: "104", answers: "" }, sets, 4).errors).toEqual({ setCode: "invalid" });
    expect(parseResult({ roll: "1", setCode: "101", answers: "কখগঘক" }, sets, 4).errors).toEqual({ answers: "answers" });
    expect(parseResult({ roll: "1", setCode: "101", answers: "কx" }, sets, 4).errors).toEqual({ answers: "answers" });
    expect(parseResult({ roll: "1", setCode: "101", answers: "ক", written: "আট" }, sets, 4).errors).toEqual({ written: "number" });
  });
});

describe("a paper's merit list", () => {
  it("goes by the total, then the MCQs; equal on both share a place", () => {
    const ranked = rankResults([
      { roll: "3", totalHundredths: 400, scoreHundredths: 400 },
      { roll: "1", totalHundredths: 450, scoreHundredths: 300 },
      { roll: "2", totalHundredths: 400, scoreHundredths: 400 },
      { roll: "4", totalHundredths: 400, scoreHundredths: 350 },
    ]);
    expect(ranked.map((row) => [row.roll, row.rank])).toEqual([
      ["1", 1],
      ["2", 2],
      ["3", 2],
      ["4", 4],
    ]);
  });
});

describe("printing sets", () => {
  const big = { firstSet: 101, setCount: 25 };
  it("takes one set, or a run of at most a print's worth", () => {
    expect(printSets("102", big)).toEqual([102]);
    expect(printSets("১০২", big)).toEqual([102]);
    expect(printSets("101-104", big)).toEqual([101, 102, 103, 104]);
    expect(printSets("101-125", big)).toHaveLength(SETS_PER_PRINT);
    expect(printSets("120-140", big)).toEqual([120, 121, 122, 123, 124, 125]);
  });

  it("refuses sets the paper doesn't have", () => {
    expect(printSets("100", big)).toBeNull();
    expect(printSets("126", big)).toBeNull();
    expect(printSets("110-101", big)).toBeNull();
    expect(printSets("all", big)).toBeNull();
    expect(printSets(undefined, big)).toBeNull();
  });

  it("offers the sets in runs", () => {
    expect(printRuns({ firstSet: 101, setCount: 4 })).toEqual([{ from: 101, to: 104 }]);
    expect(printRuns(big)).toEqual([
      { from: 101, to: 110 },
      { from: 111, to: 120 },
      { from: 121, to: 125 },
    ]);
  });
});
