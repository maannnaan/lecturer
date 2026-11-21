import { type SQL, and, asc, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { type FeePlan, ONCE, duesOf, payablePeriods } from "@/lib/dues";
import { isUuid } from "@/lib/ids";
import type { ClaimInput, PaymentInput, PaymentStatus } from "@/lib/payments";
import { dhakaMonth } from "@/lib/students";
import { type Database, uniqueViolation } from "@/server/db";
import { type PaymentInfo, batches, courses, enrollments, paymentMonths, payments, students, teachers } from "@/server/db/schema";
import type { Tx } from "./ordering";

// Money: what students paid, what they say they paid, and what they still owe. Every function
// takes the teacher's id and filters on it; a student's own actions also pass their own id, so one
// student can never pay for, or see, another's.

export type Payment = typeof payments.$inferSelect;
/** A payment with the names a list shows beside it, and the periods it covers. */
export type PaymentRow = Payment & {
  studentName: string;
  studentPhone: string;
  courseTitle: string | null;
  batchName: string | null;
  periods: string[];
};

export type PayResult =
  | { ok: true; payment: Payment }
  | { ok: false; reason: "student" | "enrollment" | "periods" | "periodsTaken" | "txnTaken" | "method" };

/** An enrolment of this teacher's, with how its course is paid for. */
export async function feePlan(db: Database | Tx, teacherId: string, enrollmentId: string) {
  if (!isUuid(enrollmentId)) return null;
  const [row] = await db
    .select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      status: enrollments.status,
      fee: enrollments.fee,
      startMonth: enrollments.startMonth,
      period: courses.pricePeriod,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.teacherId, teacherId)))
    .limit(1);
  return row ?? null;
}

/** The periods of an enrolment some payment already covers (a rejected payment's are freed as it is rejected). */
export async function coveredPeriods(db: Database | Tx, enrollmentId: string): Promise<string[]> {
  const rows = await db.select({ month: paymentMonths.month }).from(paymentMonths).where(eq(paymentMonths.enrollmentId, enrollmentId));
  return rows.map((row) => row.month);
}

/** The next receipt number of the teacher's; never handed out twice. */
export async function nextReceipt(tx: Tx, teacherId: string): Promise<number> {
  const [{ receiptNo }] = await tx
    .update(teachers)
    .set({ receiptCounter: sql`${teachers.receiptCounter} + 1` })
    .where(eq(teachers.id, teacherId))
    .returning({ receiptNo: teachers.receiptCounter });
  return receiptNo;
}

/**
 * A bKash gateway payment still on its way: the student is at bKash's page, or back and being
 * confirmed. Not a claim for the teacher to check; it settles itself (see src/server/gateway.ts).
 */
const inFlight = sql`(${payments.method} = 'bkash_gateway' and ${payments.gatewayState} in ('', 'checking'))`;

/** A pending payment the teacher has to decide on: a student's claim, or a bKash payment bKash didn't confirm. */
const awaitingTeacher = and(eq(payments.status, "pending"), sql`not ${inFlight}`)!;

/** How long a bKash payment may stay on its way before it is given up (or, once back, handed to the teacher). */
export const GATEWAY_PATIENCE_MS = 60 * 60_000;

/**
 * Gateway payments of the teacher's that never came back from bKash: failed, and their periods
 * owed again. Nothing was taken for them: money moves only when bKash's payment is executed,
 * which happens only once the student is back. `scope` narrows it to one enrolment (a new try
 * replaces an old one at once) or to those older than a time. Ones that came back but whose
 * confirmation was cut short go to the teacher instead ("unconfirmed"), never failed unasked.
 */
export async function abandonGatewayPayments(db: Database, teacherId: string, scope: { enrollmentId?: string; olderThan?: Date }): Promise<void> {
  const mine: SQL[] = [eq(payments.teacherId, teacherId), eq(payments.method, "bkash_gateway"), eq(payments.status, "pending")];
  if (scope.enrollmentId) mine.push(eq(payments.enrollmentId, scope.enrollmentId));
  if (scope.olderThan) mine.push(sql`${payments.createdAt} < ${scope.olderThan}`);
  await db.transaction(async (tx) => {
    const gone = await tx
      .update(payments)
      .set({ status: "failed" })
      .where(and(...mine, eq(payments.gatewayState, "")))
      .returning({ id: payments.id });
    if (gone.length > 0) await tx.delete(paymentMonths).where(inArray(paymentMonths.paymentId, gone.map((g) => g.id)));
    if (scope.olderThan) await tx.update(payments).set({ gatewayState: "unconfirmed" }).where(and(...mine, eq(payments.gatewayState, "checking")));
  });
}

