import "server-only";
import type { Dictionary, Locale } from "@/i18n";
import { chapterLabel } from "@/lib/chapter-label";
import { GRADES, gradeName, gradeOf } from "@/lib/grades";
import type { SubjectWithChapters } from "@/server/bank";
import type { SubjectChoice } from "./question-form";

/**
 * The bank's subjects and their chapters as the question editor lists them, grouped by class:
 * "এইচএসসি › পদার্থবিজ্ঞান ১ম পত্র", then "অধ্যায় ৪: নিউটনিয়ান বলবিদ্যা".
 */
export function subjectChoices(subjects: SubjectWithChapters[], d: Dictionary, locale: Locale): SubjectChoice[] {
  // Stable sort: classes in the bank's order, subjects in the teacher's order within each.
  const byClass = [...subjects].sort((a, b) => GRADES.indexOf(gradeOf(a)) - GRADES.indexOf(gradeOf(b)));
  return byClass.map((subject) => ({
    id: subject.id,
    name: subject.name,
    group: gradeName(subject.grade, d).label,
    chapters: subject.chapters.map((ch, i) => ({ id: ch.id, label: `${chapterLabel(ch, i, d, locale)}: ${ch.title}` })),
  }));
}

/** Chapter id → "অধ্যায় ৪: নিউটনিয়ান বলবিদ্যা", and subject id → "এইচএসসি · name", for listing questions. */
export function placeNames(subjects: SubjectWithChapters[], d: Dictionary, locale: Locale) {
  const subjectName = new Map(subjects.map((s) => [s.id, `${gradeName(s.grade, d).label} · ${s.name}`]));
  const chapterName = new Map(
    subjects.flatMap((s) => s.chapters.map((ch, i) => [ch.id, `${chapterLabel(ch, i, d, locale)}: ${ch.title}`] as const)),
  );
  return { subjectName, chapterName };
}
