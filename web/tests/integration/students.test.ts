import { beforeAll, describe, expect, it } from "vitest";
import { parseCourse } from "@/lib/courses";
import { verifyPassword } from "@/server/auth/password";
import { createSession, validateSession } from "@/server/auth/session";
import { BatchNameTaken, createBatch, deleteBatch, listBatches, listOpenBatches, updateBatch } from "@/server/batches";
import { createCourse, updateCourse } from "@/server/courses";
import type { Database } from "@/server/db";
import {
  approveEnrollment,
  closeEnrollment,
  countPendingEnrollments,
  enrollStudent,
  findEnrollment,
  listEnrollments,
  requestEnrollment,
} from "@/server/enrollments";
import {
  StudentPhoneTaken,
  createStudent,
  deleteStudent,
  findStudent,
  findStudentForLogin,
  listStudents,
  setStudentPassword,
  setStudentStatus,
  updateStudent,
} from "@/server/students";
import type { Teacher } from "@/server/teachers";
import { freshDb, makeTeacher } from "../helpers/db";

let db: Database;
let owner: Teacher;
let stranger: Teacher;
let phones = 0;
const phone = () => `0190${String(1000000 + ++phones).slice(-7)}`;

/** A published course of the teacher's, by how students get in. */
async function course(t: Teacher, access: "free" | "approval" | "paid", published = true) {
  const { course: input } = parseCourse({ title: `কোর্স ${access}`, access, price: access === "paid" ? "1500" : "" });
  const created = await createCourse(db, t.id, input);
  return (await updateCourse(db, t.id, created.id, { ...input, published }))!;
}

const place = { batchId: null, roll: null, fee: null };

beforeAll(async () => {
  db = await freshDb();
  owner = await makeTeacher(db);
  stranger = await makeTeacher(db);
});

describe("students", () => {
  it("belong to one teacher: the same number can't be there twice, but can be another teacher's", async () => {
    const number = phone();
    const student = await createStudent(db, { teacherId: owner.id, name: "রাহিম", phone: number, password: "secret1" });
    expect(student).toMatchObject({ source: "online", status: "active", hasLogin: true });
    await expect(createStudent(db, { teacherId: owner.id, name: "অন্য", phone: number })).rejects.toBeInstanceOf(StudentPhoneTaken);
    const elsewhere = await createStudent(db, { teacherId: stranger.id, name: "রাহিম", phone: number });
    expect(elsewhere).toMatchObject({ source: "offline", hasLogin: false });

    // The other teacher can't see, change, or delete this one.
    expect(await findStudent(db, stranger.id, student.id)).toBeNull();
    expect(await updateStudent(db, stranger.id, student.id, { ...student, name: "x" })).toBeNull();
    expect(await setStudentPassword(db, stranger.id, student.id, "hacked1")).toBe(false);
    expect(await deleteStudent(db, stranger.id, student.id)).toBe(false);
    expect((await findStudentForLogin(db, stranger.id, number))?.id).toBe(elsewhere.id);
    // Changing one's number to another student's is refused.
    const other = await createStudent(db, { teacherId: owner.id, name: "করিম", phone: phone() });
    await expect(updateStudent(db, owner.id, other.id, { ...other, phone: number })).rejects.toBeInstanceOf(StudentPhoneTaken);
  });

  it("a new password, or switching the account off, signs the student out", async () => {
    const number = phone();
    const student = await createStudent(db, { teacherId: owner.id, name: "সাদিয়া", phone: number, password: "first-pass" });
    const token = await createSession(db, { kind: "student", teacherId: owner.id, studentId: student.id });
    expect(await validateSession(db, token, { kind: "student", teacherId: owner.id })).not.toBeNull();

    expect(await setStudentPassword(db, owner.id, student.id, "second-pass")).toBe(true);
    expect(await validateSession(db, token, { kind: "student", teacherId: owner.id })).toBeNull();
    const login = (await findStudentForLogin(db, owner.id, number))!;
    expect(await verifyPassword(login.passwordHash!, "second-pass")).toBe(true);
    expect(await verifyPassword(login.passwordHash!, "first-pass")).toBe(false);

    const again = await createSession(db, { kind: "student", teacherId: owner.id, studentId: student.id });
    await setStudentStatus(db, owner.id, student.id, "inactive");
    expect(await validateSession(db, again, { kind: "student", teacherId: owner.id })).toBeNull();
    expect((await findStudentForLogin(db, owner.id, number))?.status).toBe("inactive");
  });

  it("are listed by name, found by name or number, and narrowed by course and how they joined", async () => {
    const t = await makeTeacher(db);
    const c = await course(t, "approval");
    const a = await createStudent(db, { teacherId: t.id, name: "আবির", phone: phone(), password: "secret1" });
    const b = await createStudent(db, { teacherId: t.id, name: "বর্ষা", phone: "01955555555" });
    await enrollStudent(db, t.id, b.id, c.id, place);
    const names = async (filters: Parameters<typeof listStudents>[2]) => (await listStudents(db, t.id, filters)).items.map((s) => s.name);

    expect(await names({})).toEqual(["আবির", "বর্ষা"]);
    expect(await names({ search: "বর্ষ" })).toEqual(["বর্ষা"]);
    expect(await names({ search: "5555" })).toEqual(["বর্ষা"]);
    expect(await names({ search: "100%" })).toEqual([]);
    expect(await names({ courseId: c.id })).toEqual(["বর্ষা"]);
    expect(await names({ source: "online" })).toEqual(["আবির"]);
    expect((await listStudents(db, stranger.id, { search: "আবির" })).total).toBe(0);
    expect(a.source).toBe("online");
  });
});

