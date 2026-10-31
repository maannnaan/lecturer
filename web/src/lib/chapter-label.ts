import { type Dictionary, type Locale, formatNumber } from "@/i18n";

/** "অধ্যায় ৪" by position in the course, unless the teacher gave the chapter its own label. */
export function chapterLabel(chapter: { label: string }, index: number, d: Dictionary, locale: Locale): string {
  return chapter.label || d.dashboard.courses.chapters.defaultLabel(formatNumber(index + 1, locale));
}
