import "server-only";
import { and, eq } from "drizzle-orm";
import { payablePeriods } from "@/lib/dues";
import { isUuid } from "@/lib/ids";
import type { GatewayInput, GatewayPayInput } from "@/lib/payments";
import { dhakaMonth } from "@/lib/students";
import { type Database, uniqueViolation } from "@/server/db";
import { paymentMonths, payments, students, teacherGateways, teachers } from "@/server/db/schema";
import {
  type BkashAccount,
  BkashError,
  type BkashPayment,
  type FetchFn,
  bkashBaseUrl,
  createPayment,
  executePayment,
  grantToken,
  queryPayment,
  refreshToken,
} from "./bkash";
import { openSecret, sealSecret, secretsReady } from "./crypto";
import { type Payment, abandonGatewayPayments, coveredPeriods, feePlan, nextReceipt } from "./payments";

// A teacher's own bKash merchant account, through which their students pay and the payment
// confirms itself: no TxnID to type, nothing for the teacher to check. The money goes straight to
// the teacher's account; Lecturer.bd only asks bKash to take it, and records what bKash says.
//
// The order, as bKash requires it: create a payment, send the student to bKash's page, and when
// they come back with "success", execute it (the only call that moves money). If execute gives no
// answer, ask bKash where the payment stands instead of trying again. A payment is verified only
// when bKash says "Completed" for the amount asked.

export type Gateway = typeof teacherGateways.$inferSelect;
/** A teacher's gateway as their settings page may show it: never the secrets. */
export type GatewayView = Pick<Gateway, "mode" | "username" | "appKey" | "enabled" | "verifiedAt">;

const HOUR_MS = 3_600_000;
/** A token is renewed this long before bKash's hour runs out, as bKash advises (between minutes 50 and 55). */
const RENEW_EARLY_MS = 8 * 60_000;

async function gatewayRow(db: Database, teacherId: string): Promise<Gateway | null> {
  if (!isUuid(teacherId)) return null;
  const [row] = await db.select().from(teacherGateways).where(eq(teacherGateways.teacherId, teacherId)).limit(1);
  return row ?? null;
}

export async function getGatewayView(db: Database, teacherId: string): Promise<GatewayView | null> {
  const row = await gatewayRow(db, teacherId);
  return row ? { mode: row.mode, username: row.username, appKey: row.appKey, enabled: row.enabled, verifiedAt: row.verifiedAt } : null;
}

/** Whether the teacher's students can pay through bKash right now. */
export async function gatewayOpen(db: Database, teacherId: string): Promise<boolean> {
  return secretsReady() && Boolean((await gatewayRow(db, teacherId))?.enabled);
}

/** The times new tokens were asked for in the last hour; bKash blocks a third. */
const recentCalls = (calls: string[], now: Date) => calls.filter((at) => now.getTime() - new Date(at).getTime() < HOUR_MS);

/** When a token may next be asked for, if the hour's two are used. */
const nextCallAt = (calls: string[], now: Date) => {
  const recent = recentCalls(calls, now).sort();
  return recent.length < 2 ? null : new Date(new Date(recent[0]).getTime() + HOUR_MS);
};

/** The sealed fields a fresh token is kept in. */
function tokenFields(token: { idToken: string; refreshToken: string; expiresIn: number }, now: Date) {
  return {
    idTokenSealed: sealSecret(token.idToken),
    tokenExpiresAt: new Date(now.getTime() + token.expiresIn * 1000 - RENEW_EARLY_MS),
    refreshTokenSealed: token.refreshToken ? sealSecret(token.refreshToken) : null,
    // bKash keeps a refresh token 30 days.
    refreshExpiresAt: token.refreshToken ? new Date(now.getTime() + 29 * 24 * HOUR_MS) : null,
  };
}

export type GatewaySaveResult = { ok: true } | { ok: false; reason: "secrets" | "missing" | "rate" | "bkash"; message?: string; retryAt?: Date };

/**
 * Saves the teacher's bKash account (a password or app secret left out keeps the saved one) and
 * tries it at once: students are offered bKash only once bKash has handed out a token for it.
 * A refused account is kept, switched off, with bKash's reason given back.
 */