describe("admission", () => {
  it("a free course lets a student straight in; any other waits for the teacher", async () => {
    const t = await makeTeacher(db);
    const [free, paid] = [await course(t, "free"), await course(t, "paid")];
    const student = await createStudent(db, { teacherId: t.id, name: "রাহিম", phone: phone(), password: "secret1" });

    const joined = await requestEnrollment(db, t.id, student.id, free.id);
    expect(joined.ok && joined.enrollment).toMatchObject({ status: "active", roll: "1", fee: 0, source: "online" });
    const asked = await requestEnrollment(db, t.id, student.id, paid.id, { note: "ভর্তি হতে চাই" });
    expect(asked.ok && asked.enrollment).toMatchObject({ status: "pending", roll: null, note: "ভর্তি হতে চাই" });
    expect(await countPendingEnrollments(db, t.id)).toBe(1);
    // Asking twice changes nothing.
    const twice = await requestEnrollment(db, t.id, student.id, paid.id, { note: "আবার" });
    expect(twice.ok && twice.enrollment.note).toBe("ভর্তি হতে চাই");
    expect(await countPendingEnrollments(db, t.id)).toBe(1);
  });

  it("the teacher admits with a batch, the next roll and the course's fee, or sets them", async () => {
    const t = await makeTeacher(db);
    const paid = await course(t, "paid");
    const batch = (await createBatch(db, t.id, paid.id, { name: "ক", schedule: "", capacity: null, open: true }))!;
    const students = await Promise.all(["এক", "দুই", "তিন"].map((name) => createStudent(db, { teacherId: t.id, name, phone: phone(), password: "secret1" })));
    const requests = [];
    for (const s of students) {
      const r = await requestEnrollment(db, t.id, s.id, paid.id);
      if (r.ok) requests.push(r.enrollment);
    }

    const first = await approveEnrollment(db, t.id, requests[0].id, { batchId: batch.id, roll: null, fee: null });
    expect(first.ok && first.enrollment).toMatchObject({ status: "active", batchId: batch.id, roll: "1", fee: 1500 });
    expect(first.ok && first.enrollment.startMonth).toMatch(/^\d{4}-\d{2}$/);
    const second = await approveEnrollment(db, t.id, requests[1].id, { batchId: null, roll: "25", fee: 1000 });
    expect(second.ok && second.enrollment).toMatchObject({ roll: "25", fee: 1000, batchId: null });
    // A roll someone in the course already has is refused; the request stays as it was.
    expect(await approveEnrollment(db, t.id, requests[2].id, { batchId: null, roll: "25", fee: null })).toEqual({ ok: false, reason: "rollTaken" });
    expect((await findEnrollment(db, t.id, students[2].id, paid.id))?.status).toBe("pending");
    const third = await approveEnrollment(db, t.id, requests[2].id, place);
    expect(third.ok && third.enrollment.roll).toBe("26");

    // Changing a student's place keeps their roll unless a new one is given.
    const moved = await approveEnrollment(db, t.id, requests[0].id, { batchId: null, roll: null, fee: 800 });
    expect(moved.ok && moved.enrollment).toMatchObject({ roll: "1", fee: 800, batchId: null });
    expect((await listEnrollments(db, t.id, { status: "active", courseId: paid.id })).map((e) => e.roll)).toEqual(["1", "25", "26"]);
    expect((await listBatches(db, t.id))[0].students).toBe(0);
  });

  it("a request turned down can be made again; leaving frees the roll", async () => {
    const t = await makeTeacher(db);
    const c = await course(t, "approval");
    const student = await createStudent(db, { teacherId: t.id, name: "নাফিস", phone: phone(), password: "secret1" });
    const asked = await requestEnrollment(db, t.id, student.id, c.id);
    if (!asked.ok) throw new Error("not asked");
    expect((await closeEnrollment(db, t.id, asked.enrollment.id, "rejected", "আসন নেই"))?.decisionNote).toBe("আসন নেই");
    expect(await countPendingEnrollments(db, t.id)).toBe(0);

    const again = await requestEnrollment(db, t.id, student.id, c.id);
    expect(again.ok && again.enrollment).toMatchObject({ id: asked.enrollment.id, status: "pending", decisionNote: "" });
    const admitted = await approveEnrollment(db, t.id, asked.enrollment.id, place);
    expect(admitted.ok && admitted.enrollment.roll).toBe("1");
    expect((await closeEnrollment(db, t.id, asked.enrollment.id, "left"))?.roll).toBeNull();
    // The roll is free for the next student.
    const next = await createStudent(db, { teacherId: t.id, name: "পরের", phone: phone() });
    const enrolled = await enrollStudent(db, t.id, next.id, c.id, place);
    expect(enrolled.ok && enrolled.enrollment).toMatchObject({ roll: "1", status: "active", source: "offline" });
  });

  it("is refused across teachers, for drafts, and for a batch of another course", async () => {
    const t = await makeTeacher(db);
    const [mine, other, draft] = [await course(t, "approval"), await course(t, "approval"), await course(t, "free", false)];
    const theirs = await course(stranger, "free");
    const student = await createStudent(db, { teacherId: t.id, name: "ক", phone: phone(), password: "secret1" });
    const outsider = await createStudent(db, { teacherId: stranger.id, name: "খ", phone: phone(), password: "secret1" });
    const otherBatch = (await createBatch(db, t.id, other.id, { name: "ক", schedule: "", capacity: null, open: true }))!;

    expect(await requestEnrollment(db, t.id, student.id, theirs.id)).toEqual({ ok: false, reason: "course" });
    expect(await requestEnrollment(db, t.id, student.id, draft.id)).toEqual({ ok: false, reason: "course" });
    expect(await requestEnrollment(db, t.id, outsider.id, mine.id)).toEqual({ ok: false, reason: "student" });
    expect(await requestEnrollment(db, t.id, student.id, mine.id, { batchId: otherBatch.id })).toEqual({ ok: false, reason: "batch" });
    // The teacher can enrol into a draft course of their own; never another teacher's student.
    expect((await enrollStudent(db, t.id, student.id, draft.id, place)).ok).toBe(true);
    expect(await enrollStudent(db, t.id, outsider.id, mine.id, place)).toEqual({ ok: false, reason: "student" });

    const asked = await requestEnrollment(db, t.id, student.id, mine.id);
    if (!asked.ok) throw new Error("not asked");
    expect(await approveEnrollment(db, stranger.id, asked.enrollment.id, place)).toEqual({ ok: false, reason: "missing" });
    expect(await closeEnrollment(db, stranger.id, asked.enrollment.id, "rejected")).toBeNull();
    expect(await listEnrollments(db, stranger.id, { courseId: mine.id })).toEqual([]);
  });
});

