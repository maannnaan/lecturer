import { asciiDigits } from "./digits";
import { type FieldErrors, type Input, text } from "./form-input";

/** The icons a teacher can put on a course cover (lucide names). */
export const COURSE_ICONS = [
  "book-open",
  "atom",
  "zap",
  "magnet",
  "sigma",
  "calculator",
  "flask-conical",
  "dna",
  "leaf",
  "globe",
  "languages",
  "pencil-ruler",
] as const;
export type CourseIcon = (typeof COURSE_ICONS)[number];

export const COURSE_ACCESS = ["free", "approval", "paid"] as const;
export type CourseAccess = (typeof COURSE_ACCESS)[number];
export const PRICE_PERIODS = ["monthly", "one_time"] as const;
export type PricePeriod = (typeof PRICE_PERIODS)[number];
export const CHAPTER_STATUSES = ["upcoming", "ongoing", "done"] as const;
export type ChapterStatus = (typeof CHAPTER_STATUSES)[number];

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value ?? "") ? (value as T) : fallback;
}

/** A whole number of taka, accepting Bangla digits and thousands separators: "১,২০০" → 1200. */
export function parseTaka(raw: string | undefined): number | null {
  const cleaned = asciiDigits(raw ?? "").replace(/[\s,৳]/g, "");
  if (!cleaned) return 0;
  return /^\d{1,7}$/.test(cleaned) ? Number(cleaned) : null;
}

export function parseCourse(input: Input) {
  const errors: FieldErrors = {};
  const access = oneOf(input.access, COURSE_ACCESS, "approval");
  const price = parseTaka(input.price);
  if (price === null) errors.price = "number";
  else if (access === "paid" && price <= 0) errors.price = "pricePositive";
  const cover = Number(input.cover);
  const course = {
    title: text(input, "title", 120, errors, true),
    level: text(input, "level", 40, errors),
    session: text(input, "session", 120, errors),
    description: text(input, "description", 2000, errors),
    icon: oneOf(input.icon, COURSE_ICONS, "book-open"),
    cover: Number.isInteger(cover) && cover >= 1 && cover <= 4 ? cover : 1,
    access,
    // A course that isn't paid has no price; keeping an old one would only confuse later.
    price: access === "paid" ? (price ?? 0) : 0,
    pricePeriod: oneOf(input.pricePeriod, PRICE_PERIODS, "monthly"),
    published: input.published === "on" || input.published === "true",
  };
  return { course, errors };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(input: Input, name: string, errors: FieldErrors): string | null {
  const value = (input[name] ?? "").trim();
  if (!value) return null;
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    errors[name] = "invalid";
    return null;
  }
  return value;
}

export function parseChapter(input: Input) {
  const errors: FieldErrors = {};
  const startsOn = isoDate(input, "startsOn", errors);
  const endsOn = isoDate(input, "endsOn", errors);
  if (startsOn && endsOn && endsOn < startsOn) errors.endsOn = "dateOrder";
  const chapter = {
    label: text(input, "label", 30, errors),
    title: text(input, "title", 160, errors, true),
    status: oneOf(input.status, CHAPTER_STATUSES, "upcoming"),
    startsOn,
    endsOn,
  };
  return { chapter, errors };
}

export function parseNotice(input: Input) {
  const errors: FieldErrors = {};
  const notice = {
    title: text(input, "title", 160, errors, true),
    body: text(input, "body", 3000, errors),
    pinned: input.pinned === "on" || input.pinned === "true",
  };
  return { notice, errors };
}