export async function saveGateway(db: Database, teacherId: string, input: GatewayInput, fetchFn: FetchFn = fetch, now = new Date()): Promise<GatewaySaveResult> {
  if (!secretsReady()) return { ok: false, reason: "secrets" };
  const current = await gatewayRow(db, teacherId);
  const password = input.password ?? openSecret(current?.passwordSealed);
  const appSecret = input.appSecret ?? openSecret(current?.appSecretSealed);
  if (!password || !appSecret) return { ok: false, reason: "missing" };
  const calls = recentCalls(current?.tokenCalls ?? [], now);
  const wait = nextCallAt(calls, now);
  if (wait) return { ok: false, reason: "rate", retryAt: wait };

  const account: BkashAccount = { baseUrl: bkashBaseUrl(input.mode), username: input.username, password, appKey: input.appKey, appSecret };
  const saved = {
    mode: input.mode,
    username: input.username,
    appKey: input.appKey,
    passwordSealed: sealSecret(password),
    appSecretSealed: sealSecret(appSecret),
    tokenCalls: [...calls, now.toISOString()],
  };
  let result: GatewaySaveResult = { ok: true };
  let fields: Partial<typeof teacherGateways.$inferInsert> = {};
  try {
    const token = await grantToken(account, fetchFn);
    fields = { enabled: true, verifiedAt: now, ...tokenFields(token, now) };
  } catch (error) {
    if (!(error instanceof BkashError)) throw error;
    fields = { enabled: false, verifiedAt: null, idTokenSealed: null, tokenExpiresAt: null, refreshTokenSealed: null, refreshExpiresAt: null };
    result = { ok: false, reason: "bkash", message: error.message };
  }
  await db
    .insert(teacherGateways)
    .values({ teacherId, ...saved, ...fields })
    .onConflictDoUpdate({ target: teacherGateways.teacherId, set: { ...saved, ...fields, updatedAt: now } });
  return result;
}

/** Takes the teacher's bKash account away: students go back to Send Money and TxnIDs. */
export async function removeGateway(db: Database, teacherId: string): Promise<void> {
  if (!isUuid(teacherId)) return;
  await db.delete(teacherGateways).where(eq(teacherGateways.teacherId, teacherId));
}

/** The teacher's account with its secrets opened; a BkashError if they can't be (no key, or another key). */
function accountOf(gateway: Gateway): BkashAccount {
  const password = openSecret(gateway.passwordSealed);
  const appSecret = openSecret(gateway.appSecretSealed);
  if (!password || !appSecret) throw new BkashError("secrets", "The bKash account's saved secrets can't be read on this server");
  return { baseUrl: bkashBaseUrl(gateway.mode), username: gateway.username, password, appKey: gateway.appKey, appSecret };
}

/**
 * A live token for the teacher's account: the saved one while it lasts, else a refreshed one, else
 * a new one, within bKash's two an hour. Each new one is saved for the next payment.
 */
async function liveToken(db: Database, gateway: Gateway, fetchFn: FetchFn, now = new Date()): Promise<{ account: BkashAccount; idToken: string }> {
  const account = accountOf(gateway);
  const saved = openSecret(gateway.idTokenSealed);
  if (saved && gateway.tokenExpiresAt && gateway.tokenExpiresAt > now) return { account, idToken: saved };
  let calls = recentCalls(gateway.tokenCalls, now);
  const take = async (ask: () => Promise<{ idToken: string; refreshToken: string; expiresIn: number }>) => {
    if (calls.length >= 2) throw new BkashError("rate", "bKash allows only two new tokens an hour; try again a little later");
    calls = [...calls, now.toISOString()];
    try {
      return await ask();
    } finally {
      await db.update(teacherGateways).set({ tokenCalls: calls }).where(eq(teacherGateways.teacherId, gateway.teacherId));
    }
  };
  const refresh = openSecret(gateway.refreshTokenSealed);
  let token: { idToken: string; refreshToken: string; expiresIn: number } | null = null;
  if (refresh && gateway.refreshExpiresAt && gateway.refreshExpiresAt > now) {
    token = await take(() => refreshToken(account, refresh, fetchFn)).catch((error) => {
      if (error instanceof BkashError && error.code !== "rate") return null;
      throw error;
    });
  }
  token ??= await take(() => grantToken(account, fetchFn));
  await db.update(teacherGateways).set(tokenFields(token, now)).where(eq(teacherGateways.teacherId, gateway.teacherId));
  return { account, idToken: token.idToken };
}

