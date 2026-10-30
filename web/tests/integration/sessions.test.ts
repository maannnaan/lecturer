import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createSession, revokeSession, validateSession } from "@/server/auth/session";
import { hashToken } from "@/server/auth/tokens";
import { upsertAdmin } from "@/server/admins";
import type { Database } from "@/server/db";
import { sessions, teachers } from "@/server/db/schema";
import { createStudent } from "@/server/students";
import { freshDb, makeTeacher } from "../helpers/db";

let db: Database;
beforeAll(async () => {
  db = await freshDb();
});

describe("sessions", () => {
  it("validate only as the kind of account that started them", async () => {
    const teacher = await makeTeacher(db);
    const token = await createSession(db, { kind: "teacher", teacherId: teacher.id }, "test-agent");
    expect(await validateSession(db, token, { kind: "teacher" })).toMatchObject({ teacherId: teacher.id });
    expect(await validateSession(db, token, { kind: "admin" })).toBeNull();
    expect(await validateSession(db, undefined, { kind: "teacher" })).toBeNull();
    expect(await validateSession(db, "made-up-token", { kind: "teacher" })).toBeNull();
  });

  it("store only a hash of the cookie token", async () => {
    const admin = await upsertAdmin(db, { name: "A", email: "Admin@Example.com", password: "long enough pw" });
    const token = await createSession(db, { kind: "admin", adminId: admin.id });
    const rows = await db.select().from(sessions).where(eq(sessions.adminId, admin.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(hashToken(token));
    expect(rows[0].id).not.toBe(token);
  });

  it("are refused, and removed, once expired", async () => {
    const teacher = await makeTeacher(db);
    const token = await createSession(db, { kind: "teacher", teacherId: teacher.id });
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.id, hashToken(token)));
    expect(await validateSession(db, token, { kind: "teacher" })).toBeNull();
    expect(await db.select().from(sessions).where(eq(sessions.id, hashToken(token)))).toHaveLength(0);
  });

  it("are extended while in use, at most once a day", async () => {
    const teacher = await makeTeacher(db);
    const token = await createSession(db, { kind: "teacher", teacherId: teacher.id });
    const id = hashToken(token);
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
    const soon = new Date(Date.now() + 3 * 86_400_000);
    await db.update(sessions).set({ lastSeenAt: twoDaysAgo, expiresAt: soon }).where(eq(sessions.id, id));

    const used = await validateSession(db, token, { kind: "teacher" });
    expect(used!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    const [stored] = await db.select().from(sessions).where(eq(sessions.id, id));
    expect(stored.lastSeenAt.getTime()).toBeGreaterThan(twoDaysAgo.getTime());
  });

  it("are gone after sign-out", async () => {
    const teacher = await makeTeacher(db);
    const token = await createSession(db, { kind: "teacher", teacherId: teacher.id });
    await revokeSession(db, token);
    expect(await validateSession(db, token, { kind: "teacher" })).toBeNull();
  });

  it("end when the account is deleted", async () => {
    const teacher = await makeTeacher(db);
    const token = await createSession(db, { kind: "teacher", teacherId: teacher.id });
    await db.delete(teachers).where(eq(teachers.id, teacher.id));
    expect(await validateSession(db, token, { kind: "teacher" })).toBeNull();
  });
});

describe("student sessions", () => {
  it("only ever work on the site of the teacher the student belongs to", async () => {
    const teacherA = await makeTeacher(db);
    const teacherB = await makeTeacher(db);
    const student = await createStudent(db, { teacherId: teacherA.id, name: "সাদিয়া", phone: "01700000001" });
    const token = await createSession(db, { kind: "student", teacherId: teacherA.id, studentId: student.id });

    expect(await validateSession(db, token, { kind: "student", teacherId: teacherA.id })).toMatchObject({
      studentId: student.id,
    });
    expect(await validateSession(db, token, { kind: "student", teacherId: teacherB.id })).toBeNull();
    expect(await validateSession(db, token, { kind: "teacher" })).toBeNull();
  });

  it("let the same phone number be a student of two teachers, but not twice of one", async () => {
    const teacherA = await makeTeacher(db);
    const teacherB = await makeTeacher(db);
    await createStudent(db, { teacherId: teacherA.id, name: "রাফি", phone: "01700000002" });
    await expect(createStudent(db, { teacherId: teacherB.id, name: "রাফি", phone: "01700000002" })).resolves.toBeTruthy();
    await expect(createStudent(db, { teacherId: teacherA.id, name: "রাফি", phone: "01700000002" })).rejects.toThrow();
  });

  it("can't be stored without the teacher they belong to", async () => {
    const teacher = await makeTeacher(db);
    const student = await createStudent(db, { teacherId: teacher.id, name: "নুসরাত", phone: "01700000003" });
    await expect(
      db.insert(sessions).values({ id: "x", kind: "student", studentId: student.id, expiresAt: new Date() }),
    ).rejects.toThrow();
  });
});
