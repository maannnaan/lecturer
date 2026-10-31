import { describe, expect, it } from "vitest";
import { bn } from "@/i18n/bn";
import { en } from "@/i18n/en";
import { formatDate, formatNumber } from "@/i18n";

/** Every key path, with array lengths, so the two languages can be compared structurally. */
function shape(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return [`${path}[${value.length}]`, ...value.flatMap((v, i) => shape(v, `${path}[${i}]`))];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k));
  }
  return [`${path}:${typeof value}`];
}

describe("dictionaries", () => {
  it("English has exactly Bangla's keys, list lengths and kinds of value", () => {
    expect(shape(en)).toEqual(shape(bn));
  });

  it("has no empty labels", () => {
    for (const entry of [...shape(bn), ...shape(en)]) expect(entry).not.toMatch(/:undefined$/);
    const blanks = (dict: object) =>
      JSON.stringify(dict, (_k, v) => (typeof v === "string" && v.trim() === "" ? "<<blank>>" : v)).includes("<<blank>>");
    expect(blanks(bn)).toBe(false);
    expect(blanks(en)).toBe(false);
  });
});

describe("formatting", () => {
  it("writes Bangla numbers in Bangla digits with lakh grouping", () => {
    expect(formatNumber(1234567, "bn")).toBe("১২,৩৪,৫৬৭");
    expect(formatNumber(1234567, "en")).toBe("1,234,567");
  });

  it("writes dates in Dhaka time", () => {
    // 20:30 UTC on 31 Dec is already 1 January in Dhaka (UTC+6).
    const d = new Date(Date.UTC(2026, 11, 31, 20, 30));
    expect(formatDate(d, "en")).toBe("1 January 2027");
    expect(formatDate(d, "bn")).toContain("২০২৭");
  });
});
