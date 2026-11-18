import { describe, expect, it } from "vitest";
import { attemptOrder, deadlineOf, dhakaDateTime, gradeAttempt, mulberry32, parseExam, rankAttempts, seedOf, shuffled, toDhakaInput } from "@/lib/exams";

describe("a student's order", () => {
  it("is the same every time for the same seed, and different for another", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const a = shuffled(items, mulberry32(seedOf("exam-1:student-1")));
    expect(shuffled(items, mulberry32(seedOf("exam-1:student-1")))).toEqual(a);
    expect(shuffled(items, mulberry32(seedOf("exam-1:student-2")))).not.toEqual(a);
    // A shuffle loses nothing and repeats nothing.
    expect([...a].sort((x, y) => x - y)).toEqual(items);
    expect(items).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it("shuffles questions and options only when the exam says so", () => {
    const questions = ["q1", "q2", "q3", "q4", "q5", "q6"].map((id) => ({ id, optionCount: 4 }));
    const plain = attemptOrder(questions, 42, { shuffleQuestions: false, shuffleOptions: false });
    expect(plain.questions).toEqual(["q1", "q2", "q3", "q4", "q5", "q6"]);
    expect(plain.options.q1).toEqual([0, 1, 2, 3]);

    const mixed = attemptOrder(questions, 42, { shuffleQuestions: true, shuffleOptions: true });
    expect([...mixed.questions].sort()).toEqual(plain.questions);
    for (const q of questions) expect([...mixed.options[q.id]].sort()).toEqual([0, 1, 2, 3]);
    // Over many students, the orders do differ.
    const firsts = new Set(Array.from({ length: 30 }, (_, s) => attemptOrder(questions, s, { shuffleQuestions: true, shuffleOptions: false }).questions[0]));
    expect(firsts.size).toBeGreaterThan(1);
  });
});

describe("a sitting", () => {
  it("ends after its duration, but never after the exam closes", () => {
    const start = new Date("2026-11-20T10:00:00Z");
    expect(deadlineOf(start, 30, new Date("2026-11-20T12:00:00Z"))).toEqual(new Date("2026-11-20T10:30:00Z"));
    expect(deadlineOf(start, 30, new Date("2026-11-20T10:10:00Z"))).toEqual(new Date("2026-11-20T10:10:00Z"));
  });

  it("scores right answers, takes off for wrong ones, and leaves unanswered ones alone", () => {
    const questions = [
      { id: "a", answer: 1 },
      { id: "b", answer: 2 },
      { id: "c", answer: 0 },
      { id: "d", answer: 3 },
    ];
    const answers = { a: 1, b: 0, d: 3, notInExam: 2 };
    expect(gradeAttempt(questions, answers, { markHundredths: 100, negativeHundredths: 25 })).toEqual({ correct: 2, wrong: 1, skipped: 1, scoreHundredths: 175 });
    expect(gradeAttempt(questions, {}, { markHundredths: 100, negativeHundredths: 25 })).toEqual({ correct: 0, wrong: 0, skipped: 4, scoreHundredths: 0 });
    // All wrong can go below nothing.
    expect(gradeAttempt(questions, { a: 0, b: 0, c: 1, d: 0 }, { markHundredths: 100, negativeHundredths: 50 }).scoreHundredths).toBe(-200);
  });

  it("ranks by score, then less time, then who finished first; equals share a place", () => {
    const at = (minute: number) => new Date(Date.UTC(2026, 10, 20, 10, minute));
    const ranked = rankAttempts([
      { name: "slow", scoreHundredths: 800, tookMs: 600_000, submittedAt: at(10) },
      { name: "top", scoreHundredths: 900, tookMs: 900_000, submittedAt: at(15) },
      { name: "fast", scoreHundredths: 800, tookMs: 300_000, submittedAt: at(5) },
      { name: "twin", scoreHundredths: 800, tookMs: 300_000, submittedAt: at(5) },
      { name: "last", scoreHundredths: 100, tookMs: 60_000, submittedAt: at(1) },
    ]);
    expect(ranked.map((r) => [r.name, r.rank])).toEqual([
      ["top", 1],
      ["fast", 2],
      ["twin", 2],
      ["slow", 4],
      ["last", 5],
    ]);
  });
});

describe("an exam's settings", () => {
  const good = {
    courseId: "c",
    title: "সাপ্তাহিক পরীক্ষা ১",
    startsAt: "2026-11-20T10:00",
    endsAt: "2026-11-20T10:30",
    durationMin: "৩০",
    mark: "1",
    negative: "০.২৫",
    shuffleQuestions: "on",
    results: "immediate",
    showAnswers: "on",
  };

  it("are read in Bangladesh time, with marks in hundredths", () => {
    const { exam, errors } = parseExam(good);
    expect(errors).toEqual({});
    expect(exam).toMatchObject({
      courseId: "c",
      batchId: null,
      startsAt: new Date("2026-11-20T04:00:00Z"),
      endsAt: new Date("2026-11-20T04:30:00Z"),
      durationMin: 30,
      markHundredths: 100,
      negativeHundredths: 25,
      shuffleQuestions: true,
      shuffleOptions: false,
      results: "immediate",
      showAnswers: true,
    });
    expect(toDhakaInput(exam.startsAt)).toBe("2026-11-20T10:00");
    expect(dhakaDateTime("২০২৬-১১-২০T১০:০০")).toEqual(new Date("2026-11-20T04:00:00Z"));
  });

  it("refuse an end before the start, no duration, and a negative mark bigger than the mark", () => {
    expect(parseExam({ ...good, endsAt: "2026-11-20T09:00" }).errors).toEqual({ endsAt: "dateOrder" });
    expect(parseExam({ ...good, durationMin: "" }).errors).toEqual({ durationMin: "required" });
    expect(parseExam({ ...good, durationMin: "0" }).errors).toEqual({ durationMin: "number" });
    expect(parseExam({ ...good, negative: "2" }).errors).toEqual({ negative: "invalid" });
    expect(parseExam({ ...good, mark: "0" }).errors).toEqual({ mark: "number" });
    expect(parseExam({ ...good, startsAt: "tomorrow" }).errors).toEqual({ startsAt: "invalid" });
    expect(parseExam({}).errors).toMatchObject({ courseId: "required", title: "required", startsAt: "required", endsAt: "required", durationMin: "required" });
  });
});