export type GatewayStart = { ok: true; url: string } | { ok: false; reason: "off" | "enrollment" | "periods" | "periodsTaken" | "bkash"; message?: string };

/**
 * A student starts paying for some periods of a course of theirs through bKash. The amount is the
 * course's fee for those periods, worked out here. The payment waits, holding its periods, while
 * the student is at bKash's page (`url`); an earlier try for the same course that never came back
 * gives its periods up first. bKash sends the student back to `callbackBase`/api/bkash/callback/<id>.
 */
export async function startGatewayPayment(
  db: Database,
  teacherId: string,
  studentId: string,
  pay: GatewayPayInput,
  callbackBase: string,
  fetchFn: FetchFn = fetch,
): Promise<GatewayStart> {
  const gateway = await gatewayRow(db, teacherId);
  if (!gateway?.enabled || !secretsReady()) return { ok: false, reason: "off" };
  const plan = await feePlan(db, teacherId, pay.enrollmentId);
  if (!plan || plan.studentId !== studentId || plan.status !== "active") return { ok: false, reason: "enrollment" };
  await abandonGatewayPayments(db, teacherId, { enrollmentId: plan.id });
  const payable = payablePeriods(plan, await coveredPeriods(db, plan.id), dhakaMonth());
  if (pay.periods.length === 0 || pay.periods.some((p) => !payable.includes(p)) || plan.fee <= 0) return { ok: false, reason: "periods" };

  const amount = plan.fee * pay.periods.length;
  let payment: Payment;
  try {
    payment = await db.transaction(async (tx) => {
      const [made] = await tx
        .insert(payments)
        .values({ teacherId, studentId, enrollmentId: plan.id, kind: plan.period, amount, method: "bkash_gateway", status: "pending", recordedBy: "student" })
        .returning();
      await tx.insert(paymentMonths).values(pay.periods.map((month) => ({ paymentId: made.id, enrollmentId: plan.id, month })));
      return made;
    });
  } catch (error) {
    if (uniqueViolation(error)) return { ok: false, reason: "periodsTaken" };
    throw error;
  }

  try {
    const { account, idToken } = await liveToken(db, gateway, fetchFn);
    const [student] = await db.select({ phone: students.phone }).from(students).where(eq(students.id, studentId)).limit(1);
    const created = await createPayment(
      account,
      idToken,
      { amount, invoice: payment.id, payerReference: student?.phone || payment.id.slice(0, 8), callbackURL: `${callbackBase.replace(/\/+$/, "")}/api/bkash/callback/${payment.id}` },
      fetchFn,
    );
    await db.update(payments).set({ gatewayPaymentId: created.paymentId }).where(eq(payments.id, payment.id));
    return { ok: true, url: created.bkashURL };
  } catch (error) {
    // Nothing was opened at bKash: the periods are owed again.
    await abandonGatewayPayments(db, teacherId, { enrollmentId: plan.id });
    if (error instanceof BkashError) return { ok: false, reason: "bkash", message: error.message };
    throw error;
  }
}

export type GatewayOutcome = "paid" | "cancelled" | "failed" | "unconfirmed" | "unknown";

/** Verifies a gateway payment bKash says is complete: the next receipt number, and bKash's transaction id. Once only. */
async function confirm(db: Database, payment: Payment, trxId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [waiting] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.id, payment.id), eq(payments.status, "pending")))
      .limit(1);
    if (!waiting) return;
    const now = new Date();
    await tx
      .update(payments)
      .set({ status: "verified", txnId: trxId.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 30), gatewayState: "", paidAt: now, verifiedAt: now, receiptNo: await nextReceipt(tx, payment.teacherId) })
      .where(and(eq(payments.id, payment.id), eq(payments.status, "pending")));
  });
}

/** Ends a gateway payment that didn't go through: failed, and its periods owed again. */
async function fail(db: Database, payment: Payment): Promise<void> {
  await db.transaction(async (tx) => {
    const ended = await tx
      .update(payments)
      .set({ status: "failed", gatewayState: "" })
      .where(and(eq(payments.id, payment.id), eq(payments.status, "pending")))
      .returning({ id: payments.id });
    if (ended.length > 0) await tx.delete(paymentMonths).where(eq(paymentMonths.paymentId, payment.id));
  });
}

