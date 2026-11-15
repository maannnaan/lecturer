import { describe, expect, it } from "vitest";
import { IMPORT_MAX, csvCell, parseCsv, parseStudentCsv, toCsv } from "@/lib/student-csv";

describe("CSV files", () => {
  it("are read as spreadsheets write them", () => {
    expect(parseCsv('﻿নাম,মোবাইল\r\n"উদ্দিন, রাহিম",01712345678\r\n\r\n"বলে ""হ্যাঁ""",  x  \n"দুই\nলাইন",y')).toEqual([
      ["নাম", "মোবাইল"],
      ["উদ্দিন, রাহিম", "01712345678"],
      ['বলে "হ্যাঁ"', "x"],
      ["দুই\nলাইন", "y"],
    ]);
    // Cells copied straight out of a sheet come with tabs.
    expect(parseCsv("name\tphone\nRahim\t01712345678")).toEqual([
      ["name", "phone"],
      ["Rahim", "01712345678"],
    ]);
    expect(parseCsv("")).toEqual([]);
  });

  it("are written so a spreadsheet opens them safely, with Bangla intact", () => {
    expect(csvCell("রাহিম")).toBe("রাহিম");
    expect(csvCell("উদ্দিন, রাহিম")).toBe('"উদ্দিন, রাহিম"');
    expect(csvCell('বলে "হ্যাঁ"')).toBe('"বলে ""হ্যাঁ"""');
    expect(csvCell(1200)).toBe("1200");
    expect(csvCell(null)).toBe("");
    // A cell that starts like a formula is made plain text, so it can't run on the teacher's computer.
    for (const cell of ["=HYPERLINK(\"http://evil\")", "+1", "-1", "@SUM(A1)"]) expect(csvCell(cell).replace(/^"/, "")).toMatch(/^'/);
    const file = toCsv([
      ["নাম", "ফি"],
      ["রাহিম", 1200],
    ]);
    expect(file).toBe("﻿নাম,ফি\r\nরাহিম,1200\r\n");
    expect(parseCsv(file)).toEqual([
      ["নাম", "ফি"],
      ["রাহিম", "1200"],
    ]);
  });
});

describe("a sheet of students", () => {
  it("is read by its headings, in Bangla or English, in any order, ignoring columns it doesn't know", () => {
    const { students, problems, missing } = parseStudentCsv(
      ["মোবাইল নম্বর,নাম,কোর্স,রোল,অভিভাবকের মোবাইল নম্বর,শ্রেণি", "01712345678,রাহিম উদ্দিন,পদার্থবিজ্ঞান,০৫,1812345678,একাদশ", "+880 1912-345678,সাদিয়া,,,,"].join("\n"),
    );
    expect(missing).toEqual([]);
    expect(problems).toEqual([]);
    expect(students).toEqual([
      // A spreadsheet dropped the guardian number's leading zero: it is put back.
      { line: 2, roll: "5", student: expect.objectContaining({ name: "রাহিম উদ্দিন", phone: "01712345678", guardianPhone: "01812345678", classLevel: "একাদশ" }) },
      { line: 3, roll: null, student: expect.objectContaining({ name: "সাদিয়া", phone: "01912345678", guardianPhone: "" }) },
    ]);
    expect(parseStudentCsv("Name,Mobile,Roll\nRahim,01712345678,12").students[0]).toMatchObject({ roll: "12", student: { name: "Rahim" } });
  });

  it("says which columns are missing, and what is wrong on which line", () => {
    expect(parseStudentCsv("রোল,শ্রেণি\n1,একাদশ").missing).toEqual(["name", "phone"]);
    expect(parseStudentCsv("নাম\nরাহিম").missing).toEqual(["phone"]);
    expect(parseStudentCsv("").missing).toEqual(["name", "phone"]);

    const { problems } = parseStudentCsv(["নাম,মোবাইল,রোল", "রাহিম,01712345678,1", ",12345,abc", "করিম,01712345678,2"].join("\n"));
    expect(problems).toEqual([
      { line: 3, field: "name", error: "required" },
      { line: 3, field: "phone", error: "phone" },
      { line: 3, field: "roll", error: "roll" },
      // The same number twice in one sheet.
      { line: 4, field: "phone", error: "phoneTaken" },
    ]);
  });

  it("takes at most a set number of students at once", () => {
    const rows = Array.from({ length: IMPORT_MAX + 1 }, (_, i) => `শিক্ষার্থী ${i},019${String(10000000 + i)}`);
    const { students, tooMany } = parseStudentCsv(["নাম,মোবাইল", ...rows].join("\n"));
    expect(tooMany).toBe(true);
    expect(students).toHaveLength(IMPORT_MAX);
    expect(parseStudentCsv(["নাম,মোবাইল", ...rows.slice(0, 3)].join("\n")).tooMany).toBe(false);
  });
});
