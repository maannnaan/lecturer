import { parseTaka } from "./courses";
import { asciiDigits } from "./digits";
import { type FieldErrors, type Input, text } from "./form-input";
import { normalizePhone } from "./phone";

// Students, batches and admissions as forms give them. Like the other parsers these only check
// shape; whether a course, batch or student is the teacher's own is the data layer's question.

export const STUDENT_STATUSES = ["active", "inactive"] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];
export const ENROLLMENT_STATUSES = ["pending", "active", "rejected", "left"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

/** The shortest password a student may choose (shorter than a teacher's: students are often children). */
export const STUDENT_PASSWORD_MIN = 6;

/** A roll number is what an OMR sheet's roll grid carries: digits only, at most this many. */
export const ROLL_MAX_DIGITS = 8;

/**
 * A roll number: digits (Bangla ones too), at most 8, stored without leading zeros so "007" and
 * "7" are the same roll. Null when left empty; records "roll" when it isn't a roll.
 */
export function parseRoll(raw: string | undefined, errors: FieldErrors, name = "roll"): string | null {
  const digits = asciiDigits(raw ?? "").trim();
  if (!digits) return null;
  const roll = digits.replace(/^0+(?=\d)/, "");
  if (!/^\d+$/.test(digits) || roll.length > ROLL_MAX_DIGITS || roll === "0") {
    errors[name] = "roll";
    return null;
  }
  return roll;
}

/** The roll after the highest one in use: 1 in an empty course. */
export function nextRoll(rolls: Array<string | null>): string {
  const highest = rolls.reduce((max, roll) => (roll && /^\d+$/.test(roll) ? Math.max(max, Number(roll)) : max), 0);
  return String(highest + 1);
}

/** A phone number field: the one stored form, "" when left empty and not required. */
function phoneField(input: Input, name: string, errors: FieldErrors, required = false): string {
  const raw = (input[name] ?? "").trim();
  if (!raw) {
    if (required) errors[name] = "required";
    return "";
  }
  const phone = normalizePhone(raw);
  if (!phone) errors[name] = "phone";
  return phone ?? raw;
}

/** What is known about a student, as the teacher's form or the sign-up form gives it. */
export function parseStudent(input: Input) {
  const errors: FieldErrors = {};
  const student = {
    name: text(input, "name", 80, errors, true).replace(/\s+/g, " "),
    phone: phoneField(input, "phone", errors, true),
    guardianName: text(input, "guardianName", 80, errors),
    guardianPhone: phoneField(input, "guardianPhone", errors),
    institution: text(input, "institution", 120, errors),
    classLevel: text(input, "classLevel", 40, errors),
    address: text(input, "address", 200, errors),
    note: text(input, "note", 500, errors),
  };
  return { student, errors };
}
export type StudentInput = ReturnType<typeof parseStudent>["student"];

/** A password a student chooses, or the teacher sets for them. Never trimmed: spaces count. */
export function parsePassword(input: Input, errors: FieldErrors, name = "password", required = true): string {
  const password = input[name] ?? "";
  if (!password) {
    if (required) errors[name] = "required";
  } else if (password.length < STUDENT_PASSWORD_MIN || password.length > 200) {
    errors[name] = "passwordShort";
  }
  return password;
}

/** A student's own sign-up on a teacher's site: who they are, and a password. */
export function parseJoin(input: Input) {
  const { student, errors } = parseStudent({ ...input, address: "", note: "" });
  const password = parsePassword(input, errors);
  return { student, password, errors };
}

/** A batch of a course: its name, when it meets, how many it takes, and whether it is taking students. */
export function parseBatch(input: Input) {
  const errors: FieldErrors = {};
  const rawCapacity = asciiDigits(input.capacity ?? "").trim();
  let capacity: number | null = null;
  if (rawCapacity) {
    if (/^\d{1,4}$/.test(rawCapacity) && Number(rawCapacity) > 0) capacity = Number(rawCapacity);
    else errors.capacity = "number";
  }
  const batch = {
    name: text(input, "name", 60, errors, true).replace(/\s+/g, " "),
    schedule: text(input, "schedule", 120, errors),
    capacity,
    open: input.open === "on" || input.open === "true",
  };
  return { batch, errors };
}
export type BatchInput = ReturnType<typeof parseBatch>["batch"];

/** What a teacher sets when letting a student into a course, or changing their place in it. */
export function parsePlacement(input: Input) {
  const errors: FieldErrors = {};
  const fee = parseTaka(input.fee);
  if (fee === null) errors.fee = "number";
  const placement = {
    batchId: (input.batchId ?? "").trim() || null,
    /** Null: give the next free roll. */
    roll: parseRoll(input.roll, errors),
    /** Null: the course's own price. */
    fee: (input.fee ?? "").trim() === "" ? null : fee,
  };
  return { placement, errors };
}
export type PlacementInput = ReturnType<typeof parsePlacement>["placement"];

/** The month it is in Bangladesh, "YYYY-MM": when an enrolment starts counting. */
export function dhakaMonth(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}`;
}
