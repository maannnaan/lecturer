import { type SQL, and, asc, count, desc, eq } from "drizzle-orm";
import { isUuid } from "@/lib/ids";
import { type EnrollmentStatus, type PlacementInput, dhakaMonth, nextRoll } from "@/lib/students";
import { type Database, uniqueViolation } from "@/server/db";
import { batches, courses, enrollments, students } from "@/server/db/schema";
import type { Tx } from "./ordering";

// Who is in which course: asking to join, being let in or turned down, and a student's place
// (batch, roll, fee) once in. Every function takes the teacher's id and filters on it.

export type Enrollment = typeof enrollments.$inferSelect;
/** An enrolment with the names a list shows beside it. */
export type EnrollmentRow = Enrollment & {
  studentName: string;
  studentPhone: string;
  courseTitle: string;
  courseNumber: number;
  batchName: string | null;
};

export type EnrollResult = { ok: true; enrollment: Enrollment } | { ok: false; reason: "missing" | "course" | "batch" | "student" | "rollTaken" };

const rowColumns = {
  enrollment: enrollments,
  studentName: students.name,
  studentPhone: students.phone,
  courseTitle: courses.title,
  courseNumber: courses.number,
  batchName: batches.name,
};

function rows(db: Database | Tx, where: SQL | undefined) {
  return db
    .select(rowColumns)
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .leftJoin(batches, eq(batches.id, enrollments.batchId))
    .where(where);
}

const flat = (row: { enrollment: Enrollment } & Omit<EnrollmentRow, keyof Enrollment>): EnrollmentRow => {
  const { enrollment, ...names } = row;
  return { ...enrollment, ...names };
};

/** The teacher's course, if it is theirs. */
async function ownCourse(db: Database | Tx, teacherId: string, courseId: string) {
  if (!isUuid(courseId)) return null;
  const [course] = await db
    .select({ id: courses.id, access: courses.access, price: courses.price, published: courses.published })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.teacherId, teacherId)))
    .limit(1);
  return course ?? null;
}

/** Whether a batch id is a batch of this course (null, no batch, always is). */
async function batchFits(db: Database | Tx, teacherId: string, courseId: string, batchId: string | null): Promise<boolean> {
  if (batchId === null) return true;
  if (!isUuid(batchId)) return false;
  const [batch] = await db
    .select({ id: batches.id })
    .from(batches)
    .where(and(eq(batches.id, batchId), eq(batches.courseId, courseId), eq(batches.teacherId, teacherId)))
    .limit(1);
  return Boolean(batch);
}

async function ownStudent(db: Database | Tx, teacherId: string, studentId: string): Promise<boolean> {
  if (!isUuid(studentId)) return false;
  const [student] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.teacherId, teacherId)))
    .limit(1);
  return Boolean(student);
}

/** The next free roll in a course. */
async function freeRoll(db: Database | Tx, courseId: string): Promise<string> {
  const taken = await db.select({ roll: enrollments.roll }).from(enrollments).where(eq(enrollments.courseId, courseId));
  return nextRoll(taken.map((row) => row.roll));
}

/** What an enrolment gets when the student is let in: a roll, the fee, the month it starts. */
async function placeIn(
  db: Database | Tx,
  course: { id: string; price: number },
  placement: PlacementInput,
  current?: Pick<Enrollment, "roll" | "startMonth">,
) {
  return {
    status: "active" as const,
    batchId: placement.batchId,
    roll: placement.roll ?? current?.roll ?? (await freeRoll(db, course.id)),
    fee: placement.fee ?? course.price,
    startMonth: current?.startMonth || dhakaMonth(),
    decidedAt: new Date(),
  };
}

/**
 * A student asks to join a course from the teacher's website. A free course lets them straight
 * in; any other waits for the teacher. Asking again after being turned down, or after leaving,
 * puts the request back in the queue; asking twice changes nothing.
 */
export async function requestEnrollment(
  db: Database,
  teacherId: string,
  studentId: string,
  courseId: string,
  request: { batchId?: string | null; note?: string } = {},
): Promise<EnrollResult> {
  const course = await ownCourse(db, teacherId, courseId);
  if (!course || !course.published) return { ok: false, reason: "course" };
  if (!(await ownStudent(db, teacherId, studentId))) return { ok: false, reason: "student" };
  const batchId = request.batchId || null;
  if (!(await batchFits(db, teacherId, courseId, batchId))) return { ok: false, reason: "batch" };

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.studentId, studentId), eq(enrollments.courseId, courseId)))
      .limit(1);
    if (existing && (existing.status === "pending" || existing.status === "active")) return { ok: true as const, enrollment: existing };

    const free = course.access === "free";
    const values = free
      ? await placeIn(tx, course, { batchId, roll: null, fee: 0 }, existing)
      : { status: "pending" as const, batchId, decidedAt: null };
    const note = (request.note ?? "").slice(0, 500);
    const [enrollment] = existing
      ? await tx
          .update(enrollments)
          .set({ ...values, note, decisionNote: "" })
          .where(eq(enrollments.id, existing.id))
          .returning()
      : await tx
          .insert(enrollments)
          .values({ ...values, teacherId, studentId, courseId, note, source: "online" })
          .returning();
    return { ok: true as const, enrollment };
  });
}

/**
 * The teacher puts a student into a course themselves (an offline student, or anyone on their
 * list): in at once, with the batch, roll and fee given. An existing enrolment is brought up to it.
 */
