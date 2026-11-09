import { describe, expect, it } from "vitest";
import { parseQuestion } from "@/lib/questions";

const course = "6f1c2b3a-1d2e-4f50-8a9b-0c1d2e3f4a5b";

const mcq = (extra: Record<string, string> = {}) => ({
  type: "mcq",
  courseId: course,
  stem: "$2\\,\\text{kg}$ ভরের বস্তুতে $10\\,\\text{N}$ বল প্রয়োগ করলে ত্বরণ কত?",
  option0: "$2$",
  option1: "$5$",
  option2: "$10$",
  option3: "$20$",
  answer: "1",
  ...extra,
});

describe("parseQuestion", () => {
  it("reads an MCQ with its answer and explanation", () => {
    const { question, errors } = parseQuestion(mcq({ explanation: "$a = F/m$", board: "dhaka", year: "২০২৩" }));
    expect(errors).toEqual({});
    expect(question.type).toBe("mcq");
    expect(question.body).toEqual({
      stem: mcq().stem,
      options: ["$2$", "$5$", "$10$", "$20$"],
      answer: 1,
      explanation: "$a = F/m$",
    });
    expect(question.board).toBe("dhaka");
    expect(question.year).toBe(2023);
    expect(question.visibility).toBe("public");
    expect(question.chapterId).toBeNull();
  });

  it("insists on all four options and a chosen answer", () => {
    const { errors } = parseQuestion(mcq({ option2: "", answer: "" }));
    expect(errors.option2).toBe("required");
    expect(errors.answer).toBe("pickAnswer");
    expect(parseQuestion(mcq({ answer: "4" })).errors.answer).toBe("pickAnswer");
    expect(parseQuestion(mcq({ answer: "x" })).errors.answer).toBe("pickAnswer");
  });

  it("reads a multiple-completion MCQ, dropping empty statements", () => {
    const { question, errors } = parseQuestion(
      mcq({ type: "mcq_multi", statement0: "ভরবেগ ভেক্টর রাশি", statement1: "একক kg m/s", statement2: "", statement3: "ঘাত = ভরবেগের পরিবর্তন", prompt: "" }),
    );
    expect(errors).toEqual({});
    expect(question.body.statements).toEqual(["ভরবেগ ভেক্টর রাশি", "একক kg m/s", "ঘাত = ভরবেগের পরিবর্তন"]);
    expect(question.body.prompt).toBe("");
  });

  it("needs at least two statements", () => {
    const { errors } = parseQuestion(mcq({ type: "mcq_multi", statement0: "শুধু একটি" }));
    expect(errors.statement1).toBe("required");
  });

  it("reads a creative question with default and custom marks", () => {
    const input = {
      type: "creative",
      courseId: course,
      stem: "৫ kg ভরের একটি বাক্স আনত তলে…",
      part0: "নিউটনের প্রথম সূত্রটি লিখ।",
      part1: "ঘর্ষণ বল কেন গতির বিপরীতে?",
      part2: "ঘর্ষণ বল নির্ণয় কর।",
      part3: "বাক্সটি কি নামবে?",
      marks3: "৫",
      solution2: "$f = \\mu R$",
    };
    const { question, errors } = parseQuestion(input);
    expect(errors).toEqual({});
    expect(question.body.parts?.map((p) => p.marks)).toEqual([1, 2, 3, 5]);
    expect(question.body.parts?.[2].solution).toBe("$f = \\mu R$");
    expect(question.body.options).toBeUndefined();
  });

  it("refuses a creative question with a missing part or bad marks", () => {
    const { errors } = parseQuestion({ type: "creative", courseId: course, stem: "উদ্দীপক", part0: "ক", part1: "খ", part2: "গ", marks1: "দুই" });
    expect(errors.part3).toBe("required");
    expect(errors.marks1).toBe("number");
  });

  it("reads short questions, and textbook and practice problems", () => {
    expect(parseQuestion({ type: "short", courseId: course, stem: "জড়তা কী?", modelAnswer: "বস্তুর অবস্থা…" }).question.body).toEqual({
      stem: "জড়তা কী?",
      modelAnswer: "বস্তুর অবস্থা…",
    });
    const textbook = parseQuestion({ type: "textbook", courseId: course, stem: "সমস্যা", finalAnswer: "$5\\,\\text{N}$", solution: "সমাধান" });
    expect(textbook.errors).toEqual({});
    expect(textbook.question.body).toEqual({ stem: "সমস্যা", finalAnswer: "$5\\,\\text{N}$", solution: "সমাধান" });
    // A practice problem may have neither an answer nor a solution yet.
    expect(parseQuestion({ type: "practice", courseId: course, stem: "সমস্যা" }).question.body).toEqual({
      stem: "সমস্যা",
      finalAnswer: "",
      solution: "",
    });
    expect(parseQuestion({ type: "practice", courseId: course, stem: "সমস্যা", finalAnswer: "x".repeat(301) }).errors.finalAnswer).toBe("tooLong");
  });

  it("no longer knows the old 'problem' type, which became 'textbook'", () => {
    expect(parseQuestion({ type: "problem", courseId: course, stem: "সমস্যা" }).errors.type).toBe("invalid");
  });

  it("requires a stem, a course and a known type", () => {
    const { errors } = parseQuestion({ type: "essay", stem: "" });
    expect(errors.type).toBe("invalid");
    expect(errors.courseId).toBe("required");
    expect(errors.stem).toBe("required");
  });

  it("checks the year, board and video link", () => {
    expect(parseQuestion(mcq({ year: "23" })).errors.year).toBe("invalid");
    expect(parseQuestion(mcq({ year: "1800" })).errors.year).toBe("invalid");
    expect(parseQuestion(mcq({ board: "nowhere" })).question.board).toBe("");
    expect(parseQuestion(mcq({ videoUrl: "youtu.be/abc" })).question.videoUrl).toBe("https://youtu.be/abc");
    expect(parseQuestion(mcq({ videoUrl: "https://evil.example/x" })).errors.videoUrl).toBe("url");
  });

  it("keeps the chosen visibility, chapter and image", () => {
    const { question } = parseQuestion(mcq({ visibility: "private", chapterId: course, imageId: course }));
    expect(question.visibility).toBe("private");
    expect(question.chapterId).toBe(course);
    expect(question.imageId).toBe(course);
  });
});
