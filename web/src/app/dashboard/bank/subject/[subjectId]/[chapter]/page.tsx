import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronUp, Copy, Pencil } from "lucide-react";
import { PendingButton } from "@/components/form";
import { toneFor } from "@/components/qbank/build";
import { QbCrumbs, cx, qbButton } from "@/components/qbank/ui";
import { type QbCtx, QbChapterView, QbPrintView, pad2, printSubtitle, toCard } from "@/components/qbank/views";
import { type Dictionary, formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { subjectNode } from "@/lib/bank-tree";
import { chapterLabel } from "@/lib/chapter-label";
import { asciiDigits } from "@/lib/digits";
import { SECTION_TABS, activeFilters, filtersFromParams, tabFromParam, tabTypes } from "@/lib/questions";
import { requireTeacher } from "@/server/auth/current";
import { getBankClass, getSubject, listSubjects } from "@/server/bank";
import { getDb } from "@/server/db";
import { BANK_PAGE_SIZE, type Question, PRINT_LIMIT, bankCounts, listChapterForPrint, listChapterQuestions } from "@/server/questions";
import { duplicateQuestionAction, moveQuestionAction } from "../../../actions";

export const instant = false;

export const metadata: Metadata = { title: "প্রশ্নব্যাংক" };

type Params = Promise<{ subjectId: string; chapter: string }>;
type Search = Promise<{ tab?: string; board?: string; year?: string; diff?: string; src?: string; page?: string; q?: string; print?: string }>;

const tool =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-qb-field bg-qb-surface px-3 text-[14px] font-semibold text-qb-ink no-underline hover:bg-qb-page hover:text-qb-ink disabled:opacity-40 [&_svg]:size-4";

/** A question's tools in the teacher's bank: edit, copy, and (in the unfiltered list) move up or down. */
function Tools({ question, d, move }: { question: Question; d: Dictionary; move?: { first: boolean; last: boolean } }) {
  return (
    <>
      <Link href={`/dashboard/bank/${question.id}`} className={tool}>
        <Pencil aria-hidden="true" />
        {d.common.edit}
      </Link>
      <form action={duplicateQuestionAction}>
        <input type="hidden" name="questionId" value={question.id} />
        <PendingButton className={tool}>
          <Copy aria-hidden="true" />
          {d.dashboard.bank.duplicate}
        </PendingButton>
      </form>
      {move &&
        (["up", "down"] as const).map((dir) => (
          <form key={dir} action={moveQuestionAction}>
            <input type="hidden" name="questionId" value={question.id} />
            <input type="hidden" name="direction" value={dir} />
            <PendingButton
              className={cx(tool, "w-9 justify-center px-0")}
              disabled={dir === "up" ? move.first : move.last}
              aria-label={dir === "up" ? d.common.moveUp : d.common.moveDown}
            >
              {dir === "up" ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            </PendingButton>
          </form>
        ))}
    </>
  );
}

/**
 * The bank's last level: one chapter's questions, a tab at a time (textbook problems, practice
 * problems, MCQ, SQ, CQ, board questions), private ones included, with the teacher's tools. `chapter`
 * is a chapter id, or "unfiled" for the subject's questions in no chapter.
 */
export default async function BankChapterPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const teacher = await requireTeacher();
  const { subjectId, chapter: chapterParam } = await params;
  const db = await getDb();
  const subject = await getSubject(db, teacher.id, subjectId);
  if (!subject) notFound();
  const index = subject.chapters.findIndex((ch) => ch.id === chapterParam);
  if (index < 0 && chapterParam !== "unfiled") notFound();
  const chapter = index >= 0 ? subject.chapters[index] : null;

  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.bank;
  const ctx: QbCtx = { d, locale, voice: t.qb, titleAs: "h2" };
  const s = await searchParams;
  const label = chapter ? chapterLabel(chapter, index, d, locale) : t.unfiled;
  const path = `/dashboard/bank/subject/${subject.id}/${chapter?.id ?? "unfiled"}`;
  const place = { subjectId: subject.id, chapterId: chapter?.id ?? null };
  const filters = filtersFromParams(s);

  if (s.print === "chapter" || s.print === "board") {
    const boardOnly = s.print === "board";
    const questions = await listChapterForPrint(db, teacher.id, place, { boardOnly, filters, includePrivate: true });
    return (
      <QbPrintView
        ctx={ctx}
        owner={locale === "bn" ? teacher.nameBn : teacher.nameEn}
        title={d.qbank.printTitle(subject.name, chapter ? `${label}: ${chapter.title}` : label)}
        subtitle={printSubtitle(ctx, filters, boardOnly)}
        questions={questions}
        cut={questions.length >= PRINT_LIMIT}
        back={`${path}?${new URLSearchParams({ tab: boardOnly ? "board" : (tabFromParam(s.tab) ?? "textbook") })}`}
      />
    );
  }

  const [counts, all, bankClass] = await Promise.all([bankCounts(db, teacher.id), listSubjects(db, teacher.id), getBankClass(db, teacher.id, subject.classId)]);
  if (!bankClass) notFound();
  const node = subjectNode(subject, counts);
  const allCounts = chapter ? node.chapters[index].counts : node.unfiled.counts;
  const tab = tabFromParam(s.tab) ?? SECTION_TABS.find((x) => allCounts[x] > 0) ?? SECTION_TABS[0];
  const page = Math.max(1, Number(asciiDigits(s.page ?? "")) || 1);
  const list = await listChapterQuestions(db, teacher.id, place, { tab, filters, page, pageSize: BANK_PAGE_SIZE, includePrivate: true, focus: s.q });
  const pages = Math.max(1, Math.ceil(list.total / BANK_PAGE_SIZE));
  // Up/down changes the order students see, so only in a whole, unfiltered section.
  const movable = tab !== "board" && activeFilters(filters) === 0;

  const newHref = (type: string) => {
    const query = new URLSearchParams({ type, subject: subject.id });
    if (chapter) query.set("chapter", chapter.id);
    return `/dashboard/bank/new?${query}`;
  };
  const addButtons =
    tab === "board"
      ? null
      : tabTypes(tab).map((type) => (
          <Link key={type} href={newHref(type)} className={cx(qbButton.accent, "h-11 px-4")}>
            {t.addTo(d.questions.types[type])}
          </Link>
        ));
  const onSite = chapter && allCounts[tab] > 0 ? `/${teacher.handle}/bank/${bankClass.number}/${subject.number}/${chapter.number}?tab=${tab}` : null;
  const prev = chapter ? subject.chapters[index - 1] : undefined;
  const next = chapter ? subject.chapters[index + 1] : undefined;
  const subjectPath = `/dashboard/bank/subject/${subject.id}`;

  return (
    <QbChapterView
      ctx={ctx}
      crumbs={
        <QbCrumbs
          label={d.common.breadcrumb}
          items={[
            { label: t.title, href: "/dashboard/bank" },
            { label: bankClass.name, href: `/dashboard/bank/class/${bankClass.id}` },
            { label: subject.name, href: subjectPath },
            { label },
          ]}
        />
      }
      eyebrow={chapter ? `${subject.name} · ${d.qbank.chapter(pad2(index + 1, locale))}` : subject.name}
      eyebrowTone={toneFor(subject, all)}
      title={chapter?.title ?? t.unfiled}
      links={{
        path,
        prev: prev && { href: `${subjectPath}/${prev.id}`, label: d.qbank.prevChapter(formatNumber(index, locale)) },
        next: next && { href: `${subjectPath}/${next.id}`, label: d.qbank.nextChapter(formatNumber(index + 2, locale)) },
      }}
      headActions={
        onSite ? (
          <Link href={onSite} className={cx(qbButton.outline, "h-[46px] px-3.5 text-[15px]")}>
            {t.viewOnSite}
          </Link>
        ) : null
      }
      tab={tab}
      filters={filters}
      list={list}
      allCounts={allCounts}
      pageSize={BANK_PAGE_SIZE}
      cards={
        tab === "board"
          ? []
          : list.items.map((q, i) =>
              toCard(q, (list.page - 1) * BANK_PAGE_SIZE + i + 1, ctx, {
                privateLabel: q.visibility === "private" ? t.privateBadge : undefined,
                tools: (
                  <Tools
                    question={q}
                    d={d}
                    move={movable ? { first: list.page === 1 && i === 0, last: list.page === pages && i === list.items.length - 1 } : undefined}
                  />
                ),
              }),
            )
      }
      listActions={list.items.length > 0 ? addButtons : null}
      emptyActions={addButtons}
    />
  );
}
