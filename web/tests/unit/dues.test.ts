import { describe, expect, it } from "vitest";
import { ONCE, duesOf, monthsBetween, nextMonth, payablePeriods, periodsDue } from "@/lib/dues";
import { parseClaim, parsePayment, parsePaymentInfo } from "@/lib/payments";

describe("months", () => {
  it("follow one another across a year's end", () => {
    expect(nextMonth("2026-11")).toBe("2026-12");
    expect(nextMonth("2026-12")).toBe("2027-01");
    expect(monthsBetween("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(monthsBetween("2026-11", "2026-11")).toEqual(["2026-11"]);
    expect(monthsBetween("2026-12", "2026-11")).toEqual([]);
    expect(monthsBetween("", "2026-11")).toEqual([]);
    expect(monthsBetween("2026-13", "2027-01")).toEqual([]);
  });
});

describe("dues", () => {
  const monthly = { fee: 1200, period: "monthly" as const, startMonth: "2026-09" };

  it("a monthly fee is owed for every month since the student started, less what is paid or claimed", () => {
    expect(periodsDue(monthly, "2026-11")).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(duesOf(monthly, [], "2026-11")).toEqual({ periods: ["2026-09", "2026-10", "2026-11"], amount: 3600 });
    expect(duesOf(monthly, ["2026-09", "2026-11"], "2026-11")).toEqual({ periods: ["2026-10"], amount: 1200 });
    expect(duesOf(monthly, ["2026-09", "2026-10", "2026-11", "2026-12"], "2026-11")).toEqual({ periods: [], amount: 0 });
    // Before the student's first month, nothing.
    expect(duesOf(monthly, [], "2026-08").amount).toBe(0);
  });

  it("a course paid in one go is owed once", () => {
    const once = { fee: 5000, period: "one_time" as const, startMonth: "2026-09" };
    expect(duesOf(once, [], "2027-03")).toEqual({ periods: [ONCE], amount: 5000 });
    expect(duesOf(once, [ONCE], "2027-03")).toEqual({ periods: [], amount: 0 });
    expect(payablePeriods(once, [], "2026-11")).toEqual([ONCE]);
  });

  it("a free place, or a student not yet in, owes nothing", () => {
    expect(duesOf({ ...monthly, fee: 0 }, [], "2026-11").amount).toBe(0);
    expect(duesOf({ ...monthly, startMonth: "" }, [], "2026-11").amount).toBe(0);
    expect(payablePeriods({ ...monthly, fee: 0 }, [], "2026-11")).toEqual([]);
  });

  it("a student may pay what is owed and a few months ahead, never a month twice", () => {
    expect(payablePeriods(monthly, ["2026-09"], "2026-11")).toEqual(["2026-10", "2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(payablePeriods(monthly, [], "2026-09", 0)).toEqual(["2026-09"]);
  });
});

describe("payments as forms give them", () => {
  it("the teacher records an amount, a way and the months it is for", () => {
    const { payment, errors } = parsePayment({ enrollmentId: "e", months: "2026-11, 2026-10,2026-10", amount: "২,৪০০", method: "bkash", txnId: " ab12 cd34 ", paidOn: "2026-11-05" });
    expect(errors).toEqual({});
    expect(payment).toMatchObject({ enrollmentId: "e", periods: ["2026-10", "2026-11"], amount: 2400, method: "bkash", txnId: "AB12CD34", paidOn: "2026-11-05" });
    // Cash by default, today, for nothing in particular.
    expect(parsePayment({ amount: "500" }).payment).toMatchObject({ method: "cash", periods: [], enrollmentId: null, paidOn: "", txnId: "" });
    expect(parsePayment({ amount: "" }).errors).toEqual({ amount: "required" });
    expect(parsePayment({ amount: "0" }).errors).toEqual({ amount: "invalid" });
    expect(parsePayment({ amount: "lots", months: "November", txnId: "a!" }).errors).toEqual({ amount: "number", months: "invalid", txnId: "invalid" });
  });

  it("a student's claim needs a course, months, a way and the transaction id; never an amount of their own", () => {
    const { claim, errors } = parseClaim({ enrollmentId: "e", months: ONCE, method: "nagad", txnId: "7kx9p2q1", senderNumber: "+880 1712-345678", amount: "1" });
    expect(errors).toEqual({});
    expect(claim).toEqual({ enrollmentId: "e", periods: [ONCE], method: "nagad", txnId: "7KX9P2Q1", senderNumber: "01712345678" });
    expect(parseClaim({}).errors).toEqual({ method: "required", months: "required", txnId: "required", enrollmentId: "required" });
    // Cash can't be claimed: only the teacher can say they were handed money.
    expect(parseClaim({ enrollmentId: "e", months: "2026-11", method: "cash", txnId: "ABC12345" }).errors).toEqual({ method: "required" });
    expect(parseClaim({ enrollmentId: "e", months: "2026-11", method: "bkash", txnId: "ABC12345", senderNumber: "123" }).errors).toEqual({ senderNumber: "phone" });
  });

  it("the teacher's payment numbers are mobile numbers (Rocket's has one digit more)", () => {
    expect(parsePaymentInfo({ bkash: "০১৭১২৩৪৫৬৭৮", nagad: "", rocket: "017123456789", bank: "ডাচ-বাংলা, হিসাব 123", instructions: "Send Money করুন" })).toEqual({
      info: { bkash: "01712345678", rocket: "017123456789", bank: "ডাচ-বাংলা, হিসাব 123", instructions: "Send Money করুন" },
      errors: {},
    });
    expect(parsePaymentInfo({ bkash: "12345", nagad: "017123456789" }).errors).toEqual({ bkash: "phone", nagad: "phone" });
    expect(parsePaymentInfo({}).info).toEqual({});
  });
});
