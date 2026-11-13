import Link from "next/link";
import type { ReactNode } from "react";
import { GraduationCap, Shapes } from "lucide-react";
import { MathText } from "@/components/math-text";
import { RichContent } from "@/components/rich-content";
import { type Dictionary, type Locale, formatNumber, formatYear } from "@/i18n";
import { type ClassLook, type Tone, classLook } from "@/lib/bank-look";
import type { TabCounts } from "@/lib/bank-tree";
import {
  BANK_TABS,
  type BankTab,
  type ChapterFilters,
  DIFFICULTIES,
  SECTION_TABS,
  filterParams,
  tabOf,
} from "@/lib/questions";
import { type RichText, richPlain } from "@/lib/rich-text";
import type { Question } from "@/server/questions";
import { QbAutoPrint, QbPrintButton } from "./auto-print";
import { type QbChapterRow, QbChapterList } from "./chapter-list";
import { type QbFilterText, QbFilters } from "./filters";
import { QbBusy, QbNavProvider } from "./nav";
import { QbQuestionList } from "./question-list";
import { type QbSubjectCard, QbSubjectGroups } from "./subject-groups";
import type { QbCardData, QbListText } from "./types";
import { QbBadge, QbEyebrow, QbSubjectIcon, QbTitle, TONE, cx, qbButton } from "./ui";

// The question bank's pages in the QBank design, shared by the dashboard (the teacher's own bank,
// with tools to add and edit) and a teacher's website (public questions, for students). Each page
// builds its data and links; these draw it.

/** The page's language, and the voice its buttons speak in (দেখো to students, দেখুন to the teacher). */
export type QbCtx = {
  d: Dictionary;
  locale: Locale;
  voice: Dictionary["site"]["chapter"]["qb"];
  /** h1 on the website; h2 in the dashboard, whose top bar already has the h1. */
  titleAs: "h1" | "h2";
};

const intl = (locale: Locale) => (locale === "bn" ? "bn-BD" : "en-GB");

/** "০২", "02": a chapter's or class's number on its tile. */
export function pad2(n: number, locale: Locale): string {
  return new Intl.NumberFormat(intl(locale), { minimumIntegerDigits: 2, useGrouping: false }).format(n);
}

/** "ঢাকা বোর্ড · ২০২৪": a board question's tag on its card. */
export function boardTag(q: { board: string; year: number | null }, d: Dictionary, locale: Locale): string {
  const name = d.questions.boards[q.board as keyof Dictionary["questions"]["boards"]] ?? q.board;
  return q.year ? `${name} · ${formatYear(q.year, locale)}` : name;
}

/** "ঢাকা · ২০২৪": the same, shorter, for the board list. */
function shortBoardTag(q: { board: string; year: number | null }, d: Dictionary, locale: Locale): string {
  const name = d.questions.boardsShort[q.board as keyof Dictionary["questions"]["boardsShort"]] ?? q.board;
  return q.year ? `${name} · ${formatYear(q.year, locale)}` : name;
}

export function qbListText({ d, voice }: QbCtx): QbListText {
  return {
    showAnswer: voice.showAnswer,
    hideAnswer: voice.hideAnswer,
    showSolution: voice.showSolution,
    hideSolution: voice.hideSolution,
    showAll: voice.showAll,
    hideAll: voice.hideAll,
    resetAll: voice.resetAll,
    bookmark: voice.bookmark,
    bookmarked: voice.bookmarked,
    explanation: d.questions.explanation,
    answer: d.questions.answer,
    solution: d.questions.solution,
    video: d.questions.video,
    right: d.qbank.right,
    answersShown: d.qbank.answersShown,
    answersHidden: d.qbank.answersHidden,
    correctMark: d.qbank.correctMark,
    wrongMark: d.qbank.wrongMark,
  };
}

/**
 * A question as a card: its text typeset, its labels in the page's language. `topic` is its
 * sub-chapter's label ("৪.১ বল ও গতির সূত্র"), shown first among its tags.
 */
