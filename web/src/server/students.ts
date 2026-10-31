import { and, eq } from "drizzle-orm";
import type { Database } from "@/server/db";
import { students } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";

export type Student = Omit<typeof students.$inferSelect, "passwordHash">;

const studentColumns = {
  id: students.id,
  teacherId: students.teacherId,
  name: students.name,
  phone: students.phone,
  createdAt: students.createdAt,
};

/** Adds a student to one teacher's list. Sign-up, rolls and batches arrive in Phase 4. */
export async function createStudent(
  db: Database,
  input: { teacherId: string; name: string; phone: string; password?: string },
): Promise<Student> {
  const [row] = await db
    .insert(students)
    .values({
      teacherId: input.teacherId,
      name: input.name,
      phone: input.phone,
      passwordHash: input.password ? await hashPassword(input.password) : null,
    })
    .returning(studentColumns);
  return row;
}

/** A student of this teacher. Another teacher's student is, by design, not found. */
export async function findStudent(db: Database, teacherId: string, studentId: string): Promise<Student | null> {
  const [row] = await db
    .select(studentColumns)
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.teacherId, teacherId)))
    .limit(1);
  return row ?? null;
}
