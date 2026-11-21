import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseCourse } from "@/lib/courses";
import { nextMonth } from "@/lib/dues";
import { dhakaMonth } from "@/lib/students";
import { createCourse, updateCourse } from "@/server/courses";
import { openSecret } from "@/server/crypto";
import type { Database } from "@/server/db";
import { payments, teacherGateways } from "@/server/db/schema";
import { enrollStudent } from "@/server/enrollments";
import { finishGatewayPayment, gatewayOpen, getGatewayView, saveGateway, startGatewayPayment } from "@/server/gateway";
import { abandonGatewayPayments, countPendingPayments, getPayment, listDues, listPayments, verifyPayment } from "@/server/payments";
import { createStudent } from "@/server/students";
import type { Teacher } from "@/server/teachers";
import { freshDb, makeTeacher } from "../helpers/db";

let db: Database;
let stranger: Teacher;
let phones = 0;
const phone = () => `0190${String(4000000 + ++phones).slice(-7)}`;
const NOW = dhakaMonth();
const SITE = "https://lecturer.example";

/**
 * A stand-in for bKash's v2 Tokenized Checkout, as developer.bka.sh describes it: it knows one
 * merchant account, opens payments, and moves money only on execute. `mode` makes it misbehave.
 */
function fakeBkash(mode: { executeTimeout?: boolean; refuse?: boolean; down?: boolean; amount?: string } = {}) {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const opened = new Map<string, { amount: string; status: string; trxId: string }>();
  let n = 0;
  const reply = (json: unknown) => new Response(JSON.stringify(json), { headers: { "content-type": "application/json" } });
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input).replace(/^.*\/tokenized-checkout/, "");
    const headers = init?.headers as Record<string, string>;
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, string>;
    calls.push({ path, body });
    if (path.startsWith("/auth/")) {
      const right = headers.username === "merchant" && headers.password === "secret-pass" && body.app_key === "app-key" && body.app_secret === "app-secret";
      return reply(right ? { statusCode: "0000", statusMessage: "Successful", id_token: `token-${++n}`, refresh_token: `refresh-${n}`, expires_in: 3600 } : { statusCode: "9999", statusMessage: "Invalid or unrecognized access credentials" });
    }
    if (path === "/payment/create") {
      const id = `TR00${++n}`;
      opened.set(id, { amount: body.amount, status: "Initiated", trxId: "" });
      return reply({ paymentId: id, bkashURL: `https://sandbox.payment.bkash.com/?paymentId=${id}`, transactionStatus: "Initiated", amount: body.amount, currency: "BDT" });
    }
    if (mode.down) throw new TypeError("fetch failed");
    const payment = opened.get(body.paymentId);
    if (!payment) return reply({ externalCode: "2002", errorMessageEn: "Invalid Payment ID" });
    if (path === "/payment/execute") {
      if (payment.status === "Completed") return reply({ externalCode: "2062", errorMessageEn: "The payment has already been completed" });
      if (mode.refuse) return reply({ externalCode: "2023", errorMessageEn: "Insufficient Balance" });
      payment.status = "Completed";
      payment.trxId = `BFD${n}X`;
      if (mode.executeTimeout) throw new DOMException("The operation timed out.", "TimeoutError");
      return reply({ paymentId: body.paymentId, trxId: payment.trxId, transactionStatus: "Completed", amount: mode.amount ?? payment.amount, currency: "BDT" });
    }
    if (path === "/query/payment") return reply({ paymentId: body.paymentId, trxId: payment.trxId, transactionStatus: payment.status, amount: mode.amount ?? payment.amount, currency: "BDT" });
    return new Response("no such path", { status: 404 });
  }) as typeof fetch;
  return { fetchFn, calls, opened, paths: () => calls.map((c) => c.path) };
}

const ACCOUNT = { mode: "sandbox" as const, username: "merchant", appKey: "app-key", password: "secret-pass", appSecret: "app-secret" };

/** A teacher whose bKash account bKash accepted, with a student in a ৳1,200-a-month course. */
async function place(fake = fakeBkash()) {
  const t = await makeTeacher(db);
  const { course: input } = parseCourse({ title: "কোর্স", access: "paid", price: "1200", pricePeriod: "monthly" });
  const created = await createCourse(db, t.id, input);
  const course = (await updateCourse(db, t.id, created.id, { ...input, published: true }))!;
  const student = await createStudent(db, { teacherId: t.id, name: "রাহিম", phone: phone(), password: "secret1" });
  const enrolled = await enrollStudent(db, t.id, student.id, course.id, { batchId: null, roll: null, fee: null });
  if (!enrolled.ok) throw new Error("not enrolled");
  expect(await saveGateway(db, t.id, ACCOUNT, fake.fetchFn)).toEqual({ ok: true });
  return { t, student, enrollment: enrolled.enrollment, fake };
}