export function toCard(
  q: Question,
  number: number,
  { d, locale }: QbCtx,
  { topic, ...extra }: Pick<QbCardData, "tools" | "privateLabel"> & { topic?: string } = {},
): QbCardData {
  const tab = tabOf(q.type);
  const body = q.body;
  /** A text field drawn, or null when it's empty; `inline` for one that sits in a line. */
  const rich = (value: RichText | undefined | null, inline = false) => (value ? <RichContent value={value} inline={inline} /> : null);
  const base = {
    id: q.id,
    anchor: `q-${q.id}`,
    tab,
    badge: `${d.questions.tabsShort[tab]} ${formatNumber(number, locale)}`,
    topic,
    tags: q.board ? [boardTag(q, d, locale)] : q.source ? [q.source] : [],
    stem: <RichContent value={body.stem} />,
    image: body.image?.url ?? null,
    video: q.videoUrl || undefined,
    ...extra,
  };
  switch (q.type) {
    case "creative": {
      const parts = body.parts ?? [];
      return {
        ...base,
        kind: "cq",
        marks: d.qbank.marks(formatNumber(parts.reduce((sum, p) => sum + p.marks, 0), locale)),
        parts: parts.map((part, i) => ({
          key: d.questions.partKeys[i] ?? String(i + 1),
          text: <RichContent value={part.text} />,
          meta: `${d.questions.partLevels[i] ?? ""} · ${formatNumber(part.marks, locale)}`,
          answer: rich(part.solution),
        })),
      };
    }
    case "mcq":
    case "mcq_multi": {
      const answer = body.answer ?? 0;
      return {
        ...base,
        kind: "mcq",
        statements:
          q.type === "mcq_multi"
            ? (body.statements ?? []).map((s, i) => ({ key: d.questions.statementKeys[i] ?? String(i + 1), text: <RichContent value={s} inline /> }))
            : undefined,
        prompt: q.type === "mcq_multi" ? body.prompt || d.questions.defaultPrompt : undefined,
        options: (body.options ?? []).map((o, i) => ({ key: d.questions.optionKeys[i] ?? String(i + 1), text: <RichContent value={o} inline /> })),
        answerIndex: answer,
        wrongText: d.qbank.wrong(d.questions.optionKeys[answer] ?? String(answer + 1)),
        explanation: rich(body.explanation),
      };
    }
    case "short":
      return { ...base, kind: "sq", answer: rich(body.modelAnswer) };
    default:
      return { ...base, kind: "problem", answer: rich(body.finalAnswer, true), solution: rich(body.solution) };
  }
}

/* ── Classes: the bank's first page ─────────────────────────────────────────────────────── */

/**
 * A class's big number in its colour, read from its name ("দশম শ্রেণি" ১০, "এইচএসসি" ১১–১২), or an
 * icon for a class without one. Decoration: the class's name is always written beside it.
 */
export function QbClassNumber({ look, locale }: { look: ClassLook; locale: Locale }) {
  const tone = TONE[look.tone].text;
  if (!look.numbers) {
    const Icon = look.admission ? GraduationCap : Shapes;
    return <Icon className={cx("size-10", tone)} aria-hidden="true" />;
  }
  return (
    <span aria-hidden="true" className={cx("font-qb-display text-[34px] font-bold tracking-[-0.03em] @min-[640px]:text-[40px]", tone)}>
      {look.numbers.map((n) => pad2(n, locale)).join("–")}
    </span>
  );
}

