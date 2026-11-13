import { type SQL, and, asc, count, desc, eq, exists, ilike, or, sql } from "drizzle-orm";
import { isUuid } from "@/lib/ids";
import type { StudentInput, StudentStatus } from "@/lib/students";
import { hashPassword } from "@/server/auth/password";
import { type Database, uniqueViolation } from "@/server/db";
import { enrollments, sessions, students } from "@/server/db/schema";

// Every function takes the teacher's id (from the session, or from the site being visited) and
// filters on it: another teacher's student simply isn't found.

export type Student = Omit<typeof students.$inferSelect, "passwordHash"> & { hasLogin: boolean };

const studentColumns = {
  id: students.id,
  teacherId: students.teacherId,
  name: students.name,
  phone: students.phone,
  guardianName: students.guardianName,
  guardianPhone: students.guardianPhone,
  institution: students.institution,
  classLevel: students.classLevel,
  address: students.address,
  note: students.note,
  status: students.status,
  source: students.source,
  createdAt: students.createdAt,
  updatedAt: students.updatedAt,
  hasLogin: sql<boolean>`${students.passwordHash} is not null`,
};

/** A phone number already belongs to one of this teacher's students. */
export class StudentPhoneTaken extends Error {}

const isUniqueViolation = (error: unknown) => uniqueViolation(error) !== null;

/**
 * Adds a student to one teacher's list: with a password when they signed up themselves, without
 * one when the teacher added them (they can be given one later). Throws StudentPhoneTaken.
 */
export async function createStudent(
  db: Database,
  input: { teacherId: string; name: string; phone: string; password?: string; source?: "online" | "offline" } & Partial<StudentInput>,
): Promise<Student> {
  try {
    const [row] = await db
      .insert(students)
      .values({
        teacherId: input.teacherId,
        name: input.name,
        phone: input.phone,
        passwordHash: input.password ? await hashPassword(input.password) : null,
        guardianName: input.guardianName ?? "",
        guardianPhone: input.guardianPhone ?? "",
        institution: input.institution ?? "",
        classLevel: input.classLevel ?? "",
        address: input.address ?? "",
        note: input.note ?? "",
        source: input.source ?? (input.password ? "online" : "offline"),
      })
      .returning(studentColumns);
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) throw new StudentPhoneTaken();
    throw error;
  }
}

/** A student of this teacher. Another teacher's student is, by design, not found. */
export async function findStudent(db: Database, teacherId: string, studentId: string): Promise<Student | null> {
  if (!isUuid(studentId)) return null;
  const [row] = await db
    .select(studentColumns)
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.teacherId, teacherId)))
    .limit(1);
  return row ?? null;
}

/** For signing in on a teacher's site: the student with this phone there, and their password's hash. */
export async function findStudentForLogin(
  db: Database,
  teacherId: string,
  phone: string,
): Promise<{ id: string; status: StudentStatus; passwordHash: string | null } | null> {
  const [row] = await db
    .select({ id: students.id, status: students.status, passwordHash: students.passwordHash })
    .from(students)
    .where(and(eq(students.teacherId, teacherId), eq(students.phone, phone)))
    .limit(1);
  return row ?? null;
}

/** For checking a student's current password before it is changed. */
export async function studentPasswordHash(db: Database, teacherId: string, studentId: string): Promise<string | null> {
  const [row] = await db
    .select({ passwordHash: students.passwordHash })
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.teacherId, teacherId)))
    .limit(1);
  return row?.passwordHash ?? null;
}

export type StudentFilters = {
  search?: string;
  /** Only students with an enrolment in this course… */
  courseId?: string;
  /** …or in this batch. */
  batchId?: string;
  status?: StudentStatus;
  source?: "online" | "offline";
  /** 1-based. */
  page?: number;
};

export const STUDENTS_PAGE_SIZE = 50;

