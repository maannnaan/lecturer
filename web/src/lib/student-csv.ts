import type { FieldError, FieldErrors } from "./form-input";
import { type StudentInput, parseRoll, parseStudent } from "./students";

// Students as a spreadsheet: the list a teacher downloads, and the one they upload to add many at
// once (typically typed in Excel from a paper register).

/** The most students one upload adds. */
export const IMPORT_MAX = 500;

/**
 * A CSV file's rows and cells. Reads what spreadsheets write: quoted cells (with commas, line
 * breaks and doubled quotes inside), either line ending, a byte-order mark, and tabs instead of
 * commas (cells copied straight out of a sheet). Blank lines are dropped.
 */
export function parseCsv(source: string): string[][] {
  const text = source.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows.map((cells) => cells.map((value) => value.trim())).filter((cells) => cells.some(Boolean));
}

/**
 * One cell, safe to open in a spreadsheet: quoted when it needs to be, and with a leading
 * apostrophe when it starts like a formula (=, +, -, @), so a name typed by a stranger can never
 * run as one on the teacher's computer.
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows as a CSV file Excel opens with Bangla intact (it needs the byte-order mark to read UTF-8). */
export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return `﻿${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export const CSV_FIELDS = ["name", "phone", "guardianName", "guardianPhone", "institution", "classLevel", "address", "roll"] as const;
export type CsvField = (typeof CSV_FIELDS)[number];

/** The headings each column is known by, in Bangla and English (compared without case or spaces). */
const HEADINGS: Record<CsvField, string[]> = {
  name: ["নাম", "শিক্ষার্থীর নাম", "name", "student", "student name"],
  phone: ["মোবাইল নম্বর", "মোবাইল", "ফোন", "ফোন নম্বর", "phone", "mobile", "mobile number", "phone number"],
  guardianName: ["অভিভাবকের নাম", "অভিভাবক", "guardian", "guardian name", "guardian's name"],
  guardianPhone: ["অভিভাবকের মোবাইল নম্বর", "অভিভাবকের মোবাইল", "অভিভাবকের ফোন", "guardian phone", "guardian mobile", "guardian's mobile number"],
  institution: ["স্কুল / কলেজ", "স্কুল/কলেজ", "প্রতিষ্ঠান", "স্কুল", "কলেজ", "institution", "school", "college", "school / college"],
  classLevel: ["শ্রেণি", "ক্লাস", "class"],
  address: ["ঠিকানা", "address"],
  roll: ["রোল", "রোল নম্বর", "roll", "roll number"],
};

const key = (heading: string) => heading.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
const FIELD_OF = new Map(CSV_FIELDS.flatMap((field) => HEADINGS[field].map((heading) => [key(heading), field] as const)));

/** A spreadsheet drops a number's leading zero: 1712345678 is 01712345678. */
const phoneCell = (value: string) => (/^1[3-9]\d{8}$/.test(value) ? `0${value}` : value);

export type CsvStudent = { line: number; student: StudentInput; roll: string | null };
export type CsvProblem = { line: number; field: CsvField; error: FieldError };

/**
 * The students in an uploaded sheet. The first row names the columns (any order; unknown ones are
 * ignored, so a downloaded list can be uploaded again); name and mobile number are needed. Every
 * row is checked like the dashboard's own form, and a number that appears twice is refused the
 * second time. Nothing is added unless `problems` is empty.
 */
export function parseStudentCsv(source: string): { students: CsvStudent[]; problems: CsvProblem[]; missing: CsvField[]; tooMany: boolean } {
  const [header = [], ...lines] = parseCsv(source);
  const columns = header.map((heading) => FIELD_OF.get(key(heading)));
  const missing = (["name", "phone"] as const).filter((field) => !columns.includes(field));
  if (missing.length > 0) return { students: [], problems: [], missing, tooMany: false };

  const students: CsvStudent[] = [];
  const problems: CsvProblem[] = [];
  const seen = new Set<string>();
  lines.slice(0, IMPORT_MAX).forEach((cells, i) => {
    const line = i + 2;
    const input: Partial<Record<CsvField, string>> = {};
    columns.forEach((field, c) => {
      if (field && input[field] === undefined) input[field] = cells[c] ?? "";
    });
    const { student, errors } = parseStudent({ ...input, phone: phoneCell(input.phone ?? ""), guardianPhone: phoneCell(input.guardianPhone ?? "") });
    const rollErrors: FieldErrors = {};
    const roll = parseRoll(input.roll, rollErrors);
    if (!errors.phone && seen.has(student.phone)) errors.phone = "phoneTaken";
    seen.add(student.phone);
    for (const [field, error] of Object.entries({ ...errors, ...rollErrors })) problems.push({ line, field: field as CsvField, error });
    students.push({ line, student, roll });
  });
  return { students, problems, missing: [], tooMany: lines.length > IMPORT_MAX };
}
