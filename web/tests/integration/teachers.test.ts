import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/server/db";
import {
  TRIAL_DAYS,
  TakenError,
  changeHandle,
  countTeachersByStatus,
  findTeacherForLogin,
  handleTaken,
  listTeachers,
  resolveHandle,
  setTeacherStatus,
  setTeacherTheme,
  trialDaysLeft,
} from "@/server/teachers";
import { freshDb, makeTeacher } from "../helpers/db";

let db: Database;
beforeAll(async () => {
  db = await freshDb();
});

describe("registration", () => {
  it("creates a pending Ink-themed account whose handle is registered", async () => {
    const t = await makeTeacher(db, { handle: "mr_x", nameBn: "মিস্টার এক্স" });
    expect(t).toMatchObject({ handle: "mr_x", status: "pending", theme: "ink", locale: "bn" });
    expect(t).not.toHaveProperty("passwordHash");
    expect(await handleTaken(db, "mr_x")).toBe(true);
  });

  it("refuses a handle, mobile number or email that is already in use", async () => {
    await makeTeacher(db, { handle: "taken-one", phone: "01811111111", email: "a@b.com" });
    await expect(makeTeacher(db, { handle: "taken-one" })).rejects.toMatchObject({ field: "handle" });
    await expect(makeTeacher(db, { phone: "01811111111" })).rejects.toMatchObject({ field: "phone" });
    await expect(makeTeacher(db, { email: "a@b.com" })).rejects.toMatchObject({ field: "email" });
  });

  it("lets the database settle two sign-ups racing for one handle", async () => {
    const results = await Promise.allSettled([makeTeacher(db, { handle: "race" }), makeTeacher(db, { handle: "race" })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failure = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(failure.reason).toBeInstanceOf(TakenError);
    expect(failure.reason.field).toBe("handle");
  });
});

describe("sign-in lookup", () => {
  it("finds the account by any spelling of the mobile number, or by email in any case", async () => {
    const t = await makeTeacher(db, { phone: "01912345678", email: "tanvir@example.com" });
    for (const id of ["01912345678", "+8801912345678", "০১৯১২৩৪৫৬৭৮", "Tanvir@Example.com "]) {
      expect((await findTeacherForLogin(db, id))?.id, id).toBe(t.id);
    }
    expect(await findTeacherForLogin(db, "01999999999")).toBeNull();
  });
});

describe("admin decisions", () => {
  it("starts the trial on first approval and keeps it through a suspension", async () => {
    const t = await makeTeacher(db);
    const approved = await setTeacherStatus(db, t.id, "approved");
    expect(approved?.approvedAt).toBeInstanceOf(Date);
    const trialDays = (approved!.trialEndsAt!.getTime() - approved!.approvedAt!.getTime()) / 86_400_000;
    expect(Math.round(trialDays)).toBe(TRIAL_DAYS);

    const suspended = await setTeacherStatus(db, t.id, "suspended", "  unpaid  ");
    expect(suspended).toMatchObject({ status: "suspended", statusNote: "unpaid" });

    const again = await setTeacherStatus(db, t.id, "approved");
    expect(again).toMatchObject({ status: "approved", statusNote: "" });
    expect(again?.trialEndsAt?.getTime()).toBe(approved!.trialEndsAt!.getTime());
  });

  it("lists and counts teachers by status", async () => {
    const before = await countTeachersByStatus(db);
    const t = await makeTeacher(db);
    await setTeacherStatus(db, t.id, "rejected", "incomplete details");
    const after = await countTeachersByStatus(db);
    expect(after.rejected).toBe(before.rejected + 1);
    expect((await listTeachers(db, "rejected")).map((x) => x.id)).toContain(t.id);
    expect((await listTeachers(db, "approved")).map((x) => x.id)).not.toContain(t.id);
  });

  it("counts trial days left with a part day as a whole one", () => {
    const now = new Date("2026-11-01T10:00:00Z");
    expect(trialDaysLeft(null, now)).toBeNull();
    expect(trialDaysLeft(new Date("2026-11-15T10:00:00Z"), now)).toBe(14);
    expect(trialDaysLeft(new Date("2026-11-01T11:00:00Z"), now)).toBe(1);
    expect(trialDaysLeft(new Date("2026-10-30T10:00:00Z"), now)).toBe(0);
  });

  it("returns null for an unknown teacher", async () => {
    expect(await setTeacherStatus(db, "00000000-0000-0000-0000-000000000000", "approved")).toBeNull();
  });
});

describe("handles", () => {
  it("keeps an old handle as a redirect that nobody else can take", async () => {
    const t = await makeTeacher(db, { handle: "old-name" });
    await changeHandle(db, t.id, "new-name");
    expect(await resolveHandle(db, "new-name")).toMatchObject({ current: true, teacher: { id: t.id, handle: "new-name" } });
    expect(await resolveHandle(db, "old-name")).toMatchObject({ current: false, teacher: { id: t.id, handle: "new-name" } });

    const other = await makeTeacher(db);
    await expect(changeHandle(db, other.id, "old-name")).rejects.toMatchObject({ field: "handle" });
    await expect(makeTeacher(db, { handle: "old-name" })).rejects.toMatchObject({ field: "handle" });

    // Moving back to one of your own old handles is fine.
    await changeHandle(db, t.id, "old-name");
    expect(await resolveHandle(db, "old-name")).toMatchObject({ current: true });
    expect(await resolveHandle(db, "new-name")).toMatchObject({ current: false });
  });

  it("knows nothing about an address nobody registered", async () => {
    expect(await resolveHandle(db, "nobody-here")).toBeNull();
  });
});

describe("theme", () => {
  it("is stored per teacher", async () => {
    const t = await makeTeacher(db, { handle: "themed" });
    await setTeacherTheme(db, t.id, "sage");
    expect((await resolveHandle(db, "themed"))?.teacher.theme).toBe("sage");
  });
});