/**
 * The student is back from bKash (`paymentID`, and `status` success, failure or cancel, as bKash
 * appends them to the callback). Settles the payment and says how it went, with where to send the
 * student. Safe to arrive twice: a payment already settled stays as it is.
 */
export async function finishGatewayPayment(
  db: Database,
  paymentId: string,
  back: { paymentID: string; status: string },
  fetchFn: FetchFn = fetch,
): Promise<{ outcome: GatewayOutcome; handle: string | null; enrollmentId: string | null }> {
  const none = { outcome: "unknown" as const, handle: null, enrollmentId: null };
  if (!isUuid(paymentId)) return none;
  const [row] = await db
    .select({ payment: payments, handle: teachers.handle })
    .from(payments)
    .innerJoin(teachers, eq(teachers.id, payments.teacherId))
    .where(and(eq(payments.id, paymentId), eq(payments.method, "bkash_gateway")))
    .limit(1);
  if (!row) return none;
  const { payment } = row;
  const where = { handle: row.handle, enrollmentId: payment.enrollmentId };
  if (payment.status === "verified") return { outcome: "paid", ...where };
  if (payment.status !== "pending") return { outcome: "failed", ...where };
  // Only bKash's own payment for this one, and only once: anything else changes nothing.
  if (!payment.gatewayPaymentId || back.paymentID !== payment.gatewayPaymentId || payment.gatewayState !== "") {
    return { outcome: payment.gatewayState === "unconfirmed" ? "unconfirmed" : "unknown", ...where };
  }
  if (back.status !== "success") {
    await fail(db, payment);
    return { outcome: back.status === "cancel" ? "cancelled" : "failed", ...where };
  }

  // From here the money may move: if the answer is lost, the teacher must hear of it, never a silent failure.
  const claimed = await db
    .update(payments)
    .set({ gatewayState: "checking" })
    .where(and(eq(payments.id, payment.id), eq(payments.status, "pending"), eq(payments.gatewayState, "")))
    .returning({ id: payments.id });
  if (claimed.length === 0) return { outcome: "unknown", ...where };

  const gateway = await gatewayRow(db, payment.teacherId);
  let state: BkashPayment | null = null;
  let refused: BkashError | null = null;
  let executed = false;
  try {
    if (!gateway) throw new BkashError("off", "The teacher's bKash account is no longer set up");
    const { account, idToken } = await liveToken(db, gateway, fetchFn);
    try {
      executed = true;
      state = await executePayment(account, idToken, payment.gatewayPaymentId, fetchFn);
    } catch (error) {
      if (!(error instanceof BkashError)) throw error;
      refused = error;
      // No answer isn't a failure, and a refusal may mean it already went through: ask where it stands.
      state = await queryPayment(account, idToken, payment.gatewayPaymentId, fetchFn).catch(() => null);
    }
  } catch (error) {
    if (!(error instanceof BkashError)) throw error;
    refused = error;
  }
  if (!executed) {
    // Execute was never asked for, so no money moved: the payment simply didn't happen.
    await fail(db, payment);
    return { outcome: "failed", ...where };
  }

  if (state?.transactionStatus === "Completed") {
    if (Math.round(state.amount) === payment.amount && (state.currency === "" || state.currency === "BDT")) {
      await confirm(db, payment, state.trxId);
      return { outcome: "paid", ...where };
    }
    // Money moved, but not what was asked: the teacher decides.
    await db
      .update(payments)
      .set({ gatewayState: "unconfirmed", txnId: state.trxId.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 30), note: `bKash: ${state.amount} ${state.currency}` })
      .where(eq(payments.id, payment.id));
    return { outcome: "unconfirmed", ...where };
  }
  if (state && state.transactionStatus !== "Completed") {
    // bKash says the money never moved (e.g. a wrong PIN, too little balance).
    await fail(db, payment);
    return { outcome: "failed", ...where };
  }
  // No word from bKash either way: the teacher checks their merchant account.
  await db.update(payments).set({ gatewayState: "unconfirmed", note: refused ? `bKash: ${refused.code}` : "" }).where(eq(payments.id, payment.id));
  return { outcome: "unconfirmed", ...where };
}