/** Which rule a refused insert broke: the same transaction id twice, or a period already paid for. */
function takenReason(error: unknown): "txnTaken" | "periodsTaken" | null {
  const constraint = uniqueViolation(error);
  if (constraint === null) return null;
  return constraint === "payments_teacher_txn_key" ? "txnTaken" : "periodsTaken";
}

async function ownStudent(db: Database, teacherId: string, studentId: string): Promise<boolean> {
  if (!isUuid(studentId)) return false;
  const [row] = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.teacherId, teacherId)))
    .limit(1);
  return Boolean(row);
}

/**
 * The teacher records a payment they have in hand (cash, or money they saw arrive): verified at
 * once, with the next receipt number. For a course it covers the periods ticked; without one
 * it is a payment for something else.
 */
export async function recordPayment(db: Database, teacherId: string, studentId: string, input: PaymentInput): Promise<PayResult> {
  if (!(await ownStudent(db, teacherId, studentId))) return { ok: false, reason: "student" };
  const plan = input.enrollmentId ? await feePlan(db, teacherId, input.enrollmentId) : null;
  if (input.enrollmentId && (!plan || plan.studentId !== studentId)) return { ok: false, reason: "enrollment" };
  // A course paid in one go has its one period; a monthly one has months; nothing else fits.
  const fits = plan ? input.periods.length > 0 && input.periods.every((p) => (plan.period === "one_time" ? p === ONCE : p !== ONCE)) : input.periods.length === 0;
  if (!fits) return { ok: false, reason: "periods" };
  const paidAt = input.paidOn ? new Date(`${input.paidOn}T12:00:00+06:00`) : new Date();
  try {
    return await db.transaction(async (tx) => {
      const [payment] = await tx
        .insert(payments)
        .values({
          teacherId,
          studentId,
          enrollmentId: plan?.id ?? null,
          kind: plan ? plan.period : "other",
          amount: input.amount,
          method: input.method,
          status: "verified",
          txnId: input.txnId,
          senderNumber: input.senderNumber,
          note: input.note,
          recordedBy: "teacher",
          receiptNo: await nextReceipt(tx, teacherId),
          paidAt,
          verifiedAt: new Date(),
        })
        .returning();
      if (plan) await tx.insert(paymentMonths).values(input.periods.map((month) => ({ paymentId: payment.id, enrollmentId: plan.id, month })));
      return { ok: true as const, payment };
    });
  } catch (error) {
    const reason = takenReason(error);
    if (reason) return { ok: false, reason };
    throw error;
  }
}

/**
 * A student reports having sent money for some periods of a course they are in. The amount is
 * worked out here (the fee times the periods), never taken from the form; the periods must be
 * ones they can pay for; and the way must be one the teacher has given a number for. It waits
 * for the teacher, and meanwhile those periods aren't asked for again.
 */
export async function claimPayment(db: Database, teacherId: string, studentId: string, claim: ClaimInput, info: PaymentInfo): Promise<PayResult> {
  if (!info[claim.method]) return { ok: false, reason: "method" };
  const plan = await feePlan(db, teacherId, claim.enrollmentId);
  if (!plan || plan.studentId !== studentId || plan.status !== "active") return { ok: false, reason: "enrollment" };
  const payable = payablePeriods(plan as FeePlan, await coveredPeriods(db, plan.id), dhakaMonth());
  if (claim.periods.length === 0 || claim.periods.some((p) => !payable.includes(p))) return { ok: false, reason: "periods" };
  try {
    return await db.transaction(async (tx) => {
      const [payment] = await tx
        .insert(payments)
        .values({
          teacherId,
          studentId,
          enrollmentId: plan.id,
          kind: plan.period,
          amount: plan.fee * claim.periods.length,
          method: claim.method,
          status: "pending",
          txnId: claim.txnId,
          senderNumber: claim.senderNumber,
          recordedBy: "student",
        })
        .returning();
      await tx.insert(paymentMonths).values(claim.periods.map((month) => ({ paymentId: payment.id, enrollmentId: plan.id, month })));
      return { ok: true as const, payment };
    });
  } catch (error) {
    const reason = takenReason(error);
    if (reason) return { ok: false, reason };
    throw error;
  }
}

/**
 * The teacher has checked a student's claim against their own phone: it becomes a verified payment
 * with the next receipt number. Only a waiting claim can be verified, and only once.
 */