/** The bank's first page: a white band with the title (and the dashboard's "নতুন শ্রেণি"), then a card per class. */
export function QbClassesView({
  ctx,
  crumbs,
  title,
  lead,
  actions,
  classes,
  heading,
  empty,
}: {
  ctx: QbCtx;
  crumbs?: ReactNode;
  title: string;
  lead?: string;
  /** Beside the title: the dashboard's "নতুন শ্রেণি". */
  actions?: ReactNode;
  classes: { id: string; name: string; href: string; line: string }[];
  heading: string;
  empty?: ReactNode;
}) {
  const { locale } = ctx;
  return (
    <main id="main" className="qb flex-1">
      <div className="border-b border-qb-line bg-qb-surface">
        <div className="qb-x flex flex-col gap-5 pt-7 pb-8">
          {crumbs}
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="flex max-w-[760px] flex-col gap-2">
              <QbTitle as={ctx.titleAs} size="lg">
                {title}
              </QbTitle>
              {lead && <p className="m-0 text-[18px] text-qb-muted">{lead}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
          </div>
        </div>
      </div>
      <section aria-labelledby="qb-classes" className="qb-x @container flex flex-col gap-6 pt-8 pb-16">
        <h2 id="qb-classes" className="m-0 font-qb-display text-[clamp(26px,5vw,34px)] font-bold tracking-[-0.02em]">
          {heading}
        </h2>
        {classes.length === 0 ? (
          empty
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4 @min-[640px]:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
            {classes.map(({ id, name, href, line }) => (
              <Link
                key={id}
                href={href}
                className="flex min-h-[150px] flex-col gap-3.5 rounded-2xl border border-qb-line bg-qb-surface p-[22px] text-qb-ink no-underline hover:border-qb-field hover:text-qb-ink"
              >
                <QbClassNumber look={classLook(name)} locale={locale} />
                <span className="mt-auto flex min-w-0 flex-col gap-0.5">
                  <span className="text-[18px] font-bold [overflow-wrap:anywhere]">{name}</span>
                  <span className="text-[14px] text-qb-subtle">{line}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

/* ── A class: its subjects ───────────────────────────────────────────────────────────────── */

export function QbClassView({
  ctx,
  crumbs,
  title,
  current,
  classes,
  groups,
  subjects,
  add,
  actions,
  aside,
  empty,
}: {
  ctx: QbCtx;
  crumbs: ReactNode;
  /** The class's name. */
  title: string;
  /** The class's id, to mark it in the switcher. */
  current: string;
  /** The class switcher: the classes this bank has. */
  classes: { id: string; name: string; href: string }[];
  groups: { key: string; label: string }[];
  subjects: QbSubjectCard[];
  add?: { href: string; label: string };
  /** Under the title: the dashboard's "শ্রেণির নাম বদলান". */
  actions?: ReactNode;
  /** Below the cards: the dashboard's "শ্রেণিটি সরান" for an empty class. */
  aside?: ReactNode;
  empty?: ReactNode;
}) {
  const { d } = ctx;
  return (
    <main id="main" className="qb flex-1">
      <div className="qb-x flex flex-col gap-7 pt-8 pb-16">
        {crumbs}
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex min-w-0 flex-col gap-1.5">
            <QbTitle as={ctx.titleAs} size="lg" className="[overflow-wrap:anywhere]">
              {title}
            </QbTitle>
            <p className="m-0 text-[18px] text-qb-muted">{ctx.voice.pickSubject}</p>
            {actions && <div className="mt-1.5 flex flex-wrap gap-2.5">{actions}</div>}
          </div>
          {classes.length > 1 && (
            <nav aria-label={d.qbank.classes} className="flex flex-wrap gap-1.5 rounded-xl border border-qb-line bg-qb-surface p-1.5">
              {classes.map((c) => {
                const on = c.id === current;
                return (
                  <Link
                    key={c.id}
                    href={c.href}
                    aria-current={on ? "page" : undefined}
                    className={cx(
                      "inline-flex h-11 items-center rounded-lg px-4 font-semibold no-underline",
                      on ? "bg-qb-ink text-white hover:text-white" : "text-qb-muted hover:bg-qb-page hover:text-qb-ink",
                    )}
                  >
                    {c.name}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
        {subjects.length === 0 && !add ? empty : <QbSubjectGroups groups={groups} subjects={subjects} label={d.qbank.groups} add={add} />}
        {aside}
      </div>
    </main>
  );
}

/* ── A subject: its chapters ─────────────────────────────────────────────────────────────── */

export function QbSubjectView({
  ctx,
  crumbs,
  name,
  abbr,
  tone,
  facts,
  actions,
  rows,
  empty,
}: {
  ctx: QbCtx;
  crumbs: ReactNode;
  name: string;
  abbr: string;
  tone: Tone;
  /** "এসএসসি · বিজ্ঞান বিভাগ · ১৪টি অধ্যায়" */
  facts: string[];
  actions?: ReactNode;
  rows: QbChapterRow[];
  empty: ReactNode;
}) {
  const { d, voice } = ctx;
  return (
    <main id="main" className="qb flex-1">
      <div className="border-b border-qb-line bg-qb-surface">
        <div className="qb-x flex flex-col gap-5 pt-7 pb-8">
          {crumbs}
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex min-w-0 items-center gap-[18px]">
              <QbSubjectIcon abbr={abbr} tone={tone} size="lg" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <QbTitle as={ctx.titleAs}>{name}</QbTitle>
                <span className="text-[17px] text-qb-muted">{facts.join(" · ")}</span>
              </div>
            </div>
            {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
          </div>
        </div>
      </div>
      <div className="qb-x flex flex-col gap-[18px] pt-7 pb-16">
        {rows.length === 0 ? (
          <>
            <h2 className="m-0 text-[22px] font-bold">{d.qbank.chaptersTitle}</h2>
            {empty}
          </>
        ) : (
          <QbChapterList
            rows={rows}
            text={{
              title: d.qbank.chaptersTitle,
              find: voice.findChapter,
              placeholder: voice.findPlaceholder,
              chapter: d.qbank.chaptersTitle,
              questions: d.qbank.questionsColumn,
              none: d.qbank.noQuestionsYet,
              noMatch: voice.noChapterMatch("{q}"),
            }}
          />
        )}
      </div>
    </main>
  );
}

/** A chapter row's chips: the tabs that have questions, "MCQ ১২" and so on. */
export function chapterChips(counts: TabCounts, { d, locale }: QbCtx): QbChapterRow["chips"] {
  return BANK_TABS.filter((tab) => counts[tab] > 0).map((tab) => ({ tab, text: `${d.questions.tabsShort[tab]} ${formatNumber(counts[tab], locale)}` }));
}

/** The words a chapter row's find box matches. */
export function chapterSearch(parts: Array<string | number>, locale: Locale): string {
  return parts
    .flatMap((p) => (typeof p === "number" ? [String(p), formatNumber(p, locale), pad2(p, locale)] : [p]))
    .join(" ")
    .toLowerCase();
}

/* ── A chapter: its questions, a tab at a time ───────────────────────────────────────────── */

export type QbChapterLinks = {
  /** The chapter page's address without a query. */
  path: string;
  prev?: { href: string; label: string };
  next?: { href: string; label: string };
};

export function qbFilterText({ d, locale }: QbCtx, pdf: string): QbFilterText {
  return {
    filters: d.qbank.filters,
    filtersOn: [0, 1, 2, 3, 4, 5].map((n) => d.qbank.filtersOn(formatNumber(n, locale))),
    topic: d.qbank.topic,
    allTopics: d.qbank.allTopics,
    reset: d.qbank.reset,
    source: d.qbank.source,
    sources: d.qbank.sources,
    board: d.qbank.board,
    allBoards: d.qbank.allBoards,
    year: d.qbank.year,
    allYears: d.qbank.allYears,
    difficulty: d.qbank.difficulty,
    anyDifficulty: d.qbank.anyDifficulty,
    difficulties: Object.fromEntries(DIFFICULTIES.map((k) => [k, d.questions.difficulties[k]])) as QbFilterText["difficulties"],
    pdf,
    pdfHint: d.qbank.pdfHint,
  };
}

export function QbChapterView({
  ctx,
  crumbs,
  eyebrow,
  eyebrowTone,
  title,
  links,
  headActions,
  tab,
  filters,
  topics = [],
  list,
  allCounts,
  pageSize,
  cards,
  listActions,
  emptyActions,
}: {
  ctx: QbCtx;
  /** The chapter's sub-chapters, for the filter. */
  topics?: { number: number; label: string }[];
  crumbs: ReactNode;
  /** "পদার্থবিজ্ঞান · অধ্যায় ০২" */
  eyebrow: string;
  eyebrowTone: Tone;
  title: string;
  links: QbChapterLinks;
  /** The dashboard's "ওয়েবসাইটে দেখুন". */
  headActions?: ReactNode;
  tab: BankTab;
  filters: ChapterFilters;
  list: { items: Question[]; total: number; page: number; counts: TabCounts; boards: string[]; years: number[] };
  /** Each tab's count without the filters, for "of N". */
  allCounts: TabCounts;
  pageSize: number;
  /** The tab's questions as cards (not used on the board tab). */
  cards: QbCardData[];
  /** Beside the show-all button: the dashboard's "নতুন …". */
  listActions?: ReactNode;
  /** In an empty tab: the dashboard's "নতুন …" again, where the list would be. */
  emptyActions?: ReactNode;
}) {
  const { d, locale } = ctx;
  const filterQuery = filterParams(filters);
  const href = (query: Record<string, string>) => `${links.path}?${new URLSearchParams(query)}`;
  const tabHref = (t: BankTab) => href({ tab: t, ...filterQuery });
  const pages = Math.max(1, Math.ceil(list.total / pageSize));
  const filtered = Object.keys(filterQuery).length > 0;
  const what = d.questions.tabNames[tab];

  const summary =
    tab === "board"
      ? [d.qbank.pastBoard, filters.board && filters.board !== "any" ? d.questions.boards[filters.board as keyof Dictionary["questions"]["boards"]] : null]
          .filter(Boolean)
          .join(" · ")
      : d.qbank.showing(what, formatNumber(allCounts[tab], locale), formatNumber(list.total, locale)) +
        (tab === "mcq" && list.total > 0 ? ` — ${ctx.voice.tapToCheck}` : "");

  const emptyNote = (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-qb-line bg-qb-surface px-6 py-10 text-center">
      <p className="m-0 font-semibold">{allCounts[tab] === 0 ? d.qbank.emptyTab(what) : d.qbank.noMatch(what)}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {allCounts[tab] > 0 && filtered && (
          <Link href={href({ tab })} className={cx(qbButton.outline, "h-11 px-4")}>
            {d.qbank.clearFilters}
          </Link>
        )}
        {emptyActions}
      </div>
    </div>
  );

  const pageNav = pages > 1 && (
    <nav aria-label={d.qbank.page(formatNumber(list.page, locale), formatNumber(pages, locale))} className="flex flex-wrap items-center gap-3" data-print-hide>
      {list.page > 1 && (
        <Link href={href({ tab, ...filterQuery, page: String(list.page - 1) })} className={cx(qbButton.outline, "h-11 px-4")}>
          {d.qbank.prevPage}
        </Link>
      )}
      <span className="text-[15px] text-qb-muted">{d.qbank.page(formatNumber(list.page, locale), formatNumber(pages, locale))}</span>
      {list.page < pages && (
        <Link href={href({ tab, ...filterQuery, page: String(list.page + 1) })} className={cx(qbButton.outline, "h-11 px-4")}>
          {d.qbank.nextPage}
        </Link>
      )}
    </nav>
  );

  return (
    <main id="main" className="qb flex-1">
      <QbNavProvider>
        <div className="bg-qb-surface" data-print-hide>
          <div className="qb-x flex flex-col gap-[18px] pt-6 pb-2">
            {crumbs}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <QbEyebrow className={TONE[eyebrowTone].text}>{eyebrow}</QbEyebrow>
                <QbTitle as={ctx.titleAs}>{title}</QbTitle>
              </div>
              <div className="flex flex-wrap gap-2">
                {headActions}
                {links.prev && (
                  <Link href={`${links.prev.href}?tab=${tab}`} className={cx(qbButton.outline, "h-[46px] px-3.5 text-[15px]")}>
                    {links.prev.label}
                  </Link>
                )}
                {links.next && (
                  <Link href={`${links.next.href}?tab=${tab}`} className={cx(qbButton.outline, "h-[46px] px-3.5 text-[15px]")}>
                    {links.next.label}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* The tabs stay in reach while the questions scroll under them. */}
        <div className="qb-tabs border-b border-qb-line bg-qb-surface" data-print-hide>
          <div className="qb-x @container">
            <nav aria-label={d.qbank.sections} className="qb-scroll flex gap-1 overflow-x-auto">
              {BANK_TABS.map((t) => {
                const on = t === tab;
                return (
                  <Link
                    key={t}
                    href={tabHref(t)}
                    scroll={false}
                    aria-current={on ? "page" : undefined}
                    title={d.questions.tabNames[t]}
                    className={cx(
                      "inline-flex h-[52px] shrink-0 items-center gap-2 border-b-[3px] px-3 text-[16px] font-semibold whitespace-nowrap no-underline focus-visible:-outline-offset-2 @min-[640px]:px-[18px]",
                      on ? "border-qb-accent text-qb-accent hover:text-qb-accent" : "border-transparent text-qb-muted hover:text-qb-ink",
                    )}
                  >
                    <span className="@min-[1000px]:hidden">{d.questions.tabsShort[t]}</span>
                    <span className="hidden @min-[1000px]:inline">{d.questions.tabs[t]}</span>
                    <span className={cx("rounded-full px-2 py-px text-[13px]", on ? "bg-qb-accent text-white" : "bg-qb-divider text-qb-muted")}>
                      {formatNumber(list.counts[t], locale)}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="qb-x @container flex flex-wrap items-start gap-7 pt-7 pb-16">
          <QbFilters
            path={links.path}
            tab={tab}
            filters={filters}
            topics={topics}
            boards={list.boards.map((b) => ({ key: b, label: d.questions.boards[b as keyof Dictionary["questions"]["boards"]] ?? b }))}
            years={list.years.map((y) => ({ value: y, label: formatYear(y, locale) }))}
            pdfHref={href({ print: "chapter", ...filterQuery })}
            text={qbFilterText(ctx, d.qbank.chapterPdf)}
          />
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
            {tab === "board" ? (
              <BoardTab ctx={ctx} links={links} filters={filters} list={list} summary={summary} href={href} emptyNote={emptyNote} />
            ) : (
              <QbQuestionList cards={cards} text={qbListText(ctx)} summary={summary} emptyNote={emptyNote} actions={listActions} />
            )}
            {pageNav}
          </div>
        </div>
      </QbNavProvider>
    </main>
  );
}

/** The board tab: board chips, then a row per board question with an Open link into its own tab. */
function BoardTab({
  ctx,
  links,
  filters,
  list,
  summary,
  href,
  emptyNote,
}: {
  ctx: QbCtx;
  links: QbChapterLinks;
  filters: ChapterFilters;
  list: { items: Question[]; boards: string[] };
  summary: string;
  href: (query: Record<string, string>) => string;
  emptyNote: ReactNode;
}) {
  const { d, locale, voice } = ctx;
  const filterQuery = filterParams(filters);
  const picked = filters.board && filters.board !== "any" ? filters.board : null;
  const chips = picked && !list.boards.includes(picked) ? [...list.boards, picked] : list.boards;
  const chipHref = (board: string | null) => {
    const query: Record<string, string> = { tab: "board", ...filterQuery };
    if (board) query.board = board;
    else delete query.board;
    return href(query);
  };
  const boardName = (b: string) => d.questions.boards[b as keyof Dictionary["questions"]["boards"]] ?? b;

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5" data-print-hide>
        <p className="m-0 text-qb-muted">{summary}</p>
        {list.items.length > 0 && (
          <Link href={href({ print: "board", ...filterQuery })} title={d.qbank.pdfHint} className={cx(qbButton.outline, "h-11 px-4")}>
            {d.qbank.boardPdf}
          </Link>
        )}
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={d.qbank.board}>
          {[null, ...chips].map((b) => {
            const on = (picked ?? null) === b;
            return (
              <Link
                key={b ?? "all"}
                href={chipHref(b)}
                scroll={false}
                aria-current={on ? "true" : undefined}
                className={cx(
                  "inline-flex h-10 items-center rounded-full border px-3.5 text-[14px] font-semibold no-underline",
                  on ? "border-qb-ink bg-qb-ink text-white hover:text-white" : "border-qb-field bg-qb-surface text-qb-ink hover:bg-qb-page hover:text-qb-ink",
                )}
              >
                {b ? boardName(b) : d.qbank.allBoards}
              </Link>
            );
          })}
        </div>
      )}
      {list.items.length === 0 ? (
        picked ? (
          <p className="m-0 rounded-2xl border border-qb-line bg-qb-surface px-5 py-7 text-center text-qb-subtle">{d.qbank.noneFromBoard(boardName(picked))}</p>
        ) : (
          emptyNote
        )
      ) : (
        <QbBusy className="overflow-hidden rounded-2xl border border-qb-line bg-qb-surface">
          <ul role="list" className="m-0 list-none p-0">
            {list.items.map((q) => {
              const section = tabOf(q.type);
              const open = `${links.path}?${new URLSearchParams({ tab: section, ...filterQuery, q: q.id })}#q-${q.id}`;
              return (
                <li key={q.id} className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-qb-divider px-5 py-4 last:border-b-0">
                  <QbBadge tab={section} className="min-w-[52px] text-center">
                    {d.questions.tabsShort[section]}
                  </QbBadge>
                  <span className="line-clamp-2 min-w-0 flex-[999_1_180px] @min-[640px]:line-clamp-1 @min-[640px]:flex-[999_1_300px]">
                    {/* One line: the stem's words and maths, without its tables or pictures. */}
                    <MathText text={richPlain(q.body.stem).replace(/\s+/g, " ")} />
                  </span>
                  <span className="shrink-0 rounded-md bg-qb-board-soft px-2.5 py-1 text-[13px] font-semibold text-qb-board">{shortBoardTag(q, d, locale)}</span>
                  <Link
                    href={open}
                    className="ml-auto inline-flex h-10 shrink-0 items-center rounded-lg border border-qb-field bg-qb-surface px-3.5 text-[14px] font-semibold text-qb-ink no-underline hover:bg-qb-page hover:text-qb-ink @min-[640px]:ml-0"
                  >
                    {voice.open}
                  </Link>
                </li>
              );
            })}
          </ul>
        </QbBusy>
      )}
    </section>
  );
}

/* ── The printout: every question the filters show, with answers ─────────────────────────── */

export function QbPrintView({
  ctx,
  owner,
  title,
  subtitle,
  questions,
  cut,
  back,
}: {
  ctx: QbCtx;
  /** The teacher's name, at the top of the sheet. */
  owner: string;
  title: string;
  subtitle: string;
  questions: Question[];
  /** True when the list stopped at the printout's limit. */
  cut: boolean;
  back: string;
}) {
  const { d, locale } = ctx;
  const sections = SECTION_TABS.map((tab) => ({ tab, items: questions.filter((q) => tabOf(q.type) === tab) })).filter((s) => s.items.length > 0);
  /** A labelled answer under its question: the label, then the rich text (which may be several blocks). */
  const answer = (label: string, value: RichText | undefined, inline = false) =>
    value ? (
      <div className="mt-1 pl-4 text-[13px] text-qb-muted">
        <b>{label}</b> <RichContent value={value} inline={inline} />
      </div>
    ) : null;

  return (
    <main id="main" className="qb flex-1">
      <QbAutoPrint />
      <div className="qb-x flex flex-col gap-6 pt-8 pb-16 print:p-0">
        <div className="flex flex-wrap gap-2.5" data-print-hide>
          <QbPrintButton label={ctx.voice.printAgain} className={cx(qbButton.accent, "h-11 px-4")} />
          <Link href={back} className={cx(qbButton.outline, "h-11 px-4")}>
            {ctx.voice.backToChapter}
          </Link>
        </div>
        <article data-print-sheet className="w-full max-w-[860px] rounded-2xl border border-qb-line bg-qb-surface p-8 text-[14px] leading-[1.6] print:max-w-none print:rounded-none print:border-0 print:p-0">
          <header className="mb-5 border-b-2 border-qb-ink pb-2">
            <p className="m-0 text-[12px] font-semibold tracking-[0.06em] text-qb-muted uppercase">{owner}</p>
            <h1 className="m-0 font-qb-display text-[24px] font-bold">{title}</h1>
            <p className="m-0 text-[13px] text-qb-muted">{subtitle}</p>
          </header>
          {sections.length === 0 && <p>{d.qbank.printEmpty}</p>}
          {sections.map(({ tab, items }) => (
            <section key={tab} className="mb-6">
              <h2 className="m-0 mb-2 text-[14px] font-bold tracking-[0.04em] uppercase">{d.questions.tabNames[tab]}</h2>
              <ol className="m-0 flex list-none flex-col gap-4 p-0">
                {items.map((q, i) => {
                  const body = q.body;
                  const tags = [q.board ? boardTag(q, d, locale) : q.source].filter(Boolean).join(", ");
                  return (
                    <li key={q.id} className="break-inside-avoid">
                      <p className="m-0 font-bold">
                        {d.questions.tabsShort[tab]} {formatNumber(i + 1, locale)}
                        {tags && <span className="font-normal"> · {tags}</span>}
                      </p>
                      <div className="mt-1">
                        <RichContent value={body.stem} />
                        {body.image && (
                          // eslint-disable-next-line @next/next/no-img-element -- the teacher's own upload
                          <img src={body.image.url} alt="" className="rich-img mt-1 max-h-[260px]" />
                        )}
                      </div>
                      {q.type === "mcq_multi" && (
                        <>
                          {(body.statements ?? []).map((s, k) => (
                            <p key={k} className="m-0 pl-4">
                              {d.questions.statementKeys[k]}. <RichContent value={s} inline />
                            </p>
                          ))}
                          <p className="m-0">{body.prompt || d.questions.defaultPrompt}</p>
                        </>
                      )}
                      {(q.type === "mcq" || q.type === "mcq_multi") && (
                        <>
                          <div className="mt-1 grid grid-cols-2 gap-x-4">
                            {(body.options ?? []).map((o, k) => (
                              <span key={k}>
                                {d.questions.optionKeys[k]}. <RichContent value={o} inline />
                              </span>
                            ))}
                          </div>
                          <p className="m-0 mt-1 pl-4 text-[13px] text-qb-muted">
                            <b>{d.questions.answer}</b> {d.questions.optionKeys[body.answer ?? 0]}
                          </p>
                          {answer(d.questions.explanation, body.explanation)}
                        </>
                      )}
                      {q.type === "creative" &&
                        (body.parts ?? []).map((part, k) => (
                          <div key={k} className="mt-1">
                            <div className="flex gap-1.5">
                              <span>{d.questions.partKeys[k]}.</span>
                              <div className="min-w-0 flex-1">
                                <RichContent value={part.text} />
                              </div>
                              <span className="shrink-0 text-qb-subtle">
                                ({d.questions.partLevels[k]} · {formatNumber(part.marks, locale)})
                              </span>
                            </div>
                            {answer(d.questions.answer, part.solution)}
                          </div>
                        ))}
                      {q.type === "short" && answer(d.questions.answer, body.modelAnswer)}
                      {(q.type === "textbook" || q.type === "practice") && (
                        <>
                          {answer(d.questions.answer, body.finalAnswer, true)}
                          {answer(d.questions.solution, body.solution)}
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {cut && <p className="m-0 text-[13px] text-qb-muted">{d.qbank.printCut(formatNumber(questions.length, locale))}</p>}
        </article>
      </div>
    </main>
  );
}

/** The printout's line under its title: what it holds and which filters made it (`topic`: the sub-chapter's label). */
export function printSubtitle({ d, locale }: QbCtx, filters: ChapterFilters, boardOnly: boolean, topic?: string): string {
  const parts: string[] = [boardOnly ? d.qbank.printBoard : d.qbank.printAll];
  if (topic) parts.push(topic);
  if (filters.sources) parts.push(filters.sources.map((s) => d.qbank.sources[s]).join(", ") || "—");
  if (filters.board && filters.board !== "any") parts.push(d.questions.boards[filters.board as keyof Dictionary["questions"]["boards"]] ?? filters.board);
  if (filters.year) parts.push(formatYear(filters.year, locale));
  if (filters.difficulty) parts.push(d.questions.difficulties[filters.difficulty]);
  return parts.join(" · ");
}
