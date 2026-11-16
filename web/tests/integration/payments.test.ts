import { beforeAll, describe, expect, it } from "vitest";
import { parseCourse } from "@/lib/courses";
import { ONCE, nextMonth } from "@/lib/dues";
import { dhakaMonth } from "@/lib/students";
import { createCourse, updateCourse } from "@/server/courses";
import type { Database } from "@/server/db";
import { closeEnrollment, enrollStudent } from "@/server/enrollments";
import {
  cancelPayment,
  claimPayment,
  collectedByMonth,
  countPendingPayments,
  getPayment,
  listDues,
  listPayments,
  recordPayment,
  verifyPayment,
} from "@/server/payments";
import { createStudent } from "@/server/students";
import type { Teacher } from "@/server/teachers";
import { freshDb, makeTeacher } from "../helpers/db";

let db: Database;
let stranger: Teacher;
let phones = 0;
const phone = () => `0180${String(1000000 + ++phones).slice(-7)}`;
const NOW = dhakaMonth();
const INFO = { bkash: "01700000000" };

/** A teacher with one student in a course of the given kind, for `fee` taka, started this month. */
async function place(period: "monthly" | "one_time" = "monthly", fee = 1200) {
  const t = await makeTeacher(db);
  const { course: input } = parseCourse({ title: "কোর্স", access: "paid", price: String(fee), pricePeriod: period });
  const created = await createCourse(db, t.id, input);
  const course = (await updateCourse(db, t.id, created.id, { ...input, published: true }))!;
  const student = await createStudent(db, { teacherId: t.id, name: "রাহিম", phone: phone(), password: "secret1" });
  const enrolled = await enrollStudent(db, t.id, student.id, course.id, { batchId: null, roll: null, fee: null });
  if (!enrolled.ok) throw new Error("not enrolled");
  return { t, course, student, enrollment: enrolled.enrollment };
}

const cash = (enrollmentId: string | null, periods: string[], amount: number) => ({
  enrollmentId,
  periods,
  amount,
  method: "cash" as const,
  txnId: "",
  senderNumber: "",
  note: "",
  paidOn: "",
});

beforeAll(async () => {
  db = await freshDb();
  stranger = await makeTeacher(db);
});

describe("payments the teacher records", () => {
  it("are verified at once, numbered in turn, and clear the months they cover", async () => {
    const { t, student, enrollment } = await place();
    expect((await listDues(db, t.id))[0]).toMatchObject({ periods: [NOW], amount: 1200, fee: 1200, period: "monthly" });

    const first = await recordPayment(db, t.id, student.id, cash(enrollment.id, [NOW], 1200));
    expect(first.ok && first.payment).toMatchObject({ status: "verified", receiptNo: 1, amount: 1200, kind: "monthly", recordedBy: "teacher" });
    expect(await listDues(db, t.id)).toEqual([]);
    // The same month can't be paid for twice; the receipt number isn't burnt by the refusal.
    expect(await recordPayment(db, t.id, student.id, cash(enrollment.id, [NOW], 1200))).toEqual({ ok: false, reason: "periodsTaken" });
    // In advance, and a payment for something else altogether.
    const ahead = await recordPayment(db, t.id, student.id, cash(enrollment.id, [nextMonth(NOW)], 1000));
    const other = await recordPayment(db, t.id, student.id, cash(null, [], 300));
    expect([ahead.ok && ahead.payment.receiptNo, other.ok && other.payment.receiptNo]).toEqual([2, 3]);
    expect(other.ok && other.payment.kind).toBe("other");

    const list = await listPayments(db, t.id);
    expect(list).toHaveLength(3);
    expect(list.find((p) => p.receiptNo === 1)).toMatchObject({ studentName: "রাহিম", courseTitle: "কোর্স", periods: [NOW] });
    expect((await collectedByMonth(db, t.id, [NOW])).get(NOW)).toBe(2500);
  });

  it("must fit the course: months for a monthly one, the one payment for one paid in one go", async () => {
    const monthly = await place("monthly");
    expect(await recordPayment(db, monthly.t.id, monthly.student.id, cash(monthly.enrollment.id, [ONCE], 1200))).toEqual({ ok: false, reason: "periods" });
    expect(await recordPayment(db, monthly.t.id, monthly.student.id, cash(monthly.enrollment.id, [], 1200))).toEqual({ ok: false, reason: "periods" });
    expect(await recordPayment(db, monthly.t.id, monthly.student.id, cash(null, [NOW], 1200))).toEqual({ ok: false, reason: "periods" });

    const once = await place("one_time", 5000);
    expect((await listDues(db, once.t.id))[0]).toMatchObject({ periods: [ONCE], amount: 5000, payable: [ONCE] });
    expect(await recordPayment(db, once.t.id, once.student.id, cash(once.enrollment.id, [NOW], 5000))).toEqual({ ok: false, reason: "periods" });
    const paid = await recordPayment(db, once.t.id, once.student.id, cash(once.enrollment.id, [ONCE], 5000));
    expect(paid.ok && paid.payment.kind).toBe("one_time");
    expect(await listDues(db, once.t.id)).toEqual([]);
  });

  it("can be cancelled, which makes the months owed again", async () => {
    const { t, student, enrollment } = await place();
    const paid = await recordPayment(db, t.id, student.id, cash(enrollment.id, [NOW], 1200));
    if (!paid.ok) throw new Error("not paid");
    expect((await cancelPayment(db, t.id, paid.payment.id, "ভুল এন্ট্রি"))?.status).toBe("rejected");
    expect((await listDues(db, t.id))[0].periods).toEqual([NOW]);
    expect((await collectedByMonth(db, t.id, [NOW])).get(NOW)).toBe(0);
    // Cancelled once; and paid again, with a new receipt number.
    expect(await cancelPayment(db, t.id, paid.payment.id)).toBeNull();
    const again = await recordPayment(db, t.id, student.id, cash(enrollment.id, [NOW], 1200));
    expect(again.ok && again.payment.receiptNo).toBe(2);
  });
});