/** A LIKE pattern that matches `term` literally. */
function contains(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** The teacher's students, by name, a page at a time, with the filters applied. */
export async function listStudents(db: Database, teacherId: string, filters: StudentFilters = {}): Promise<{ items: Student[]; total: number }> {
  const conditions: SQL[] = [eq(students.teacherId, teacherId)];
  const search = filters.search?.trim();
  if (search) conditions.push(or(ilike(students.name, contains(search)), ilike(students.phone, contains(search)))!);
  if (filters.status) conditions.push(eq(students.status, filters.status));
  if (filters.source) conditions.push(eq(students.source, filters.source));
  if (filters.courseId || filters.batchId) {
    const inPlace: SQL[] = [eq(enrollments.studentId, students.id), eq(enrollments.status, "active")];
    if (filters.courseId && isUuid(filters.courseId)) inPlace.push(eq(enrollments.courseId, filters.courseId));
    if (filters.batchId && isUuid(filters.batchId)) inPlace.push(eq(enrollments.batchId, filters.batchId));
    conditions.push(exists(db.select({ id: enrollments.id }).from(enrollments).where(and(...inPlace))));
  }
  const where = and(...conditions);
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const [items, [{ total }]] = await Promise.all([
    db
      .select(studentColumns)
      .from(students)
      .where(where)
      .orderBy(asc(students.name), desc(students.createdAt))
      .limit(STUDENTS_PAGE_SIZE)
      .offset((page - 1) * STUDENTS_PAGE_SIZE),
    db.select({ total: count() }).from(students).where(where),
  ]);
  return { items, total: Number(total) };
}

/** Changes what is known about a student. Null when they aren't this teacher's; throws StudentPhoneTaken. */
export async function updateStudent(db: Database, teacherId: string, studentId: string, input: StudentInput): Promise<Student | null> {
  if (!isUuid(studentId)) return null;
  try {
    const [row] = await db
      .update(students)
      .set(input)
      .where(and(eq(students.id, studentId), eq(students.teacherId, teacherId)))
      .returning(studentColumns);
    return row ?? null;
  } catch (error) {
    if (isUniqueViolation(error)) throw new StudentPhoneTaken();
    throw error;
  }
}

/** Sets a student's password (their own change, or the teacher's reset) and signs them out everywhere else. */
export async function setStudentPassword(
  db: Database,
  teacherId: string,
  studentId: string,
  password: string,
  options: { keepSessions?: boolean } = {},
): Promise<boolean> {
  if (!isUuid(studentId)) return false;
  const passwordHash = await hashPassword(password);
  const changed = await db
    .update(students)
    .set({ passwordHash })
    .where(and(eq(students.id, studentId), eq(students.teacherId, teacherId)))
    .returning({ id: students.id });
  if (changed.length === 0) return false;
  if (!options.keepSessions) await db.delete(sessions).where(eq(sessions.studentId, studentId));
  return true;
}

/** Lets a student in again, or keeps them out: an inactive student's sessions end at once. */
export async function setStudentStatus(db: Database, teacherId: string, studentId: string, status: StudentStatus): Promise<boolean> {
  if (!isUuid(studentId)) return false;
  const changed = await db
    .update(students)
    .set({ status })
    .where(and(eq(students.id, studentId), eq(students.teacherId, teacherId)))
    .returning({ id: students.id });
  if (changed.length === 0) return false;
  if (status === "inactive") await db.delete(sessions).where(eq(sessions.studentId, studentId));
  return true;
}

/** Deletes a student with their enrolments and sessions. */
export async function deleteStudent(db: Database, teacherId: string, studentId: string): Promise<boolean> {
  if (!isUuid(studentId)) return false;
  const gone = await db
    .delete(students)
    .where(and(eq(students.id, studentId), eq(students.teacherId, teacherId)))
    .returning({ id: students.id });
  return gone.length > 0;
}

/** How many students the teacher has. */
export async function countStudents(db: Database, teacherId: string): Promise<number> {
  const [{ total }] = await db.select({ total: count() }).from(students).where(eq(students.teacherId, teacherId));
  return Number(total);
}