describe("batches", () => {
  it("are named once per course, count their students, and stop taking them when closed or full", async () => {
    const t = await makeTeacher(db);
    const c = await course(t, "approval");
    const small = (await createBatch(db, t.id, c.id, { name: "ক", schedule: "শনি", capacity: 1, open: true }))!;
    const closed = (await createBatch(db, t.id, c.id, { name: "খ", schedule: "", capacity: null, open: false }))!;
    await expect(createBatch(db, t.id, c.id, { name: "ক", schedule: "", capacity: null, open: true })).rejects.toBeInstanceOf(BatchNameTaken);
    await expect(updateBatch(db, t.id, closed.id, { name: "ক", schedule: "", capacity: null, open: false })).rejects.toBeInstanceOf(BatchNameTaken);
    expect(await createBatch(db, stranger.id, c.id, { name: "গ", schedule: "", capacity: null, open: true })).toBeNull();
    expect(await updateBatch(db, stranger.id, small.id, { name: "x", schedule: "", capacity: null, open: true })).toBeNull();

    expect((await listOpenBatches(db, t.id, c.id)).map((b) => b.name)).toEqual(["ক"]);
    const student = await createStudent(db, { teacherId: t.id, name: "ক", phone: phone() });
    await enrollStudent(db, t.id, student.id, c.id, { batchId: small.id, roll: null, fee: null });
    expect((await listBatches(db, t.id, c.id)).map((b) => [b.name, b.students])).toEqual([
      ["ক", 1],
      ["খ", 0],
    ]);
    // Full now, so no longer offered.
    expect(await listOpenBatches(db, t.id, c.id)).toEqual([]);

    // Deleting a batch leaves its student in the course, in no batch.
    expect(await deleteBatch(db, stranger.id, small.id)).toBe(false);
    expect(await deleteBatch(db, t.id, small.id)).toBe(true);
    expect((await findEnrollment(db, t.id, student.id, c.id))?.batchId).toBeNull();
  });
});