describe("a student's claim", () => {
  const claim = (enrollmentId: string, periods: string[], txnId = "TXN12345") => ({ enrollmentId, periods, method: "bkash" as const, txnId, senderNumber: "01712345678" });

  it("waits for the teacher, for the fee times the months, and holds those months meanwhile", async () => {
    const { t, student, enrollment } = await place();
    const made = await claimPayment(db, t.id, student.id, claim(enrollment.id, [NOW, nextMonth(NOW)]), INFO);
    expect(made.ok && made.payment).toMatchObject({ status: "pending", amount: 2400, method: "bkash", txnId: "TXN12345", recordedBy: "student", receiptNo: null });
    expect(await countPendingPayments(db, t.id)).toBe(1);
    // Not asked for again while it waits, and not yet counted as collected.
    expect(await listDues(db, t.id)).toEqual([]);
    expect((await collectedByMonth(db, t.id, [NOW])).get(NOW)).toBe(0);

    const verified = await verifyPayment(db, t.id, made.ok ? made.payment.id : "");
    expect(verified).toMatchObject({ status: "verified", receiptNo: 1 });
    expect(verified?.verifiedAt).toBeInstanceOf(Date);
    // Verified once only.
    expect(await verifyPayment(db, t.id, verified!.id)).toBeNull();
    expect(await countPendingPayments(db, t.id)).toBe(0);
    expect((await collectedByMonth(db, t.id, [NOW])).get(NOW)).toBe(2400);
  });

  it("is refused for a month already covered, a transaction id already used, or a way the teacher hasn't set up", async () => {
    const { t, student, enrollment } = await place();
    expect(await claimPayment(db, t.id, student.id, { ...claim(enrollment.id, [NOW]), method: "nagad" }, INFO)).toEqual({ ok: false, reason: "method" });
    // A month before the student started, or far ahead, isn't theirs to pay.
    expect(await claimPayment(db, t.id, student.id, claim(enrollment.id, ["2020-01"]), INFO)).toEqual({ ok: false, reason: "periods" });
    expect(await claimPayment(db, t.id, student.id, claim(enrollment.id, []), INFO)).toEqual({ ok: false, reason: "periods" });

    const first = await claimPayment(db, t.id, student.id, claim(enrollment.id, [NOW]), INFO);
    expect(first.ok).toBe(true);
    expect(await claimPayment(db, t.id, student.id, claim(enrollment.id, [NOW], "OTHER999"), INFO)).toEqual({ ok: false, reason: "periods" });
    expect(await claimPayment(db, t.id, student.id, claim(enrollment.id, [nextMonth(NOW)]), INFO)).toEqual({ ok: false, reason: "txnTaken" });

    // Rejected, with why: the month is owed again and the transaction id can be claimed afresh.
    const rejected = await cancelPayment(db, t.id, first.ok ? first.payment.id : "", "টাকা আসেনি");
    expect(rejected).toMatchObject({ status: "rejected", note: "টাকা আসেনি", receiptNo: null });
    expect((await listDues(db, t.id))[0].periods).toEqual([NOW]);
    expect((await claimPayment(db, t.id, student.id, claim(enrollment.id, [NOW]), INFO)).ok).toBe(true);
  });

  it("is only ever for the student's own place, in a course they are in now", async () => {
    const mine = await place();
    const other = await createStudent(db, { teacherId: mine.t.id, name: "অন্য", phone: phone(), password: "secret1" });
    // Another student of the same teacher can't pay into (or probe) this place.
    expect(await claimPayment(db, mine.t.id, other.id, claim(mine.enrollment.id, [NOW]), INFO)).toEqual({ ok: false, reason: "enrollment" });
    expect(await recordPayment(db, mine.t.id, other.id, cash(mine.enrollment.id, [NOW], 1200))).toEqual({ ok: false, reason: "enrollment" });
    // Nor can another teacher touch any of it.
    expect(await recordPayment(db, stranger.id, mine.student.id, cash(null, [], 100))).toEqual({ ok: false, reason: "student" });
    const paid = await recordPayment(db, mine.t.id, mine.student.id, cash(mine.enrollment.id, [NOW], 1200));
    if (!paid.ok) throw new Error("not paid");
    expect(await getPayment(db, stranger.id, paid.payment.id)).toBeNull();
    expect(await cancelPayment(db, stranger.id, paid.payment.id)).toBeNull();
    expect(await listPayments(db, stranger.id)).toEqual([]);
    expect(await listDues(db, stranger.id)).toEqual([]);
    // A receipt opens for its own student only.
    expect((await getPayment(db, mine.t.id, paid.payment.id, mine.student.id))?.receiptNo).toBe(1);
    expect(await getPayment(db, mine.t.id, paid.payment.id, other.id)).toBeNull();

    // Having left the course, there is nothing to claim for and nothing owed.
    const gone = await place();
    await closeEnrollment(db, gone.t.id, gone.enrollment.id, "left");
    expect(await claimPayment(db, gone.t.id, gone.student.id, claim(gone.enrollment.id, [NOW]), INFO)).toEqual({ ok: false, reason: "enrollment" });
    expect(await listDues(db, gone.t.id)).toEqual([]);
  });
});
