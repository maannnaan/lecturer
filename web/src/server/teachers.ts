import { count, desc, eq, getTableColumns } from "drizzle-orm";
import { type Database, uniqueViolation } from "@/server/db";
import { handles, teachers } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";
import { normalizePhone } from "@/lib/phone";
import type { ThemeName } from "@/lib/themes";

/** Days of free use that start when an account is first approved. */
export const TRIAL_DAYS = 14;

/** Whole days of trial left (a part day counts as a day), 0 once it's over, null if it never started. */
export function trialDaysLeft(trialEndsAt: Date | null, now: Date = new Date()): number | null {
  if (!trialEndsAt) return null;
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86_400_000));
}

type TeacherRow = typeof teachers.$inferSelect;
export type Teacher = Omit<TeacherRow, "passwordHash">;
export type TeacherStatus = TeacherRow["status"];
export const TEACHER_STATUSES: readonly TeacherStatus[] = ["pending", "approved", "suspended", "rejected"];

// Every column but the password hash: what leaves this module about a teacher.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { passwordHash: _passwordHash, ...teacherColumns } = getTableColumns(teachers);

/** A sign-up or handle change that collided with an existing account. */
export class TakenError extends Error {
  constructor(readonly field: "handle" | "phone" | "email") {
    super(`${field} is already taken`);
  }
}

const TAKEN_BY_CONSTRAINT: Record<string, TakenError["field"]> = {
  teachers_handle_key: "handle",
  handles_pkey: "handle",
  teachers_phone_key: "phone",
  teachers_email_key: "email",
};

function takenFrom(err: unknown): TakenError | null {
  const constraint = uniqueViolation(err);
  const field = constraint === null ? undefined : TAKEN_BY_CONSTRAINT[constraint];
  return field ? new TakenError(field) : null;
}

export type NewTeacher = {
  nameBn: string;
  nameEn: string;
  /** Already normalised (01XXXXXXXXX). */
  phone: string;
  /** Lower-cased, or null. */
  email: string | null;
  /** Already normalised and checked against the reserved list. */
  handle: string;
  subjects: string;
  institution: string;
  password: string;
};

/** True when `handle` belongs, or once belonged, to some teacher. */
export async function handleTaken(db: Database, handle: string): Promise<boolean> {
  const [row] = await db.select({ handle: handles.handle }).from(handles).where(eq(handles.handle, handle)).limit(1);
  return Boolean(row);
}

/**
 * Creates a pending teacher account. Throws TakenError for a handle, phone or email that is in use.
 * The checks up front give a clear answer in the usual case; the unique indexes settle a race
 * between two sign-ups for the same thing.
 */
export async function registerTeacher(db: Database, input: NewTeacher): Promise<Teacher> {
  if (await handleTaken(db, input.handle)) throw new TakenError("handle");
  const [samePhone] = await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.phone, input.phone)).limit(1);
  if (samePhone) throw new TakenError("phone");
  if (input.email) {
    const [sameEmail] = await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.email, input.email)).limit(1);
    if (sameEmail) throw new TakenError("email");
  }

  const passwordHash = await hashPassword(input.password);
  try {
    return await db.transaction(async (tx) => {
      const [teacher] = await tx
        .insert(teachers)
        .values({
          handle: input.handle,
          nameBn: input.nameBn,
          nameEn: input.nameEn,
          phone: input.phone,
          email: input.email,
          passwordHash,
          subjects: input.subjects,
          institution: input.institution,
        })
        .returning(teacherColumns);
      await tx.insert(handles).values({ handle: teacher.handle, teacherId: teacher.id });
      return teacher;
    });
  } catch (err) {
    throw takenFrom(err) ?? err;
  }
}

export async function findTeacherById(db: Database, id: string): Promise<Teacher | null> {
  const [row] = await db.select(teacherColumns).from(teachers).where(eq(teachers.id, id)).limit(1);
  return row ?? null;
}

/** The account a sign-in form names, by mobile number (any common spelling) or email. Includes the hash. */
export async function findTeacherForLogin(db: Database, identifier: string): Promise<TeacherRow | null> {
  const phone = normalizePhone(identifier);
  const where = phone ? eq(teachers.phone, phone) : eq(teachers.email, identifier.trim().toLowerCase());
  const [row] = await db.select().from(teachers).where(where).limit(1);
  return row ?? null;
}

