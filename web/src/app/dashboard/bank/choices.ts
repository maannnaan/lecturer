import "server-only";
import type { Dictionary, Locale } from "@/i18n";
import { chapterLabel } from "@/lib/chapter-label";
import { GRADES, gradeName, gradeOf } from "@/lib/grades";
import type { CourseWithChapters } from "@/server/courses";
import type { CourseChoice } from "./question-form";

/**
 * Courses and their chapters as the question editor lists them, grouped by class:
 * "এইচএসসি › পদার্থবিজ্ঞান ১ম পত্র", then "অধ্যায় ৪: নিউটনিয়ান বলবিদ্যা".
 */
export function courseChoices(courses: CourseWithChapters[], d: Dictionary, locale: Locale): CourseChoice[] {
  // Stable sort: classes in the bank's order, courses in the teacher's order within each.
  const byClass = [...courses].sort((a, b) => GRADES.indexOf(gradeOf(a)) - GRADES.indexOf(gradeOf(b)));
  return byClass.map((course) => ({
    id: course.id,
    title: course.title,
    group: gradeName(course.grade, d).label,
    chapters: course.chapters.map((ch, i) => ({ id: ch.id, label: `${chapterLabel(ch, i, d, locale)}: ${ch.title}` })),
  }));
}

/** Chapter id → "অধ্যায় ৪: নিউটনিয়ান বলবিদ্যা", and course id → title, for listing questions. */
export function placeNames(courses: CourseWithChapters[], d: Dictionary, locale: Locale) {
  const courseTitle = new Map(courses.map((c) => [c.id, c.title]));
  const chapterName = new Map(
    courses.flatMap((c) => c.chapters.map((ch, i) => [ch.id, `${chapterLabel(ch, i, d, locale)}: ${ch.title}`] as const)),
  );
  return { courseTitle, chapterName };
}
