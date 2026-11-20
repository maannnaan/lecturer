import { describe, expect, it } from "vitest";
import { BLANK, DOUBLE, answersText, decodeMarks, encodeMarks, gradeSheet, parseAnswers } from "@/lib/omr";
import { setCodes, setKey, setOrder } from "@/lib/papers";

const marking = { markHundredths: 100, negativeHundredths: 25 };

describe("the OMR app's mark strings", () => {
  it("read every kind of token the app writes", () => {
    // An option, a blank, two marks, an erased light mark, a teacher's fix, both, and a token nobody wrote.
    expect(decodeMarks("2,0,-,d1.3,2e0,1f,3e1f,x")).toEqual([2, 0, BLANK, DOUBLE, 2, 1, 3, BLANK]);
    expect(decodeMarks("")).toEqual([]);
  });

  it("write what a sheet says so the app reads it back the same", () => {
    const values = [0, BLANK, DOUBLE, 3];
    expect(encodeMarks(values)).toBe("0,-,d,3");
    expect(decodeMarks(encodeMarks(values))).toEqual(values);
  });
});

describe("marking a sheet", () => {
  it("gives a mark for each right answer and takes one off for each wrong one, two marks counting as wrong", () => {
    expect(gradeSheet([1, 0, BLANK, DOUBLE], [1, 1, 3, 0], marking)).toEqual({ correct: 1, wrong: 1, blank: 1, double: 1, scoreHundredths: 50 });
  });

  it("leaves out a question without an answer, and marks past the paper's questions", () => {
    expect(gradeSheet([1, 2, 3, 0, 1], [1, -1, 3], marking)).toEqual({ correct: 2, wrong: 0, blank: 0, double: 0, scoreHundredths: 200 });
    // A sheet shorter than the paper: the rest are blanks.
    expect(gradeSheet([1], [1, 2, 3], marking)).toMatchObject({ correct: 1, blank: 2, scoreHundredths: 100 });
  });

  it("gives full marks to every set's own key, and less to another set's", () => {
    const paper = { seed: 777, firstSet: 101, shuffleQuestions: true, shuffleOptions: true };
    const questions = Array.from({ length: 25 }, (_, i) => ({ id: `q${i}`, optionCount: 4, answer: (i * 3) % 4 }));
    const keys = setCodes({ firstSet: 101, setCount: 5 }).map((code) => setKey(questions, setOrder(questions, paper, code)));
    for (const key of keys) expect(gradeSheet(decodeMarks(encodeMarks(key)), key, marking).scoreHundredths).toBe(2500);
    expect(gradeSheet(keys[1], keys[0], marking).scoreHundredths).toBeLessThan(2500);
  });
});

describe("answers typed by the teacher", () => {
  it("take Bangla or English letters, with - for a blank and * for two marks", () => {
    expect(parseAnswers("কখগঘ")).toEqual([0, 1, 2, 3]);
    expect(parseAnswers("a b,c-D*")).toEqual([0, 1, 2, BLANK, 3, DOUBLE]);
    expect(parseAnswers("")).toEqual([]);
  });

  it("refuse anything else, or an option the questions don't have", () => {
    expect(parseAnswers("কখX")).toBeNull();
    expect(parseAnswers("1234")).toBeNull();
    expect(parseAnswers("ঙ")).toBeNull();
    expect(parseAnswers("ঙ", 5)).toEqual([4]);
  });

  it("are written back the way they are typed", () => {
    expect(answersText([0, 1, BLANK, DOUBLE, 3])).toBe("কখ-*ঘ");
  });
});
