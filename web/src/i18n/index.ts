import { bn } from "./bn";
import { en } from "./en";

export const LOCALES = ["bn", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "bn";

/** The shape every language must have: exactly Bangla's keys and function signatures. */
export type Dictionary = typeof bn;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function getDictionary(locale: Locale): Dictionary {
  return locale === "en" ? en : bn;
}

const intlLocale = (locale: Locale) => (locale === "bn" ? "bn-BD" : "en-GB");

/** Numbers in the page's own digits: ১২৩ in Bangla, 123 in English. */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

/** A year without a thousands separator: ২০২৩, not ২,০২৩. */
export function formatYear(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { useGrouping: false }).format(value);
}

/** A roll number in the page's digits, never grouped: ১২৩৪৫, not ১২,৩৪৫. */
export function formatRoll(roll: string, locale: Locale): string {
  return /^\d{1,15}$/.test(roll) ? formatYear(Number(roll), locale) : roll;
}

const calendarDay = (iso: string) => new Date(`${iso}T00:00:00Z`);

/**
 * Planned dates of a chapter (stored as YYYY-MM-DD), the way they're said aloud:
 * "২–১৪ সেপ্টেম্বর", "২১ অক্টোবর – ৮ নভেম্বর". Empty when neither date is set.
 */
export function formatDayRange(from: string | null, to: string | null, locale: Locale): string {
  const format = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "long", timeZone: "UTC" });
  if (from && to) return format.formatRange(calendarDay(from), calendarDay(to));
  const one = from ?? to;
  return one ? format.format(calendarDay(one)) : "";
}

/** Day number and short month, for a calendar-page date block (Dhaka time). */
export function dayAndMonth(value: Date, locale: Locale): { day: string; month: string } {
  const parts = new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Dhaka",
  }).formatToParts(value);
  return {
    day: parts.find((p) => p.type === "day")?.value ?? "",
    month: parts.find((p) => p.type === "month")?.value ?? "",
  };
}

/** A month, "YYYY-MM", as people read it: "নভেম্বর ২০২৬", or "নভে ২৬" when `short`. */
export function formatMonth(month: string, locale: Locale, short = false): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  return new Intl.DateTimeFormat(intlLocale(locale), { month: short ? "short" : "long", year: short ? "2-digit" : "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
}

/** An amount of money in whole taka: "৳ ১,২০০". */
export function formatTaka(amount: number, locale: Locale): string {
  return `৳ ${formatNumber(amount, locale)}`;
}

/** A moment as people in Bangladesh read it: "২০ নভেম্বর, সকাল ১০:০০", in Dhaka time. */
export function formatDateTime(value: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  }).format(value);
}

/** A number of marks from hundredths, in the page's digits: 175 → "১.৭৫". */
export function formatMarks(hundredths: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 2 }).format(hundredths / 100);
}

/** A calendar date as people in Bangladesh read it, in Dhaka time. */
export function formatDate(value: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(value);
}
