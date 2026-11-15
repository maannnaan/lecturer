"use server";

import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { type CsvField, IMPORT_MAX, parseStudentCsv } from "@/lib/student-csv";
import { requireTeacher } from "@/server/auth/current";
import { getBatch } from "@/server/batches";
import { getCourse } from "@/server/courses";
import { getDb } from "@/server/db";
import { importStudents } from "@/server/student-import";
import { messages } from "../../form-state";

/** What the import form shows after a check or a run: a verdict, and the lines behind it. */
export type ImportState = {
  tone?: "ok" | "bad";
  title?: string;
  lines?: string[];
  /** The sheet that was checked and found good: only this exact text may then be added. */
  checked?: string;
  done?: boolean;
};

/** The most problem lines listed back; a sheet with more is better fixed in the spreadsheet. */
const SHOWN = 40;

/**
 * "যাচাই করুন" checks the sheet and says what is wrong, line by line, adding nothing. "যোগ করুন"
 * checks it again and, only if every row is right, adds the students (and enrols them, with a
 * course chosen).
 */
export async function importStudentsAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.students;
  const io = t.io;
  const n = (value: number) => formatNumber(value, locale);
  const text = String(formData.get("csv") ?? "");
  const run = formData.get("mode") === "run";

  const { students, problems, missing, tooMany } = parseStudentCsv(text);
  const label: Record<CsvField, string> = {
    name: t.name,
    phone: t.phone,
    guardianName: t.guardianName,
    guardianPhone: t.guardianPhone,
    institution: t.institution,
    classLevel: t.classLevel,
    address: t.address,
    roll: d.dashboard.requests.roll,
  };
  if (missing.length > 0) return { tone: "bad", title: io.missing(missing.map((field) => label[field]).join(", ")) };
  if (students.length === 0) return { tone: "bad", title: io.none };
  if (tooMany) return { tone: "bad", title: io.tooMany(n(IMPORT_MAX)) };
  if (problems.length > 0) {
    const why = messages(d.errors);
    return {
      tone: "bad",
      title: io.problems(n(problems.length)),
      lines: problems.slice(0, SHOWN).map((p) => `${io.line(n(p.line))} · ${label[p.field]}: ${why[p.error]}`),
    };
  }
  // (A browser posts a textarea's line breaks as \r\n: the form compares with plain ones.)
  if (!run) return { tone: "ok", title: io.ready(n(students.length)), checked: text.replace(/\r\n?/g, "\n") };

  // The course and batch to enrol everyone in, if chosen: the teacher's own, and belonging together.
  const db = await getDb();
  const courseId = String(formData.get("courseId") ?? "");
  const batchId = String(formData.get("batchId") ?? "") || null;
  let target: { courseId: string; batchId: string | null } | undefined;
  if (courseId) {
    const course = await getCourse(db, teacher.id, courseId);
    const batch = batchId ? await getBatch(db, teacher.id, batchId) : null;
    if (!course || (batchId && batch?.courseId !== course.id)) return { tone: "bad", title: d.errors.generic };
    target = { courseId: course.id, batchId };
  }

  const result = await importStudents(db, teacher.id, students, target);
  const lines = [];
  if (target) lines.push(io.enrolled(n(result.enrolled)));
  if (result.problems.length > 0) {
    lines.push(io.notEnrolled);
    for (const p of result.problems.slice(0, SHOWN)) {
      lines.push(`${io.line(n(p.line))}: ${p.reason === "rollTaken" ? d.errors.rollTaken : d.errors.invalid}`);
    }
  }
  return { tone: "ok", title: io.done(n(result.added), n(result.existing)), lines, done: true };
}
