import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListChecks } from "lucide-react";
import { Crumbs } from "@/components/bank-ui";
import { formatNumber, formatYear, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { totalOf } from "@/lib/bank-tree";
import { chapterLabel } from "@/lib/chapter-label";
import { asciiDigits } from "@/lib/digits";
import { gradeName } from "@/lib/grades";
import { BANK_TABS, BOARDS, type BankTab, isMcq, tabFromParam } from "@/lib/questions";
import { getDb } from "@/server/db";
import { CHAPTER_PAGE_SIZE, listChapterQuestions } from "@/server/questions";
import { QuestionCard } from "../../../../question-card";
import { getPageSubject } from "../data";

export const instant = false;

type Params = Promise<{ handle: string; grade: string; subject: string; chapter: string }>;
type Search = Promise<{ tab?: string; board?: string; year?: string; page?: string }>;

async function getPageChapter(handle: string, grade: string, subject: string, chapterNumber: string) {
  const found = await getPageSubject(handle, grade, subject);
  if (!found || !/^\d{1,6}$/.test(chapterNumber)) return null;
  const index = found.node.subject.chapters.findIndex((ch) => ch.number === Number(chapterNumber));
  return index < 0 ? null : { ...found, chapter: found.node.subject.chapters[index], index };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { handle, grade, subject, chapter } = await params;
  const found = await getPageChapter(handle, grade, subject, chapter);
  if (!found || found.teacher.status !== "approved") return { robots: { index: false } };
  const s = found.node.subject;
  return {
    title: { absolute: `${found.chapter.title} — ${s.name} · ${found.teacher.nameBn}` },
    alternates: { canonical: `/${found.teacher.handle}/bank/${grade}/${s.number}/${found.chapter.number}` },
  };
}

/** One chapter of a bank subject on the website: its public questions, a section at a time. */
export default async function SiteBankChapterPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { handle, grade, subject: subjectNumber, chapter: chapterNumber } = await params;
  const found = await getPageChapter(handle, grade, subjectNumber, chapterNumber);
  if (!found) notFound();
  const { teacher, node, chapter, index } = found;
  const { subject } = node;
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);
  const c = d.site.chapter;
  const s = await searchParams;
  const db = await getDb();

  // Old links (?tab=problem, ?tab=board…) still land on the matching section.
  const asked = tabFromParam(s.tab);
  const board = asked?.anyBoard ? "any" : s.board === "any" || (BOARDS as readonly string[]).includes(s.board ?? "") ? s.board : undefined;
  const yearText = asciiDigits(s.year ?? "");
  const year = /^\d{4}$/.test(yearText) ? Number(yearText) : undefined;
  const page = Math.max(1, Number(asciiDigits(s.page ?? "")) || 1);

  const place = { subjectId: subject.id, chapterId: chapter.id };
  let tab: BankTab = asked?.tab ?? BANK_TABS[0];
  let list = await listChapterQuestions(db, teacher.id, place, { tab, board, year, page });
  if (!asked && list.counts[tab] === 0) {
    // No section asked for: open the first one that has questions.
    const first = BANK_TABS.find((t) => list.counts[t] > 0);
    if (first) {
      tab = first;
      list = await listChapterQuestions(db, teacher.id, place, { tab, board, year, page });
    }
  }
  const total = totalOf(list.counts);
  const pages = Math.max(1, Math.ceil(list.total / CHAPTER_PAGE_SIZE));

  const home = `/${teacher.handle}`;
  const subjectPath = `${home}/bank/${grade}/${subject.number}`;
  const chapterPath = `${subjectPath}/${chapter.number}`;
  const label = chapterLabel(chapter, index, d, locale);
  const pageHref = (n: number) => {
    const query = new URLSearchParams({ tab });
    if (board) query.set("board", board);
    if (year) query.set("year", String(year));
    if (n > 1) query.set("page", String(n));
    return `${chapterPath}?${query}`;
  };

  return (
    <main>
      <div className="wrap">
        <Crumbs
          label={d.common.breadcrumb}
          items={[
            { label: locale === "bn" ? teacher.nameBn : teacher.nameEn, href: home },
            { label: d.site.bank.title, href: `${home}/bank` },
            { label: gradeName(grade, d).label, href: `${home}/bank/${grade}` },
            { label: subject.name, href: subjectPath },
            { label },
          ]}
        />

        <div className="ch-layout">
          <nav className="card ch-nav" aria-label={c.chapters}>
            <p className="ch-nav-title">{c.chapters}</p>
            {subject.chapters.map((ch, i) => (
              <Link
                key={ch.id}
                href={`${subjectPath}/${ch.number}`}
                className={ch.id === chapter.id ? "on" : undefined}
                aria-current={ch.id === chapter.id ? "page" : undefined}
              >
                <span className="n">{formatNumber(i + 1, locale)}</span>
                <span>{ch.title}</span>
                <span className="tick" />
              </Link>
            ))}
          </nav>

          <section className="min-w-0" aria-labelledby="chapter-title">
            <div className="ch-head">
              <p className="ch-course">
                <Link href={subjectPath}>{subject.name}</Link> · {label}
              </p>
              <h1 id="chapter-title">{chapter.title}</h1>
              {total > 0 && (
                <p className="ch-stats">
                  <span>
                    <ListChecks aria-hidden="true" />
                    {c.questions(formatNumber(total, locale))}
                  </span>
                </p>
              )}
            </div>

            {total === 0 ? (
              <p className="card mt-6 p-6 text-ink-2">{c.empty}</p>
            ) : (
              <>
                <nav className="tabs" aria-label={c.sections}>
                  {BANK_TABS.filter((t) => list.counts[t] > 0).map((t) => (
                    <Link
                      key={t}
                      href={`${chapterPath}?tab=${t}`}
                      className={t === tab ? "tab on" : "tab"}
                      aria-current={t === tab ? "page" : undefined}
                      title={d.questions.tabNames[t]}
                      scroll={false}
                    >
                      {d.questions.tabs[t]}
                      <span className="count">{formatNumber(list.counts[t], locale)}</span>
                    </Link>
                  ))}
                </nav>

                {list.boards.length > 0 && (
                  <form key={`${tab}-${board ?? ""}-${year ?? ""}`} method="get" className="filters" aria-label={c.board}>
                    <input type="hidden" name="tab" value={tab} />
                    <label className="select">
                      {c.board}:
                      <select name="board" defaultValue={board ?? ""}>
                        <option value="">{c.allQuestions}</option>
                        <option value="any">{c.boardOnly}</option>
                        {list.boards.map((b) => (
                          <option key={b} value={b}>
                            {d.questions.boards[b as keyof typeof d.questions.boards] ?? b}
                          </option>
                        ))}
                      </select>
                    </label>
                    {list.years.length > 0 && (
                      <label className="select">
                        {c.year}:
                        <select name="year" defaultValue={year ? String(year) : ""}>
                          <option value="">{c.allYears}</option>
                          {list.years.map((y) => (
                            <option key={y} value={y}>
                              {formatYear(y, locale)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <button type="submit" className="btn btn-ghost btn-sm">
                      {c.filter}
                    </button>
                  </form>
                )}

                {list.items.some((q) => isMcq(q.type)) && <p className="mt-4 text-[14.5px] text-muted">{c.practiceHint}</p>}

                {list.items.length === 0 ? (
                  <p className="card mt-6 p-6 text-ink-2">{c.emptyTab}</p>
                ) : (
                  <div className="q-list">
                    {list.items.map((question, i) => (
                      <QuestionCard
                        key={question.id}
                        question={question}
                        number={(page - 1) * CHAPTER_PAGE_SIZE + i + 1}
                        d={d}
                        locale={locale}
                      />
                    ))}
                  </div>
                )}

                {pages > 1 && (
                  <nav className="mt-6 flex flex-wrap items-center gap-3" aria-label={c.chapters}>
                    {page > 1 && (
                      <Link href={pageHref(page - 1)} className="btn btn-ghost btn-sm">
                        {c.prev}
                      </Link>
                    )}
                    <span className="text-[15px] text-muted">
                      {formatNumber(page, locale)} / {formatNumber(pages, locale)}
                    </span>
                    {page < pages && (
                      <Link href={pageHref(page + 1)} className="btn btn-ghost btn-sm">
                        {c.next}
                      </Link>
                    )}
                  </nav>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