export async function verifyPayment(db: Database, teacherId: string, paymentId: string): Promise<Payment | null> {
  if (!isUuid(paymentId)) return null;
  return db.transaction(async (tx) => {
    const [waiting] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.teacherId, teacherId), eq(payments.status, "pending")))
      .limit(1);
    if (!waiting) return null;
    const [payment] = await tx
      .update(payments)
      .set({ status: "verified", verifiedAt: new Date(), receiptNo: await nextReceipt(tx, teacherId) })
      .where(and(eq(payments.id, paymentId), eq(payments.status, "pending")))
      .returning();
    return payment ?? null;
  });
}

/**
 * Turns a claim down, or cancels a payment recorded by mistake: its periods are owed again, and
 * its transaction id can be claimed afresh. The record stays (with why), and so does a receipt
 * number already given.
 */
export async function cancelPayment(db: Database, teacherId: string, paymentId: string, note = ""): Promise<Payment | null> {
  if (!isUuid(paymentId)) return null;
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .update(payments)
      .set({ status: "rejected", note: note.slice(0, 200) })
      .where(and(eq(payments.id, paymentId), eq(payments.teacherId, teacherId), inArray(payments.status, ["pending", "verified"])))
      .returning();
    if (!payment) return null;
    await tx.delete(paymentMonths).where(eq(paymentMonths.paymentId, paymentId));
    return payment;
  });
}

/** The periods each of these payments covers. */
async function periodsOf(db: Database, paymentIds: string[]): Promise<Map<string, string[]>> {
  const byPayment = new Map<string, string[]>();
  if (paymentIds.length === 0) return byPayment;
  const rows = await db
    .select({ paymentId: paymentMonths.paymentId, month: paymentMonths.month })
    .from(paymentMonths)
    .where(inArray(paymentMonths.paymentId, paymentIds))
    .orderBy(asc(paymentMonths.month));
  for (const row of rows) byPayment.set(row.paymentId, [...(byPayment.get(row.paymentId) ?? []), row.month]);
  return byPayment;
}

export type PaymentFilters = { status?: PaymentStatus; studentId?: string; limit?: number };

/** The teacher's payments with their names and periods: claims oldest first (first come, first checked), the rest newest first. */
export async function listPayments(db: Database, teacherId: string, filters: PaymentFilters = {}): Promise<PaymentRow[]> {
  const conditions: SQL[] = [eq(payments.teacherId, teacherId)];
  // "Pending" for the teacher means waiting on them: a bKash payment still on its way isn't. And a
  // bKash try that didn't go through (no money moved) is no payment at all, unless asked for.
  if (filters.status) conditions.push(filters.status === "pending" ? awaitingTeacher : eq(payments.status, filters.status));
  else conditions.push(ne(payments.status, "failed"));
  if (filters.studentId !== undefined) {
    if (!isUuid(filters.studentId)) return [];
    conditions.push(eq(payments.studentId, filters.studentId));
  }
  const rows = await db
    .select({ payment: payments, studentName: students.name, studentPhone: students.phone, courseTitle: courses.title, batchName: batches.name })
    .from(payments)
    .innerJoin(students, eq(students.id, payments.studentId))
    .leftJoin(enrollments, eq(enrollments.id, payments.enrollmentId))
    .leftJoin(courses, eq(courses.id, enrollments.courseId))
    .leftJoin(batches, eq(batches.id, enrollments.batchId))
    .where(and(...conditions))
    .orderBy(filters.status === "pending" ? asc(payments.createdAt) : desc(payments.paidAt), desc(payments.createdAt))
    .limit(Math.min(filters.limit ?? 200, 500));
  const periods = await periodsOf(db, rows.map((row) => row.payment.id));
  return rows.map(({ payment, ...names }) => ({ ...payment, ...names, periods: periods.get(payment.id) ?? [] }));
}

/** One payment of the teacher's, for its receipt. With `studentId`, only if it is that student's. */
export async function getPayment(db: Database, teacherId: string, paymentId: string, studentId?: string): Promise<PaymentRow | null> {
  if (!isUuid(paymentId)) return null;
  const [row] = await db
    .select({ payment: payments, studentName: students.name, studentPhone: students.phone, courseTitle: courses.title, batchName: batches.name })
    .from(payments)
    .innerJoin(students, eq(students.id, payments.studentId))
    .leftJoin(enrollments, eq(enrollments.id, payments.enrollmentId))
    .leftJoin(courses, eq(courses.id, enrollments.courseId))
    .leftJoin(batches, eq(batches.id, enrollments.batchId))
    .where(and(eq(payments.id, paymentId), eq(payments.teacherId, teacherId), ...(studentId ? [eq(payments.studentId, studentId)] : [])))
    .limit(1);
  if (!row) return null;
  const periods = await periodsOf(db, [paymentId]);
  const { payment, ...names } = row;
  return { ...payment, ...names, periods: periods.get(paymentId) ?? [] };
}

