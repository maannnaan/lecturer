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

/** A calendar date as people in Bangladesh read it, in Dhaka time. */
export function formatDate(value: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(value);
}
