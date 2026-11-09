import type { Dictionary } from "@/i18n";

/**
 * The classes a course can be for, in the order the question bank lists them. The question bank
 * groups courses by these (class › subject › chapter). Stored as text on courses.grade and checked
 * here, like boards; names live in the dictionaries under `grades`.
 */
export const GRADES = ["class-6", "class-7", "class-8", "ssc", "hsc", "admission", "other"] as const;
export type Grade = (typeof GRADES)[number];

export function isGrade(value: string | null | undefined): value is Grade {
  return (GRADES as readonly string[]).includes(value ?? "");
}

/** A stored grade, with anything unknown read as "other". */
export function gradeOf(course: { grade: string }): Grade {
  return isGrade(course.grade) ? course.grade : "other";
}

/** What the bank calls a course: its subject, or its title when the teacher gave no subject. */
export function subjectOf(course: { subject: string; title: string }): string {
  return course.subject || course.title;
}

/** A class's name and the line under it, e.g. "এইচএসসি" and "একাদশ-দ্বাদশ শ্রেণি". */
export function gradeName(grade: string, d: Pick<Dictionary, "grades">): { label: string; detail: string } {
  return d.grades[isGrade(grade) ? grade : "other"];
}

/** A class on one line, for menus: "এইচএসসি (একাদশ-দ্বাদশ শ্রেণি)". */
export function gradeLine(grade: string, d: Pick<Dictionary, "grades">): string {
  const { label, detail } = gradeName(grade, d);
  return detail ? `${label} (${detail})` : label;
}