/** How many payments are waiting for the teacher's decision. */
export async function countPendingPayments(db: Database, teacherId: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(payments)
    .where(and(eq(payments.teacherId, teacherId), awaitingTeacher));
  return Number(total);
}

/** What one student in one course owes, and what they may pay for. */
export type Due = {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  studentPhone: string;
  courseId: string;
  courseTitle: string;
  batchId: string | null;
  batchName: string | null;
  roll: string | null;
  fee: number;
  period: "monthly" | "one_time";
  /** Periods owed by now, and their total. */
  periods: string[];
  amount: number;
  /** Periods a payment may be made for: those owed, and a few months ahead. */
  payable: string[];
};

/**
 * Every active enrolment of the teacher's (or of one student) with what it owes this month. A
 * free place owes nothing and is left out unless `all`.
 */
export async function listDues(
  db: Database,
  teacherId: string,
  filters: { studentId?: string; courseId?: string; batchId?: string; all?: boolean } = {},
  now: string = dhakaMonth(),
): Promise<Due[]> {
  // A bKash payment abandoned at bKash's page gives its months back before anything is counted.
  await abandonGatewayPayments(db, teacherId, { olderThan: new Date(Date.now() - GATEWAY_PATIENCE_MS) });
  const conditions: SQL[] = [eq(enrollments.teacherId, teacherId), eq(enrollments.status, "active")];
  for (const [column, id] of [
    [enrollments.studentId, filters.studentId],
    [enrollments.courseId, filters.courseId],
    [enrollments.batchId, filters.batchId],
  ] as const) {
    if (!id) continue;
    if (!isUuid(id)) return [];
    conditions.push(eq(column, id));
  }
  const [places, covered] = await Promise.all([
    db
      .select({
        enrollmentId: enrollments.id,
        studentId: enrollments.studentId,
        studentName: students.name,
        studentPhone: students.phone,
        courseId: enrollments.courseId,
        courseTitle: courses.title,
        batchId: enrollments.batchId,
        batchName: batches.name,
        roll: enrollments.roll,
        fee: enrollments.fee,
        startMonth: enrollments.startMonth,
        period: courses.pricePeriod,
      })
      .from(enrollments)
      .innerJoin(students, eq(students.id, enrollments.studentId))
      .innerJoin(courses, eq(courses.id, enrollments.courseId))
      .leftJoin(batches, eq(batches.id, enrollments.batchId))
      .where(and(...conditions))
      .orderBy(asc(courses.position), asc(students.name)),
    db
      .select({ enrollmentId: paymentMonths.enrollmentId, month: paymentMonths.month })
      .from(paymentMonths)
      .innerJoin(enrollments, eq(enrollments.id, paymentMonths.enrollmentId))
      .where(eq(enrollments.teacherId, teacherId)),
  ]);
  const paid = new Map<string, string[]>();
  for (const row of covered) paid.set(row.enrollmentId, [...(paid.get(row.enrollmentId) ?? []), row.month]);

  return places
    .map(({ startMonth, ...place }) => {
      const plan: FeePlan = { fee: place.fee, period: place.period, startMonth };
      const mine = paid.get(place.enrollmentId) ?? [];
      return { ...place, ...duesOf(plan, mine, now), payable: payablePeriods(plan, mine, now) };
    })
    .filter((due) => filters.all || due.amount > 0);
}

/** Verified money by Bangladesh month, for the months asked ("YYYY-MM"): what the teacher actually collected. */
export async function collectedByMonth(db: Database, teacherId: string, months: string[]): Promise<Map<string, number>> {
  const month = sql<string>`to_char(${payments.paidAt} at time zone 'Asia/Dhaka', 'YYYY-MM')`;
  const rows =
    months.length === 0
      ? []
      : await db
          .select({ month, total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
          .from(payments)
          .where(and(eq(payments.teacherId, teacherId), eq(payments.status, "verified"), inArray(month, months)))
          .groupBy(month);
  const byMonth = new Map(months.map((m) => [m, 0]));
  for (const row of rows) byMonth.set(row.month, Number(row.total));
  return byMonth;
}

/** Saves where students send money. */
export async function setPaymentInfo(db: Database, teacherId: string, info: PaymentInfo): Promise<void> {
  await db.update(teachers).set({ paymentInfo: info }).where(eq(teachers.id, teacherId));
}