/** The student starts paying for `periods`; the bKash payment it opened, and our payment's id. */
async function start(s: Awaited<ReturnType<typeof place>>, periods = [NOW]) {
  const started = await startGatewayPayment(db, s.t.id, s.student.id, { enrollmentId: s.enrollment.id, periods }, SITE, s.fake.fetchFn);
  if (!started.ok) throw new Error(`not started: ${started.reason}`);
  const create = s.fake.calls.findLast((c) => c.path === "/payment/create")!;
  return { url: started.url, bkashId: new URL(started.url).searchParams.get("paymentId")!, paymentId: String(create.body.merchantInvoiceNumber), create };
}

const previousKey = process.env.SECRETS_KEY;
beforeAll(async () => {
  process.env.SECRETS_KEY = randomBytes(32).toString("hex");
  db = await freshDb();
  stranger = await makeTeacher(db);
});
afterAll(() => {
  process.env.SECRETS_KEY = previousKey;
});

describe("a teacher's bKash account", () => {
  it("is tried with bKash as it is saved, and kept sealed", async () => {
    const t = await makeTeacher(db);
    const fake = fakeBkash();
    expect(await saveGateway(db, t.id, { ...ACCOUNT, password: "wrong" }, fake.fetchFn)).toEqual({ ok: false, reason: "bkash", message: "Invalid or unrecognized access credentials" });
    expect(await getGatewayView(db, t.id)).toMatchObject({ enabled: false, username: "merchant" });
    expect(await gatewayOpen(db, t.id)).toBe(false);

    // A blank password keeps the saved one (here, still the wrong one); the right one is accepted.
    expect((await saveGateway(db, t.id, { ...ACCOUNT, password: null }, fake.fetchFn)).ok).toBe(false);
    expect(await saveGateway(db, t.id, ACCOUNT, fake.fetchFn)).toMatchObject({ ok: false, reason: "rate" });
    // bKash allows two tries an hour: the third waits an hour.
    expect(fake.paths().filter((p) => p.startsWith("/auth/"))).toHaveLength(2);

    const [row] = await db.select().from(teacherGateways).where(eq(teacherGateways.teacherId, t.id));
    expect(row.passwordSealed).not.toContain("wrong");
    expect(openSecret(row.passwordSealed)).toBe("wrong");
    expect(await getGatewayView(db, stranger.id)).toBeNull();
  });

  it("reuses its token: two payments, one token", async () => {
    const s = await place();
    await start(s);
    await start(s, [nextMonth(NOW)]);
    expect(s.fake.paths().filter((p) => p.startsWith("/auth/"))).toEqual(["/auth/grant-token"]);
  });
});

