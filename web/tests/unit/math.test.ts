import { describe, expect, it } from "vitest";
import { hasMath, splitMath } from "@/lib/math";

describe("splitMath", () => {
  it("keeps plain text whole", () => {
    expect(splitMath("নিউটনের প্রথম সূত্রটি লিখ।")).toEqual([{ kind: "text", value: "নিউটনের প্রথম সূত্রটি লিখ।" }]);
    expect(splitMath("")).toEqual([]);
  });

  it("finds inline maths between single dollars", () => {
    expect(splitMath("$2\\,\\text{kg}$ ভরের বস্তুতে $F = ma$ প্রয়োগ")).toEqual([
      { kind: "inline", tex: "2\\,\\text{kg}" },
      { kind: "text", value: " ভরের বস্তুতে " },
      { kind: "inline", tex: "F = ma" },
      { kind: "text", value: " প্রয়োগ" },
    ]);
  });

  it("finds display maths between double dollars, even across lines", () => {
    expect(splitMath("সুতরাং\n$$\\begin{aligned} f &= \\mu R \\\\ &= 8.49 \\end{aligned}$$\nনিউটন")).toEqual([
      { kind: "text", value: "সুতরাং\n" },
      { kind: "display", tex: "\\begin{aligned} f &= \\mu R \\\\ &= 8.49 \\end{aligned}" },
      { kind: "text", value: "\nনিউটন" },
    ]);
  });

  it("turns \\$ into a literal dollar sign", () => {
    expect(splitMath("দাম \\$5 মাত্র")).toEqual([{ kind: "text", value: "দাম $5 মাত্র" }]);
  });

  it("leaves a dollar with no partner as text", () => {
    expect(splitMath("এক ডলার $ সমান")).toEqual([{ kind: "text", value: "এক ডলার $ সমান" }]);
    expect(splitMath("$$ শুধু শুরু")).toEqual([{ kind: "text", value: "$$ শুধু শুরু" }]);
  });

  it("doesn't let inline maths run across a blank line", () => {
    expect(splitMath("$a\n\nb$")).toEqual([{ kind: "text", value: "$a\n\nb$" }]);
  });

  it("keeps escaped dollars inside maths for KaTeX", () => {
    expect(splitMath("$\\$10$")).toEqual([{ kind: "inline", tex: "\\$10" }]);
  });

  it("treats empty pairs as text", () => {
    expect(splitMath("$$$$")).toEqual([{ kind: "text", value: "$$$$" }]);
  });

  it("hasMath says whether any maths is present", () => {
    expect(hasMath("প্লেইন")).toBe(false);
    expect(hasMath("$x^2$")).toBe(true);
  });
});
