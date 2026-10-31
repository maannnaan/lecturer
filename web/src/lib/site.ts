import type { RoutineRow, SiteContact, SiteStat, TeacherSite } from "@/server/db/schema";
import { EMAIL, type FieldErrors, type Input, text, url } from "./form-input";
import { normalizePhone } from "./phone";

// Limits that keep each part of a teacher's website readable on a phone.
export const STAT_SLOTS = 4;
export const ROUTINE_SLOTS = 8;

/** The "who I am" part of the website: account names plus the site's own lines. */
export function parseProfile(input: Input) {
  const errors: FieldErrors = {};
  const account = {
    nameBn: text(input, "nameBn", 80, errors, true),
    nameEn: text(input, "nameEn", 80, errors, true),
    subjects: text(input, "subjects", 120, errors),
    institution: text(input, "institution", 120, errors),
  };
  const site: Partial<TeacherSite> = {
    designation: text(input, "designation", 80, errors),
    tagline: text(input, "tagline", 200, errors),
    location: text(input, "location", 80, errors),
    admission: text(input, "admission", 100, errors),
    about: text(input, "about", 3000, errors),
  };
  return { account, site, errors };
}

/** A value + label pair; both or neither. Returns null when both are empty. */
function pair(input: Input, prefix: string, errors: FieldErrors, maxValue: number, maxLabel: number): SiteStat | null {
  const value = text(input, `${prefix}Value`, maxValue, errors);
  const label = text(input, `${prefix}Label`, maxLabel, errors);
  if (!value && !label) return null;
  if (!value) errors[`${prefix}Value`] = "incomplete";
  if (!label) errors[`${prefix}Label`] = "incomplete";
  return { value, label };
}

/** The highlight on the photo and the row of figures under the hero. Blank slots are dropped. */
export function parseHighlights(input: Input) {
  const errors: FieldErrors = {};
  const highlight = pair(input, "highlight", errors, 40, 60);
  const stats: SiteStat[] = [];
  for (let i = 0; i < STAT_SLOTS; i++) {
    const stat = pair(input, `stat${i}`, errors, 20, 40);
    if (stat) stats.push(stat);
  }
  return { site: { highlight, stats } satisfies Partial<TeacherSite>, errors };
}

const FACEBOOK = /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i;
const YOUTUBE = /(^|\.)(youtube\.com|youtu\.be)$/i;

export function parseContact(input: Input) {
  const errors: FieldErrors = {};
  const phoneRaw = text(input, "phone", 30, errors);
  const whatsappRaw = text(input, "whatsapp", 30, errors);
  const email = text(input, "email", 120, errors).toLowerCase();
  const contact: SiteContact = {
    phone: phoneRaw ? (normalizePhone(phoneRaw) ?? phoneRaw) : "",
    whatsapp: whatsappRaw ? (normalizePhone(whatsappRaw) ?? whatsappRaw) : "",
    email,
    facebook: url(input, "facebook", errors, FACEBOOK),
    youtube: url(input, "youtube", errors, YOUTUBE),
    address: text(input, "address", 160, errors),
    hours: text(input, "hours", 80, errors),
  };
  if (phoneRaw && !normalizePhone(phoneRaw)) errors.phone = "phone";
  if (whatsappRaw && !normalizePhone(whatsappRaw)) errors.whatsapp = "phone";
  if (email && !EMAIL.test(email)) errors.email = "email";
  return { site: { contact } satisfies Partial<TeacherSite>, errors };
}

/** The class schedule. A row counts once its batch is named; days and time then complete it. */
export function parseRoutine(input: Input) {
  const errors: FieldErrors = {};
  const routine: RoutineRow[] = [];
  for (let i = 0; i < ROUTINE_SLOTS; i++) {
    const batch = text(input, `batch${i}`, 60, errors);
    const days = text(input, `days${i}`, 60, errors);
    const time = text(input, `time${i}`, 40, errors);
    if (!batch && !days && !time) continue;
    if (!batch) errors[`batch${i}`] = "incomplete";
    routine.push({ batch, days, time });
  }
  return { site: { routine } satisfies Partial<TeacherSite>, errors };
}
