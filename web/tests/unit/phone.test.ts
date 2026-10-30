import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it("stores every common spelling of a number the same way", () => {
    for (const raw of [
      "01712345678",
      "+8801712345678",
      "8801712345678",
      "01712-345678",
      "017 1234 5678",
      "০১৭১২৩৪৫৬৭৮",
      "+৮৮০১৭১২৩৪৫৬৭৮",
    ]) {
      expect(normalizePhone(raw), raw).toBe("01712345678");
    }
  });

  it("refuses what isn't a Bangladesh mobile number", () => {
    for (const raw of ["", "abc", "0171234567", "017123456789", "01212345678", "1712345678"]) {
      expect(normalizePhone(raw), raw).toBeNull();
    }
  });
});