export async function enrollStudent(db: Database, teacherId: string, studentId: string, courseId: string, placement: PlacementInput): Promise<EnrollResult> {
  const course = await ownCourse(db, teacherId, courseId);
  if (!course) return { ok: false, reason: "course" };
  if (!(await ownStudent(db, teacherId, studentId))) return { ok: false, reason: "student" };
  if (!(await batchFits(db, teacherId, courseId, placement.batchId))) return { ok: false, reason: "batch" };
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(enrollments)
        .where(and(eq(enrollments.studentId, studentId), eq(enrollments.courseId, courseId)))
        .limit(1);
      const values = await placeIn(tx, course, placement, existing);
      const [enrollment] = existing
        ? await tx.update(enrollments).set(values).where(eq(enrollments.id, existing.id)).returning()
        : await tx
            .insert(enrollments)
            .values({ ...values, teacherId, studentId, courseId, source: "offline" })
            .returning();
      return { ok: true as const, enrollment };
    });
  } catch (error) {
    if (uniqueViolation(error) !== null) return { ok: false, reason: "rollTaken" };
    throw error;
  }
}

export async function getEnrollment(db: Database, teacherId: string, enrollmentId: string): Promise<Enrollment | null> {
  if (!isUuid(enrollmentId)) return null;
  const [row] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.teacherId, teacherId)))
    .limit(1);
  return row ?? null;
}

/**
 * Lets a student who asked into the course, or changes the place of one already in it: the batch,
 * the roll (the next free one unless given) and the fee (the course's price unless given).
 */
export async function approveEnrollment(db: Database, teacherId: string, enrollmentId: string, placement: PlacementInput): Promise<EnrollResult> {
  const current = await getEnrollment(db, teacherId, enrollmentId);
  if (!current) return { ok: false, reason: "missing" };
  const course = await ownCourse(db, teacherId, current.courseId);
  if (!course) return { ok: false, reason: "course" };
  if (!(await batchFits(db, teacherId, current.courseId, placement.batchId))) return { ok: false, reason: "batch" };
  try {
    return await db.transaction(async (tx) => {
      const values = await placeIn(tx, course, placement, current);
      const [enrollment] = await tx
        .update(enrollments)
        .set({ ...values, decisionNote: "" })
        .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.teacherId, teacherId)))
        .returning();
      return { ok: true as const, enrollment };
    });
  } catch (error) {
    if (uniqueViolation(error) !== null) return { ok: false, reason: "rollTaken" };
    throw error;
  }
}

/** Turns a request down (with a word why), or marks a student as having left the course. Their roll is freed. */
export async function closeEnrollment(
  db: Database,
  teacherId: string,
  enrollmentId: string,
  status: "rejected" | "left",
  note = "",
): Promise<Enrollment | null> {
  if (!isUuid(enrollmentId)) return null;
  const [row] = await db
    .update(enrollments)
    .set({ status, decisionNote: note.slice(0, 300), roll: null, decidedAt: new Date() })
    .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.teacherId, teacherId)))
    .returning();
  return row ?? null;
}

export type EnrollmentFilters = { status?: EnrollmentStatus; courseId?: string; batchId?: string; studentId?: string };

/** The teacher's enrolments with their names: requests oldest first, the rest by course, then roll. */
export async function listEnrollments(db: Database, teacherId: string, filters: EnrollmentFilters = {}): Promise<EnrollmentRow[]> {
  const conditions: SQL[] = [eq(enrollments.teacherId, teacherId)];
  if (filters.status) conditions.push(eq(enrollments.status, filters.status));
  for (const [column, id] of [
    [enrollments.courseId, filters.courseId],
    [enrollments.batchId, filters.batchId],
    [enrollments.studentId, filters.studentId],
  ] as const) {
    if (id === undefined) continue;
    if (!isUuid(id)) return [];
    conditions.push(eq(column, id));
  }
  const found = await rows(db, and(...conditions)).orderBy(
    ...(filters.status === "pending" ? [asc(enrollments.createdAt)] : [asc(courses.position), asc(enrollments.roll), desc(enrollments.createdAt)]),
  );
  const list = found.map(flat);
  // Rolls are text; within a course, order them as the numbers they are.
  if (filters.status !== "pending") {
    list.sort((a, b) => (a.courseId === b.courseId ? Number(a.roll ?? Infinity) - Number(b.roll ?? Infinity) : 0));
  }
  return list;
}

/** How many requests are waiting for the teacher. */
export async function countPendingEnrollments(db: Database, teacherId: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(enrollments)
    .where(and(eq(enrollments.teacherId, teacherId), eq(enrollments.status, "pending")));
  return Number(total);
}

/** A student's enrolment in one course, if any: what the course page shows them. */
export async function findEnrollment(db: Database, teacherId: string, studentId: string, courseId: string): Promise<Enrollment | null> {
  if (!isUuid(studentId) || !isUuid(courseId)) return null;
  const [row] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.teacherId, teacherId), eq(enrollments.studentId, studentId), eq(enrollments.courseId, courseId)))
    .limit(1);
  return row ?? null;
}

/** Takes a student out of a course altogether (the record goes; "left" keeps it). */
export async function deleteEnrollment(db: Database, teacherId: string, enrollmentId: string): Promise<boolean> {
  if (!isUuid(enrollmentId)) return false;
  const gone = await db
    .delete(enrollments)
    .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.teacherId, teacherId)))
    .returning({ id: enrollments.id });
  return gone.length > 0;
}
