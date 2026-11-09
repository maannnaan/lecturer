import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, Plus } from "lucide-react";
import { Crumbs } from "@/components/bank-ui";
import { formatNumber, formatYear, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { totalOf } from "@/lib/bank-tree";
import { chapterLabel } from "@/lib/chapter-label";
import { asciiDigits } from "@/lib/digits";
import { gradeName, gradeOf } from "@/lib/grades";
import { BANK_TABS, BOARDS, type BankTab, tabFromParam, tabTypes } from "@/lib/questions";
import { requireTeacher } from "@/server/auth/current";
import { getSubject } from "@/server/bank";
import { getDb } from "@/server/db";
import { BANK_PAGE_SIZE, listChapterQuestions } from "@/server/questions";
import { QuestionRow } from "../../../question-row";

export const instant = false;

export const metadata: Metadata = { title: "প্রশ্নব্যাংক" };

type Params = Promise<{ subjectId: string; chapter: string }>;
type Search = Promise<{ tab?: string; board?: string; year?: string; page?: string }>;

/**
 * The bank's last level: one chapter's questions, a section at a time (textbook problems, practice
 * problems, MCQ, SQ, CQ), private ones included. `chapter` is a chapter id, or "unfiled" for the
 * subject's questions that sit in no chapter.
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
  const s = await searchParams;
  const asked = tabFromParam(s.tab);
  const board = asked?.anyBoard ? "any" : s.board === "any" || (BOARDS as readonly string[]).includes(s.board ?? "") ? s.board : undefined;
  const yearText = asciiDigits(s.year ?? "");
  const year = /^\d{4}$/.test(yearText) ? Number(yearText) : undefined;
  const page = Math.max(1, Number(asciiDigits(s.page ?? "")) || 1);

  const place = { subjectId: subject.id, chapterId: chapter?.id ?? null };
  const options = { board, year, page, pageSize: BANK_PAGE_SIZE, includePrivate: true };
  let tab: BankTab = asked?.tab ?? BANK_TABS[0];
  let list = await listChapterQuestions(db, teacher.id, place, { ...options, tab });
  if (!asked && list.counts[tab] === 0) {
    // No section asked for: open the first one that has questions.
    const first = BANK_TABS.find((x) => list.counts[x] > 0);
    if (first) {
      tab = first;
      list = await listChapterQuestions(db, teacher.id, place, { ...options, tab });
    }
  }
  const pages = Math.max(1, Math.ceil(list.total / BANK_PAGE_SIZE));
  const filtered = Boolean(board || year);

  const grade = gradeOf(subject);
  const label = chapter ? chapterLabel(chapter, index, d, locale) : t.unfiled;
  const path = `/dashboard/bank/subject/${subject.id}/${chapter?.id ?? "unfiled"}`;
  const href = (extra: { tab?: BankTab; page?: number }) => {
    const query = new URLSearchParams({ tab: extra.tab ?? tab });
    if (!extra.tab) {
      if (board) query.set("board", board);
      if (year) query.set("year", String(year));
    }
    if (extra.page && extra.page > 1) query.set("page", String(extra.page));
    return `${path}?${query}`;
  };
  const newHref = (type: string) => {
    const query = new URLSearchParams({ type, subject: subject.id });
    if (chapter) query.set("chapter", chapter.id);
    return `/dashboard/bank/new?${query}`;
  };
  const onSite = chapter && list.counts[tab] > 0 ? `/${teacher.handle}/bank/${grade}/${subject.number}/${chapter.number}?tab=${tab}` : null;

  return (
    <main className="dash-content">
      <Crumbs
        className="crumbs !pt-0"
        label={d.common.breadcrumb}
        items={[
          { label: t.title, href: "/dashboard/bank" },
          { label: gradeName(grade, d).label, href: `/dashboard/bank/class/${grade}` },
          { label: subject.name, href: `/dashboard/bank/subject/${subject.id}` },
          { label },
        ]}
      />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {chapter && <p className="text-[14px] font-semibold text-muted">{`${subject.name} · ${label}`}</p>}
          <h2 className="text-2xl">{chapter?.title ?? t.unfiled}</h2>
          <p className="mt-1 text-[15px] text-ink-2">{t.total(formatNumber(totalOf(list.counts), locale))}</p>
        </div>
        {onSite && (
          <Link href={onSite} className="btn btn-ghost btn-sm">
            <Eye aria-hidden="true" />
            {t.viewOnSite}
          </Link>
        )}
      </header>

      <div>
        <nav className="tabs !mt-0" aria-label={d.site.chapter.sections}>
          {BANK_TABS.map((x) => (
            <Link
              key={x}
              href={href({ tab: x })}
              className={x === tab ? "tab on" : "tab"}
              aria-current={x === tab ? "page" : undefined}
              title={d.questions.tabNames[x]}
            >
              {d.questions.tabs[x]}
              <span className="count">{formatNumber(list.counts[x], locale)}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {tabTypes(tab).map((type) => (
            <Link key={type} href={newHref(type)} className="btn btn-primary btn-sm">
              <Plus aria-hidden="true" />
              {t.addTo(d.questions.types[type])}
            </Link>
          ))}
        </div>

        {list.boards.length > 0 && (
          <form key={`${tab}-${board ?? ""}-${year ?? ""}`} method="get" className="filters" aria-label={t.filters.board}>
            <input type="hidden" name="tab" value={tab} />
            <label className="select">
              {t.filters.board}:
              <select name="board" defaultValue={board ?? ""}>
                <option value="">{t.filters.allQuestions}</option>
                <option value="any">{t.filters.anyBoard}</option>
                {list.boards.map((b) => (
                  <option key={b} value={b}>
                    {d.questions.boards[b as keyof typeof d.questions.boards] ?? b}
                  </option>
                ))}
              </select>
            </label>
            {list.years.length > 0 && (
              <label className="select">
                {t.filters.year}:
                <select name="year" defaultValue={year ? String(year) : ""}>
                  <option value="">{t.filters.allYears}</option>
                  {list.years.map((y) => (
                    <option key={y} value={y}>
                      {formatYear(y, locale)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="submit" className="btn btn-ghost btn-sm">
              {t.filters.show}
            </button>
          </form>
        )}
      </div>

      {list.items.length === 0 ? (
        <p className="card p-6 text-ink-2">{filtered ? t.noMatch : t.emptySection(d.questions.tabNames[tab])}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.items.map((question, i) => (
            <QuestionRow
              key={question.id}
              question={question}
              d={d}
              locale={locale}
              // Up/down changes the order students see, so only on the whole, unfiltered section.
              move={filtered ? undefined : { first: page === 1 && i === 0, last: page === pages && i === list.items.length - 1 }}
            />
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex flex-wrap items-center gap-3" aria-label={t.page(formatNumber(page, locale), formatNumber(pages, locale))}>
          {page > 1 && (
            <Link href={href({ page: page - 1 })} className="btn btn-ghost btn-sm">
              {t.prev}
            </Link>
          )}
          <span className="text-[15px] text-muted">{t.page(formatNumber(page, locale), formatNumber(pages, locale))}</span>
          {page < pages && (
            <Link href={href({ page: page + 1 })} className="btn btn-ghost btn-sm">
              {t.next}
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
