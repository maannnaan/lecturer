import "server-only";
import type { Dictionary, Locale } from "@/i18n";
import { chapterLabel } from "@/lib/chapter-label";
import type { CourseWithChapters } from "@/server/courses";
import type { CourseChoice } from "./question-form";

/** Courses and their chapters as the question editor lists them: "অধ্যায় ৪: নিউটনিয়ান বলবিদ্যা". */
export function courseChoices(courses: CourseWithChapters[], d: Dictionary, locale: Locale): CourseChoice[] {
  return courses.map((course) => ({
    id: course.id,
    title: course.title,
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
