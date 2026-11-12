import { type Dictionary, type Locale, formatNumber } from "@/i18n";

/** "অধ্যায় ৪" by position in the course, unless the teacher gave the chapter its own label. */
export function chapterLabel(chapter: { label: string }, index: number, d: Dictionary, locale: Locale): string {
  return chapter.label || d.dashboard.courses.chapters.defaultLabel(formatNumber(index + 1, locale));
}

/** "৪.১": a sub-chapter's number, from the chapter's and its own place in their lists. */
export function topicNumber(chapterIndex: number, topicIndex: number, locale: Locale): string {
  return `${formatNumber(chapterIndex + 1, locale)}.${formatNumber(topicIndex + 1, locale)}`;
}

/** "৪.১ বল ও গতির সূত্র": a chapter's sub-chapters as pages name them, by id and by number. */
export function topicLabels(chapter: { topics: { id: string; number: number; title: string }[] }, chapterIndex: number, locale: Locale) {
  return chapter.topics.map((topic, i) => ({ id: topic.id, number: topic.number, label: `${topicNumber(chapterIndex, i, locale)} ${topic.title}` }));
}