/**
 * Whose website lecturer.bd/<handle> is. `current` is false for a handle the teacher has since
 * changed away from; such an address should redirect to the teacher's present one.
 */
export async function resolveHandle(
  db: Database,
  handle: string,
): Promise<{ teacher: Teacher; current: boolean } | null> {
  const [row] = await db
    .select({ current: handles.current, teacher: teacherColumns })
    .from(handles)
    .innerJoin(teachers, eq(teachers.id, handles.teacherId))
    .where(eq(handles.handle, handle))
    .limit(1);
  return row ?? null;
}

/** Just enough about lecturer.bd/<handle> for the request proxy to answer 404 or 308 before rendering. */
export async function lookupHandle(
  db: Database,
  handle: string,
): Promise<{ teacherId: string; current: boolean; currentHandle: string; status: TeacherStatus } | null> {
  const [row] = await db
    .select({
      teacherId: teachers.id,
      current: handles.current,
      currentHandle: teachers.handle,
      status: teachers.status,
    })
    .from(handles)
    .innerJoin(teachers, eq(teachers.id, handles.teacherId))
    .where(eq(handles.handle, handle))
    .limit(1);
  return row ?? null;
}

export async function listTeachers(db: Database, status?: TeacherStatus): Promise<Teacher[]> {
  return db
    .select(teacherColumns)
    .from(teachers)
    .where(status ? eq(teachers.status, status) : undefined)
    .orderBy(desc(teachers.createdAt));
}

export async function countTeachersByStatus(db: Database): Promise<Record<TeacherStatus, number>> {
  const rows = await db.select({ status: teachers.status, n: count() }).from(teachers).groupBy(teachers.status);
  const counts = { pending: 0, approved: 0, suspended: 0, rejected: 0 };
  for (const row of rows) counts[row.status] = row.n;
  return counts;
}

/**
 * An admin's decision on an account. The first approval stamps approvedAt and starts the free
 * trial; later approvals (say, after a suspension) leave both alone. The note is the reason the
 * teacher is shown for a rejection or suspension, and is cleared on approval.
 */
export async function setTeacherStatus(
  db: Database,
  id: string,
  status: TeacherStatus,
  note = "",
): Promise<Teacher | null> {
  const [before] = await db
    .select({ approvedAt: teachers.approvedAt, trialEndsAt: teachers.trialEndsAt })
    .from(teachers)
    .where(eq(teachers.id, id))
    .limit(1);
  if (!before) return null;

  const now = new Date();
  const patch: Partial<TeacherRow> = { status, statusNote: status === "approved" ? "" : note.trim() };
  if (status === "approved") {
    patch.approvedAt = before.approvedAt ?? now;
    patch.trialEndsAt = before.trialEndsAt ?? new Date(now.getTime() + TRIAL_DAYS * 86_400_000);
  }
  const [row] = await db.update(teachers).set(patch).where(eq(teachers.id, id)).returning(teacherColumns);
  return row ?? null;
}

export async function setTeacherTheme(db: Database, id: string, theme: ThemeName): Promise<void> {
  await db.update(teachers).set({ theme }).where(eq(teachers.id, id));
}

/**
 * Moves a teacher to a new handle. Their old handles stay registered to them, so old links keep
 * working (as redirects) and nobody else can take those addresses. Moving back to one of their
 * own old handles is allowed. Throws TakenError when another teacher has, or had, the handle.
 */
export async function changeHandle(db: Database, teacherId: string, newHandle: string): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(handles).where(eq(handles.handle, newHandle)).limit(1);
      if (existing && existing.teacherId !== teacherId) throw new TakenError("handle");
      await tx.update(handles).set({ current: false }).where(eq(handles.teacherId, teacherId));
      if (existing) {
        await tx.update(handles).set({ current: true }).where(eq(handles.handle, newHandle));
      } else {
        await tx.insert(handles).values({ handle: newHandle, teacherId });
      }
      await tx.update(teachers).set({ handle: newHandle }).where(eq(teachers.id, teacherId));
    });
  } catch (err) {
    if (err instanceof TakenError) throw err;
    throw takenFrom(err) ?? err;
  }
}
