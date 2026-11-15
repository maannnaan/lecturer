import type { CsvStudent } from "@/lib/student-csv";
import type { Database } from "@/server/db";
import { enrollStudent, listEnrollments } from "@/server/enrollments";
import { StudentPhoneTaken, createStudent, findStudentForLogin, listStudents } from "@/server/students";

export type ImportResult = {
  /** Students newly added. */
  added: number;
  /** Students whose number the teacher already had: left as they are (and enrolled, if a course was chosen). */
  existing: number;
  /** Students put into the chosen course. */
  enrolled: number;
  /** Rows that couldn't be enrolled, e.g. a roll someone already has. The student is still on the list. */
  problems: { line: number; reason: "rollTaken" | "course" | "batch" | "student" | "missing" }[];
};

/**
 * Adds a checked sheet of students to the teacher's list, as offline students, and (with a
 * `target`) puts each into that course and batch with the roll the sheet gives, or the next free one.
 */
export async function importStudents(
  db: Database,
  teacherId: string,
  rows: CsvStudent[],
  target?: { courseId: string; batchId: string | null },
): Promise<ImportResult> {
  const result: ImportResult = { added: 0, existing: 0, enrolled: 0, problems: [] };
  for (const row of rows) {
    let studentId: string;
    try {
      studentId = (await createStudent(db, { ...row.student, teacherId, source: "offline" })).id;
      result.added++;
    } catch (error) {
      if (!(error instanceof StudentPhoneTaken)) throw error;
      const found = await findStudentForLogin(db, teacherId, row.student.phone);
      if (!found) throw error;
      studentId = found.id;
      result.existing++;
    }
    if (!target) continue;
    const placed = await enrollStudent(db, teacherId, studentId, target.courseId, { batchId: target.batchId, roll: row.roll, fee: null });
    if (placed.ok) result.enrolled++;
    else result.problems.push({ line: row.line, reason: placed.reason });
  }
  return result;
}

/**
 * The teacher's students as rows for a spreadsheet: one row per course a student is in (so their
 * batch, roll and fee sit beside them), and one for a student who is in none.
 */
export async function exportStudents(db: Database, teacherId: string) {
  const all = [];
  for (let page = 1; ; page++) {
    const { items, total } = await listStudents(db, teacherId, { page });
    all.push(...items);
    if (all.length >= total || items.length === 0) break;
  }
  const places = await listEnrollments(db, teacherId, { status: "active" });
  return all.flatMap((student) => {
    const mine = places.filter((place) => place.studentId === student.id);
    return (mine.length > 0 ? mine : [null]).map((place) => ({ student, place }));
  });
}
