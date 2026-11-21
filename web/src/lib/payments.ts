import { parseTaka } from "./courses";
import { asciiDigits } from "./digits";
import { ONCE, isMonth } from "./dues";
import { type FieldErrors, type Input, text } from "./form-input";
import { normalizePhone } from "./phone";

// Payments as forms give them: one the teacher records, and one a student reports having sent.

/** How money can reach a teacher. The gateway is not a choice on a form: bKash itself reports those. */
export const PAYMENT_METHODS = ["cash", "bkash", "nagad", "rocket", "bank", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
/** The ways a student can report having paid: each needs the teacher's number and gives a transaction id. */
export const CLAIM_METHODS = ["bkash", "nagad", "rocket", "bank"] as const;
export type ClaimMethod = (typeof CLAIM_METHODS)[number];
export const PAYMENT_STATUSES = ["pending", "verified", "rejected", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** The most periods one payment covers. */
export const MAX_PERIODS = 24;

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(value ?? "") ? (value as T) : null;
}

/** The periods ticked on a form (posted as `months`, joined with commas): months, or the one-go period. */
function periodsField(input: Input, errors: FieldErrors): string[] {
  const periods = [...new Set((input.months ?? "").split(",").map((p) => p.trim()).filter(Boolean))].sort();
  if (periods.some((p) => p !== ONCE && !isMonth(p)) || periods.length > MAX_PERIODS) errors.months = "invalid";
  return periods;
}

/** A transaction id as the SMS gives it: letters and digits, upper-cased. */
function txnField(input: Input, errors: FieldErrors, required: boolean): string {
  const txn = (input.txnId ?? "").replace(/\s+/g, "").toUpperCase();
  if (!txn) {
    if (required) errors.txnId = "required";
  } else if (!/^[A-Z0-9]{6,30}$/.test(txn)) errors.txnId = "invalid";
  return txn;
}

function amountField(input: Input, errors: FieldErrors): number {
  const amount = parseTaka(input.amount);
  if ((input.amount ?? "").trim() === "") errors.amount = "required";
  else if (amount === null) errors.amount = "number";
  else if (amount <= 0) errors.amount = "invalid";
  return amount ?? 0;
}

/** A payment the teacher records: cash in hand, or money they have seen arrive. Verified as it is saved. */
export function parsePayment(input: Input) {
  const errors: FieldErrors = {};
  const method = oneOf(input.method, PAYMENT_METHODS) ?? "cash";
  const sender = (input.senderNumber ?? "").trim();
  const payment = {
    enrollmentId: (input.enrollmentId ?? "").trim() || null,
    periods: periodsField(input, errors),
    amount: amountField(input, errors),
    method,
    txnId: txnField(input, errors, false),
    senderNumber: sender ? (normalizePhone(sender) ?? sender.slice(0, 20)) : "",
    note: text(input, "note", 200, errors),
    /** The day the money was paid, "YYYY-MM-DD", or "" for today. */
    paidOn: /^\d{4}-\d{2}-\d{2}$/.test(input.paidOn ?? "") ? (input.paidOn as string) : "",
  };
  return { payment, errors };
}
export type PaymentInput = ReturnType<typeof parsePayment>["payment"];

/** A student reports a Send Money (or bank) payment: for which periods, by which way, and its transaction id. */
export function parseClaim(input: Input) {
  const errors: FieldErrors = {};
  const method = oneOf(input.method, CLAIM_METHODS);
  if (!method) errors.method = "required";
  const periods = periodsField(input, errors);
  if (periods.length === 0 && !errors.months) errors.months = "required";
  const sender = (input.senderNumber ?? "").trim();
  const senderNumber = sender ? normalizePhone(sender) : "";
  if (sender && !senderNumber) errors.senderNumber = "phone";
  const claim = {
    enrollmentId: (input.enrollmentId ?? "").trim(),
    periods,
    method: method ?? "bkash",
    txnId: txnField(input, errors, true),
    senderNumber: senderNumber ?? sender,
  };
  if (!claim.enrollmentId) errors.enrollmentId = "required";
  return { claim, errors };
}
export type ClaimInput = ReturnType<typeof parseClaim>["claim"];

/** What a student pays through bKash: which periods of which course. The amount is the server's to work out, and bKash gives the transaction id. */
export function parseGatewayPay(input: Input) {
  const errors: FieldErrors = {};
  const periods = periodsField(input, errors);
  if (periods.length === 0 && !errors.months) errors.months = "required";
  const enrollmentId = (input.enrollmentId ?? "").trim();
  if (!enrollmentId) errors.enrollmentId = "required";
  return { pay: { enrollmentId, periods }, errors };
}
export type GatewayPayInput = ReturnType<typeof parseGatewayPay>["pay"];

/**
 * A teacher's bKash merchant account (Tokenized Checkout) as the settings form gives it: test
 * (sandbox) or live, and the four things bKash issues. A password or app secret left empty keeps
 * the saved one; `saved` says whether there is one.
 */
export function parseGateway(input: Input, saved: boolean) {
  const errors: FieldErrors = {};
  const secret = (name: "password" | "appSecret") => {
    const value = (input[name] ?? "").trim();
    if (!value && !saved) errors[name] = "required";
    else if (value.length > 300) errors[name] = "tooLong";
    return value || null;
  };
  const gateway = {
    mode: input.mode === "live" ? ("live" as const) : ("sandbox" as const),
    username: text(input, "username", 120, errors, true),
    appKey: text(input, "appKey", 200, errors, true),
    password: secret("password"),
    appSecret: secret("appSecret"),
  };
  return { gateway, errors };
}
export type GatewayInput = ReturnType<typeof parseGateway>["gateway"];

/** Where students send money, as the teacher's settings form gives it. A number is a mobile number; the bank line is free text. */
export function parsePaymentInfo(input: Input) {
  const errors: FieldErrors = {};
  const info: { bkash?: string; nagad?: string; rocket?: string; bank?: string; instructions?: string } = {};
  for (const wallet of ["bkash", "nagad", "rocket"] as const) {
    const raw = (input[wallet] ?? "").trim();
    if (!raw) continue;
    // A Rocket number is a mobile number with one more digit after it.
    const digits = asciiDigits(raw).replace(/[\s-]/g, "");
    const phone = normalizePhone(raw) ?? (wallet === "rocket" && /^01[3-9]\d{9}$/.test(digits) ? digits : null);
    if (phone) info[wallet] = phone;
    else errors[wallet] = "phone";
  }
  const bank = text(input, "bank", 200, errors);
  if (bank) info.bank = bank;
  const instructions = text(input, "instructions", 500, errors);
  if (instructions) info.instructions = instructions;
  return { info, errors };
}