describe("paying through bKash", () => {
  it("holds the months while the student is at bKash, and confirms itself when they come back", async () => {
    const s = await place();
    const { url, bkashId, paymentId, create } = await start(s);
    expect(url).toBe(`https://sandbox.payment.bkash.com/?paymentId=${bkashId}`);
    expect(create.body).toMatchObject({ amount: "1200.00", currency: "BDT", intent: "sale", callbackURL: `${SITE}/api/bkash/callback/${paymentId}`, payerReference: s.student.phone });
    // On its way: the month isn't owed, and it isn't a claim for the teacher to check.
    expect(await listDues(db, s.t.id)).toEqual([]);
    expect(await countPendingPayments(db, s.t.id)).toBe(0);
    expect(await listPayments(db, s.t.id, { status: "pending" })).toEqual([]);

    // Someone else's bKash payment id changes nothing.
    expect((await finishGatewayPayment(db, paymentId, { paymentID: "TR-other", status: "success" }, s.fake.fetchFn)).outcome).toBe("unknown");
    expect(s.fake.paths()).not.toContain("/payment/execute");

    const done = await finishGatewayPayment(db, paymentId, { paymentID: bkashId, status: "success" }, s.fake.fetchFn);
    expect(done).toEqual({ outcome: "paid", handle: s.t.handle, enrollmentId: s.enrollment.id });
    const paid = await getPayment(db, s.t.id, paymentId, s.student.id);
    expect(paid).toMatchObject({ status: "verified", method: "bkash_gateway", amount: 1200, receiptNo: 1, txnId: expect.stringMatching(/^BFD\d+X$/), periods: [NOW], gatewayState: "" });

    // bKash (or the student's browser) coming back again settles nothing twice.
    expect((await finishGatewayPayment(db, paymentId, { paymentID: bkashId, status: "success" }, s.fake.fetchFn)).outcome).toBe("paid");
    expect(s.fake.paths().filter((p) => p === "/payment/execute")).toHaveLength(1);
    expect((await getPayment(db, s.t.id, paymentId))?.receiptNo).toBe(1);
  });

  it("gives the months back when the student cancels, or bKash refuses: nothing is taken", async () => {
    const s = await place();
    const first = await start(s);
    expect((await finishGatewayPayment(db, first.paymentId, { paymentID: first.bkashId, status: "cancel" }, s.fake.fetchFn)).outcome).toBe("cancelled");
    expect(s.fake.paths()).not.toContain("/payment/execute");
    expect((await getPayment(db, s.t.id, first.paymentId))?.status).toBe("failed");
    expect((await listDues(db, s.t.id))[0]).toMatchObject({ periods: [NOW] });

    const refusing = await place(fakeBkash({ refuse: true }));
    const second = await start(refusing);
    expect((await finishGatewayPayment(db, second.paymentId, { paymentID: second.bkashId, status: "success" }, refusing.fake.fetchFn)).outcome).toBe("failed");
    // Refused, then asked: bKash says the money never moved.
    expect(refusing.fake.paths().slice(-2)).toEqual(["/payment/execute", "/query/payment"]);
    expect((await listDues(db, refusing.t.id))[0]).toMatchObject({ periods: [NOW] });
  });

  it("asks bKash where the payment stands when execute gets no answer, instead of guessing", async () => {
    const s = await place(fakeBkash({ executeTimeout: true }));
    const { paymentId, bkashId } = await start(s);
    expect((await finishGatewayPayment(db, paymentId, { paymentID: bkashId, status: "success" }, s.fake.fetchFn)).outcome).toBe("paid");
    expect((await getPayment(db, s.t.id, paymentId))?.status).toBe("verified");
  });

  it("hands the teacher a payment bKash couldn't confirm, never failing it unasked", async () => {
    const s = await place(fakeBkash({ down: true }));
    const { paymentId, bkashId } = await start(s);
    expect((await finishGatewayPayment(db, paymentId, { paymentID: bkashId, status: "success" }, s.fake.fetchFn)).outcome).toBe("unconfirmed");
    expect(await getPayment(db, s.t.id, paymentId)).toMatchObject({ status: "pending", gatewayState: "unconfirmed", note: "bKash: network" });
    // It waits for the teacher, holding its month; the teacher decides.
    expect(await countPendingPayments(db, s.t.id)).toBe(1);
    expect((await listPayments(db, s.t.id, { status: "pending" })).map((p) => p.id)).toEqual([paymentId]);
    expect(await listDues(db, s.t.id)).toEqual([]);
    expect((await verifyPayment(db, s.t.id, paymentId))?.status).toBe("verified");

    // Money moved, but not the amount asked: the teacher decides that too.
    const odd = await place(fakeBkash({ amount: "100.00" }));
    const other = await start(odd);
    expect((await finishGatewayPayment(db, other.paymentId, { paymentID: other.bkashId, status: "success" }, odd.fake.fetchFn)).outcome).toBe("unconfirmed");
    expect(await getPayment(db, odd.t.id, other.paymentId)).toMatchObject({ status: "pending", gatewayState: "unconfirmed", note: "bKash: 100 BDT" });
  });

  it("lets a try abandoned at bKash's page go, giving its months back", async () => {
    const s = await place();
    const first = await start(s);
    // The student tries again: the first try, which never came back, is given up.
    const second = await start(s);
    expect((await getPayment(db, s.t.id, first.paymentId))?.status).toBe("failed");
    expect((await getPayment(db, s.t.id, second.paymentId))?.status).toBe("pending");
    // After an hour unanswered, the second goes too.
    await abandonGatewayPayments(db, s.t.id, { olderThan: new Date(Date.now() + 1000) });
    expect((await getPayment(db, s.t.id, second.paymentId))?.status).toBe("failed");
    expect((await listDues(db, s.t.id))[0]).toMatchObject({ periods: [NOW] });
    // A late "success" for it moves no money.
    expect((await finishGatewayPayment(db, second.paymentId, { paymentID: second.bkashId, status: "success" }, s.fake.fetchFn)).outcome).toBe("failed");
    expect(s.fake.paths()).not.toContain("/payment/execute");
  });

  it("is only for the teacher's own students, in their own courses, once the account is on", async () => {
    const s = await place();
    const outsider = await createStudent(db, { teacherId: s.t.id, name: "অন্য", phone: phone(), password: "secret1" });
    expect(await startGatewayPayment(db, s.t.id, outsider.id, { enrollmentId: s.enrollment.id, periods: [NOW] }, SITE, s.fake.fetchFn)).toEqual({ ok: false, reason: "enrollment" });
    expect(await startGatewayPayment(db, stranger.id, s.student.id, { enrollmentId: s.enrollment.id, periods: [NOW] }, SITE, s.fake.fetchFn)).toEqual({ ok: false, reason: "off" });
    expect(await startGatewayPayment(db, s.t.id, s.student.id, { enrollmentId: s.enrollment.id, periods: ["2001-01"] }, SITE, s.fake.fetchFn)).toEqual({ ok: false, reason: "periods" });
    // Only bKash payments are settled through bKash's way back.
    const [claim] = await db.select({ id: payments.id }).from(payments).where(eq(payments.teacherId, s.t.id)).limit(1);
    expect(claim).toBeUndefined();
  });
});
