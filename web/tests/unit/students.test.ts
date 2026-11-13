import { describe, expect, it } from "vitest";
import type { FieldErrors } from "@/lib/form-input";
import { dhakaMonth, nextRoll, parseBatch, parseJoin, parsePlacement, parseRoll, parseStudent } from "@/lib/students";

describe("roll numbers", () => {
  it("are digits only, at most 8, in either script, without leading zeros", () => {
    const errors: FieldErrors = {};
    expect(parseRoll("12", errors)).toBe("12");
    expect(parseRoll(" ০০৭ ", errors)).toBe("7");
    expect(parseRoll("12345678", errors)).toBe("12345678");
    // Empty means "give the next one".
    expect(parseRoll("", errors)).toBeNull();
    expect(errors).toEqual({});
    for (const bad of ["123456789", "12a", "1.5", "-3", "0", "000"]) {
      const refused: FieldErrors = {};
      expect(parseRoll(bad, refused), bad).toBeNull();
      expect(refused.roll, bad).toBe("roll");
    }
  });

  it("go on from the highest in use", () => {
    expect(nextRoll([])).toBe("1");
    expect(nextRoll(["1", "2", null, "10"])).toBe("11");
    // Compared as numbers, not text: 9 is not after 10.
    expect(nextRoll(["9", "10"])).toBe("11");
  });
});

describe("students as forms give them", () => {
  it("need a name and a real mobile number; the rest is optional", () => {
    const { student, errors } = parseStudent({ name: "  রাহিম   উদ্দিন ", phone: "+880 1712-345678", guardianPhone: "০১৮১২৩৪৫৬৭৮", classLevel: "একাদশ" });
    expect(errors).toEqual({});
    expect(student).toMatchObject({ name: "রাহিম উদ্দিন", phone: "01712345678", guardianPhone: "01812345678", classLevel: "একাদশ", institution: "", note: "" });

    expect(parseStudent({}).errors).toEqual({ name: "required", phone: "required" });
    expect(parseStudent({ name: "ক", phone: "12345", guardianPhone: "nope" }).errors).toEqual({ phone: "phone", guardianPhone: "phone" });
    expect(parseStudent({ name: "ক".repeat(81), phone: "01712345678" }).errors).toEqual({ name: "tooLong" });
  });

  it("a student joining chooses a password of six characters or more, and can't set the teacher's note", () => {
    const joined = parseJoin({ name: "সাদিয়া", phone: "01712345678", password: "secret", note: "teacher only", address: "x" });
    expect(joined.errors).toEqual({});
    expect(joined.password).toBe("secret");
    expect(joined.student.note).toBe("");
    expect(joined.student.address).toBe("");
    expect(parseJoin({ name: "সাদিয়া", phone: "01712345678", password: "12345" }).errors).toEqual({ password: "passwordShort" });
    expect(parseJoin({ name: "সাদিয়া", phone: "01712345678" }).errors).toEqual({ password: "required" });
  });
});

describe("batches and places", () => {
  it("a batch has a name; seats are a whole number or no limit", () => {
    expect(parseBatch({ name: " ক  ব্যাচ ", schedule: "শনি-সোম", capacity: "৪০", open: "on" })).toEqual({
      batch: { name: "ক ব্যাচ", schedule: "শনি-সোম", capacity: 40, open: true },
      errors: {},
    });
    expect(parseBatch({ name: "খ" }).batch).toMatchObject({ capacity: null, open: false });
    expect(parseBatch({ name: "" }).errors).toEqual({ name: "required" });
    for (const capacity of ["0", "-5", "many", "12345"]) expect(parseBatch({ name: "ক", capacity }).errors, capacity).toEqual({ capacity: "number" });
  });

  it("a place leaves the roll and the fee to their defaults when empty", () => {
    expect(parsePlacement({ batchId: "", roll: "", fee: "" })).toEqual({ placement: { batchId: null, roll: null, fee: null }, errors: {} });
    expect(parsePlacement({ batchId: "b", roll: "০৫", fee: "১,২০০" }).placement).toEqual({ batchId: "b", roll: "5", fee: 1200 });
    // A fee of nothing is a fee, not "the course's price".
    expect(parsePlacement({ fee: "0" }).placement.fee).toBe(0);
    expect(parsePlacement({ roll: "x", fee: "lots" }).errors).toEqual({ roll: "roll", fee: "number" });
  });

  it("the month is Bangladesh's, not the server's", () => {
    // 31 October, 20:00 UTC is already 1 November, 02:00 in Dhaka.
    expect(dhakaMonth(new Date("2026-10-31T20:00:00Z"))).toBe("2026-11");
    expect(dhakaMonth(new Date("2026-10-31T17:00:00Z"))).toBe("2026-10");
  });
});
