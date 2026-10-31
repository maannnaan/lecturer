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

/** A calendar date as people in Bangladesh read it, in Dhaka time. */
export function formatDate(value: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(value);
}
