import type { Dictionary, Locale } from "@/i18n";
import { formatNumber } from "@/i18n";
import { SUBJECT_GROUPS } from "@/lib/bank";
import { subjectAbbr, subjectTone } from "@/lib/bank-look";
import type { BankSubject } from "@/lib/bank-tree";
import { SECTION_TABS } from "@/lib/questions";
import type { QbSubjectCard } from "./subject-groups";

// Data the question bank's pages share between the dashboard and the website.

type SubjectRow = { id: string; grade: string; group: string; name: string };

/** The group tabs a class page needs: the groups its subjects use, in order, "other" last. */
export function groupTabs(subjects: { group: string }[], d: Dictionary): { key: string; label: string }[] {
  const present = new Set(subjects.map((s) => s.group || "none"));
  return [...SUBJECT_GROUPS, "none" as const].filter((g) => present.has(g)).map((g) => ({ key: g, label: d.bankGroups[g] }));
}

/** A subject's colour: by its place among its class's subjects, in the teacher's order. */
export function toneFor(subject: { id: string; grade: string }, all: SubjectRow[]) {
  const inClass = all.filter((s) => s.grade === subject.grade);
  return subjectTone(Math.max(0, inClass.findIndex((s) => s.id === subject.id)));
}

/** A subject's card on its class page. */
export function subjectCard(
  node: BankSubject<SubjectRow & { chapters: { id: string }[] }>,
  href: string,
  all: SubjectRow[],
  d: Dictionary,
  locale: Locale,
  meta: (chapters: string) => string,
): QbSubjectCard {
  const { subject } = node;
  return {
    id: subject.id,
    href,
    name: subject.name,
    abbr: subjectAbbr(subject.name),
    tone: toneFor(subject, all),
    meta: subject.chapters.length > 0 ? meta(formatNumber(subject.chapters.length, locale)) : d.qbank.chaptersSoon,
    group: subject.group || "none",
    chips: SECTION_TABS.filter((tab) => node.counts[tab] > 0).map((tab) => ({ tab, label: d.questions.tabsShort[tab] })),
  };
}
