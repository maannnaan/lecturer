import "server-only";
import type { Dictionary, Locale } from "@/i18n";
import { chapterLabel, topicLabels } from "@/lib/chapter-label";
import type { BankClass, SubjectWithChapters } from "@/server/bank";
import type { SubjectChoice } from "./question-form";

/**
 * The bank's subjects and their chapters as the question editor lists them, grouped by class:
 * "এইচএসসি › পদার্থবিজ্ঞান ১ম পত্র", then "অধ্যায় ৪: নিউটনিয়ান বলবিদ্যা". `classes` come in the bank's order.
 */
export function subjectChoices(subjects: SubjectWithChapters[], classes: BankClass[], d: Dictionary, locale: Locale): SubjectChoice[] {
  const order = new Map(classes.map((c, i) => [c.id, i]));
  const names = new Map(classes.map((c) => [c.id, c.name]));
  // Stable sort: classes in the bank's order, subjects in the teacher's order within each.
  const byClass = [...subjects].sort((a, b) => (order.get(a.classId) ?? 0) - (order.get(b.classId) ?? 0));
  return byClass.map((subject) => ({
    id: subject.id,
    name: subject.name,
    group: names.get(subject.classId) ?? "",
    chapters: subject.chapters.map((ch, i) => ({
      id: ch.id,
      label: `${chapterLabel(ch, i, d, locale)}: ${ch.title}`,
      topics: topicLabels(ch, i, locale).map(({ id, label }) => ({ id, label })),
    })),
  }));
}
