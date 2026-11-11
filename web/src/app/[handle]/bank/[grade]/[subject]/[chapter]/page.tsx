import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { toneFor } from "@/components/qbank/build";
import { QbCrumbs } from "@/components/qbank/ui";
import { type QbCtx, QbChapterView, QbPrintView, pad2, printSubtitle, toCard } from "@/components/qbank/views";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { chapterLabel } from "@/lib/chapter-label";
import { asciiDigits } from "@/lib/digits";
import { gradeName } from "@/lib/grades";
import { SECTION_TABS, filtersFromParams, tabFromParam } from "@/lib/questions";
import { getDb } from "@/server/db";
import { CHAPTER_PAGE_SIZE, PRINT_LIMIT, listChapterForPrint, listChapterQuestions } from "@/server/questions";
import { getSiteSubjects } from "../../../../data";
import { getPageSubject } from "../data";

export const instant = false;

type Params = Promise<{ handle: string; grade: string; subject: string; chapter: string }>;
type Search = Promise<{ tab?: string; board?: string; year?: string; diff?: string; src?: string; page?: string; q?: string; print?: string }>;

async function getPageChapter(handle: string, grade: string, subject: string, chapterNumber: string) {
  const found = await getPageSubject(handle, grade, subject);
  if (!found || !/^\d{1,6}$/.test(chapterNumber)) return null;
  const index = found.node.subject.chapters.findIndex((ch) => ch.number === Number(chapterNumber));
  return index < 0 ? null : { ...found, chapter: found.node.subject.chapters[index], index };
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const { handle, grade, subject, chapter } = await params;
  const found = await getPageChapter(handle, grade, subject, chapter);
  if (!found || found.teacher.status !== "approved") return { robots: { index: false } };
  const s = found.node.subject;
  const printing = Boolean((await searchParams).print);
  return {
    title: { absolute: `${found.chapter.title} — ${s.name} · ${found.teacher.nameBn}` },
    alternates: { canonical: `/${found.teacher.handle}/bank/${grade}/${s.number}/${found.chapter.number}` },
    robots: printing ? { index: false } : undefined,
  };
}

/**
 * One chapter of a bank subject on the website: its public questions, a tab at a time, with the
 * filters, answers to reveal and MCQs to check. `?print=chapter|board` is the printable sheet.
 */
export default async function SiteBankChapterPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { handle, grade, subject: subjectNumber, chapter: chapterNumber } = await params;
  const found = await getPageChapter(handle, grade, subjectNumber, chapterNumber);
  if (!found) notFound();
  const { teacher, node, chapter, index } = found;
  const { subject } = node;
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);
  const ctx: QbCtx = { d, locale, voice: d.site.chapter.qb, titleAs: "h1" };
  const s = await searchParams;
  const db = await getDb();

  const home = `/${teacher.handle}`;
  const subjectPath = `${home}/bank/${grade}/${subject.number}`;
  const path = `${subjectPath}/${chapter.number}`;
  const label = chapterLabel(chapter, index, d, locale);
  const place = { subjectId: subject.id, chapterId: chapter.id };
  const filters = filtersFromParams(s);
  const owner = locale === "bn" ? teacher.nameBn : teacher.nameEn;

  if (s.print === "chapter" || s.print === "board") {
    const boardOnly = s.print === "board";
    const questions = await listChapterForPrint(db, teacher.id, place, { boardOnly, filters });
    return (
      <QbPrintView
        ctx={ctx}
        owner={owner}
        title={d.qbank.printTitle(subject.name, `${label}: ${chapter.title}`)}
        subtitle={printSubtitle(ctx, filters, boardOnly)}
        questions={questions}
        cut={questions.length >= PRINT_LIMIT}
        back={`${path}?${new URLSearchParams({ tab: boardOnly ? "board" : (tabFromParam(s.tab) ?? "textbook") })}`}
      />
    );
  }

  const allCounts = node.chapters[index].counts;
  // No tab asked for: open the first one that has questions.
  const tab = tabFromParam(s.tab) ?? SECTION_TABS.find((t) => allCounts[t] > 0) ?? SECTION_TABS[0];
  const page = Math.max(1, Number(asciiDigits(s.page ?? "")) || 1);
  const list = await listChapterQuestions(db, teacher.id, place, { tab, filters, page, focus: s.q });
  const all = await getSiteSubjects(teacher.id);
  const chapters = subject.chapters;
  const prev = chapters[index - 1];
  const next = chapters[index + 1];

  return (
    <QbChapterView
      ctx={ctx}
      crumbs={
        <QbCrumbs
          label={d.common.breadcrumb}
          items={[
            { label: owner, href: home },
            { label: d.site.bank.title, href: `${home}/bank` },
            { label: gradeName(grade, d).label, href: `${home}/bank/${grade}` },
            { label: subject.name, href: subjectPath },
            { label },
          ]}
        />
      }
      eyebrow={`${subject.name} · ${d.qbank.chapter(pad2(index + 1, locale))}`}
      eyebrowTone={toneFor(subject, all)}
      title={chapter.title}
      links={{
        path,
        prev: prev && { href: `${subjectPath}/${prev.number}`, label: d.qbank.prevChapter(formatNumber(index, locale)) },
        next: next && { href: `${subjectPath}/${next.number}`, label: d.qbank.nextChapter(formatNumber(index + 2, locale)) },
      }}
      tab={tab}
      filters={filters}
      list={list}
      allCounts={allCounts}
      pageSize={CHAPTER_PAGE_SIZE}
      cards={tab === "board" ? [] : list.items.map((q, i) => toCard(q, (list.page - 1) * CHAPTER_PAGE_SIZE + i + 1, ctx))}
    />
  );
}
