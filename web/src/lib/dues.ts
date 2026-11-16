// What a student owes. A course is paid by the month (a fee each month from the month the student
// started) or in one go (the fee, once). Months are "YYYY-MM" in Bangladesh time; a course paid in
// one go has the single period ONCE. Amounts are whole taka.

/** The one period of a course paid in one go. */
export const ONCE = "once";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonth(value: string): boolean {
  return MONTH.test(value);
}

/** The month after "YYYY-MM". */
export function nextMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, "0")}`;
}

/** Every month from `start` to `end`, both included; none when `start` is after `end` or either isn't a month. */
export function monthsBetween(start: string, end: string): string[] {
  if (!isMonth(start) || !isMonth(end) || start > end) return [];
  const months: string[] = [];
  // A fee can't be years in arrears without anyone noticing: stop at ten years, whatever the dates say.
  for (let month = start; month <= end && months.length < 120; month = nextMonth(month)) months.push(month);
  return months;
}

export type FeePlan = {
  /** Taka a month, or once. */
  fee: number;
  /** "monthly", or "one_time" for a course paid in one go. */
  period: "monthly" | "one_time";
  /** The first month the fee is due; "" for a student not yet in. */
  startMonth: string;
};

/**
 * The periods a student has to pay for by `now` (a month): every month since they started, or the
 * one payment of a course paid in one go. None when the fee is nothing.
 */
export function periodsDue(plan: FeePlan, now: string): string[] {
  if (plan.fee <= 0 || !isMonth(plan.startMonth)) return [];
  return plan.period === "one_time" ? [ONCE] : monthsBetween(plan.startMonth, now);
}

/**
 * What is still owed: the periods due that no payment covers (`covered`: the periods of payments
 * that are verified, or waiting to be: a claim the teacher hasn't checked yet isn't asked for again).
 */
export function duesOf(plan: FeePlan, covered: Iterable<string>, now: string): { periods: string[]; amount: number } {
  const paid = new Set(covered);
  const periods = periodsDue(plan, now).filter((period) => !paid.has(period));
  return { periods, amount: periods.length * plan.fee };
}

/**
 * The periods a payment may be made for: what is owed, and (paying by the month) up to
 * `ahead` months to come, for a student who pays in advance.
 */
export function payablePeriods(plan: FeePlan, covered: Iterable<string>, now: string, ahead = 3): string[] {
  if (plan.fee <= 0 || !isMonth(plan.startMonth)) return [];
  if (plan.period === "one_time") return duesOf(plan, covered, now).periods;
  const paid = new Set(covered);
  let end = now;
  for (let i = 0; i < ahead; i++) end = nextMonth(end);
  return monthsBetween(plan.startMonth, end).filter((month) => !paid.has(month));
}
