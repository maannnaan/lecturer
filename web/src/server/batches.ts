import { and, asc, count, eq, sql } from "drizzle-orm";
import { isUuid } from "@/lib/ids";
import type { BatchInput } from "@/lib/students";
import { type Database, uniqueViolation } from "@/server/db";
import { batches, courses, enrollments } from "@/server/db/schema";

// A course's batches. Like everything else, each function takes the teacher's id and filters on
// it: another teacher's course or batch simply isn't found.

export type Batch = typeof batches.$inferSelect;
/** A batch with its course's title and how many students are in it now. */
export type BatchWithCount = Batch & { courseTitle: string; students: number };

/** A course already has a batch with this name. */
export class BatchNameTaken extends Error {}

const order = [asc(courses.position), asc(batches.position), asc(batches.createdAt)];

/** The teacher's batches, course by course in the courses' order, each with its count of active students. */
export async function listBatches(db: Database, teacherId: string, courseId?: string): Promise<BatchWithCount[]> {
  const conditions = [eq(batches.teacherId, teacherId)];
  if (courseId) {
    if (!isUuid(courseId)) return [];
    conditions.push(eq(batches.courseId, courseId));
  }
  const [rows, counts] = await Promise.all([
    db
      .select({ batch: batches, courseTitle: courses.title })
      .from(batches)
      .innerJoin(courses, eq(courses.id, batches.courseId))
      .where(and(...conditions))
      .orderBy(...order),
    db
      .select({ batchId: enrollments.batchId, n: count() })
      .from(enrollments)
      .where(and(eq(enrollments.teacherId, teacherId), eq(enrollments.status, "active")))
      .groupBy(enrollments.batchId),
  ]);
  const inBatch = new Map(counts.map((row) => [row.batchId, Number(row.n)]));
  return rows.map((row) => ({ ...row.batch, courseTitle: row.courseTitle, students: inBatch.get(row.batch.id) ?? 0 }));
}

/** The batches of a course a student can ask to join: open, and with room left. */
export async function listOpenBatches(db: Database, teacherId: string, courseId: string): Promise<BatchWithCount[]> {
  const all = await listBatches(db, teacherId, courseId);
  return all.filter((batch) => batch.open && (batch.capacity === null || batch.students < batch.capacity));
}

export async function getBatch(db: Database, teacherId: string, batchId: string): Promise<Batch | null> {
  if (!isUuid(batchId)) return null;
  const [row] = await db
    .select()
    .from(batches)
    .where(and(eq(batches.id, batchId), eq(batches.teacherId, teacherId)))
    .limit(1);
  return row ?? null;
}

/** Adds a batch at the end of its course's list. Null when the course isn't this teacher's; throws BatchNameTaken. */
export async function createBatch(db: Database, teacherId: string, courseId: string, input: BatchInput): Promise<Batch | null> {
  if (!isUuid(courseId)) return null;
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.teacherId, teacherId)))
    .limit(1);
  if (!course) return null;
  try {
    const [{ last }] = await db
      .select({ last: sql<number>`coalesce(max(${batches.position}), -1)` })
      .from(batches)
      .where(eq(batches.courseId, courseId));
    const [row] = await db
      .insert(batches)
      .values({ ...input, teacherId, courseId, position: Number(last) + 1 })
      .returning();
    return row;
  } catch (error) {
    if (uniqueViolation(error) !== null) throw new BatchNameTaken();
    throw error;
  }
}

/** Changes a batch. Null when it isn't this teacher's; throws BatchNameTaken. */
export async function updateBatch(db: Database, teacherId: string, batchId: string, input: BatchInput): Promise<Batch | null> {
  if (!isUuid(batchId)) return null;
  try {
    const [row] = await db
      .update(batches)
      .set(input)
      .where(and(eq(batches.id, batchId), eq(batches.teacherId, teacherId)))
      .returning();
    return row ?? null;
  } catch (error) {
    if (uniqueViolation(error) !== null) throw new BatchNameTaken();
    throw error;
  }
}

/** Deletes a batch; its students stay in the course, in no batch. */
export async function deleteBatch(db: Database, teacherId: string, batchId: string): Promise<boolean> {
  if (!isUuid(batchId)) return false;
  const gone = await db
    .delete(batches)
    .where(and(eq(batches.id, batchId), eq(batches.teacherId, teacherId)))
    .returning({ id: batches.id });
  return gone.length > 0;
}
