"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { BoardList } from "@/components/questions/board-list";
import { PrintSheet, type PrintGroup } from "@/components/questions/print-sheet";
import { numberByType, QuestionCards } from "@/components/questions/question-cards";
import { toggleAllState, useAnswers } from "@/components/questions/use-answers";
import { button } from "@/components/ui";
import { cx } from "@/lib/cx";
import { TYPE_META } from "@/lib/format";
import {
  countByTab,
  DEFAULT_SOURCES,
  domId,
  matchesFilters,
  parseBoard,
  parseDifficulty,
  parseSources,
  parseTab,
  parseYear,
  sameSources,
  SOURCE_LABELS,
  TAB_KEYS,
  tabOfType,
  typeOfTab,
  type QuestionFilters,
  type TabKey,
} from "@/lib/questions";
import type { Question } from "@/lib/types";
import { FiltersPanel } from "./filters-panel";

export interface ChapterLink {
  no: number;
  href: string;
}

const TAB_LABELS: Record<TabKey, { short: string; full: string }> = {
  cq: { short: "CQ", full: TYPE_META.CQ.tab },
  mcq: { short: "MCQ", full: TYPE_META.MCQ.tab },
  sq: { short: "SQ", full: TYPE_META.SQ.tab },
  board: { short: "Board", full: "Board questions" },
};

type PrintScope = "chapter" | "board";

/**
 * Everything on a chapter page that responds to clicks. The tab and the filters live in the
 * address (?type=mcq&board=Dhaka&year=2024&diff=easy&src=board,school), so a link, a reload or
 * Back shows the same view; answers opened and options picked are kept while you switch tabs.
 */
export function ChapterView({
  crumbs,
  title,
  questions,
  boards,
  olderThan,
  prev,
  next,
  printTitle,
}: {
  crumbs: ReactNode;
  title: ReactNode;
  questions: Question[];
  boards: string[];
  olderThan: number;
  prev?: ChapterLink;
  next?: ChapterLink;
  printTitle: string;
}) {
  const pathname = usePathname();
  // The view follows its own copy of the query, updated the moment something is clicked. Next
  // applies history.pushState/replaceState in a transition, so reading only useSearchParams
  // would let checkboxes and selects snap back for a frame before showing the new value.
  const urlQs = useSearchParams().toString();
  const [qs, setQs] = useState(urlQs);
  const [lastUrlQs, setLastUrlQs] = useState(urlQs);
  if (urlQs !== lastUrlQs) {
    // The address changed from outside the view (Back, Forward, a link): follow it.
    setLastUrlQs(urlQs);
    setQs(urlQs);
  }
  const tab = parseTab(new URLSearchParams(qs).get("type"));

  const filters = useMemo<QuestionFilters>(() => {
    const p = new URLSearchParams(qs);
    return {
      sources: parseSources(p.get("src")),
      board: parseBoard(p.get("board"), boards),
      year: parseYear(p.get("year")),
      difficulty: parseDifficulty(p.get("diff")),
    };
  }, [qs, boards]);

  const numbers = useMemo(() => numberByType(questions), [questions]);
  const totals = useMemo(() => countByTab(questions), [questions]);
  const matching = useMemo(
    () => questions.filter((q) => matchesFilters(q, filters, olderThan)),
    [questions, filters, olderThan],
  );
  const counts = countByTab(matching);
  const boardRows = matching.filter((q) => q.boards.length > 0);
  const list = tab === "board" ? boardRows : matching.filter((q) => q.type === typeOfTab(tab));

  // Board chips: the boards this chapter has questions from (plus one picked in the sidebar).
  const chapterBoards = boards.filter((b) => questions.some((q) => q.boards.some((t) => t.board === b)));
  const chips = filters.board && !chapterBoards.includes(filters.board) ? [...chapterBoards, filters.board] : chapterBoards;
  const years = [...new Set(questions.flatMap((q) => q.boards.map((t) => t.year)))].sort((a, b) => b - a);

  const answers = useAnswers();
  const toggle = toggleAllState(list, answers.isShown);
  const tabRefs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});
  const pendingFocus = useRef<string | null>(null);
  const [printScope, setPrintScope] = useState<PrintScope>("chapter");

  /** Changes the address without a page load; the view re-renders from it. */
  const go = (changes: Record<string, string | null>, how: "push" | "replace", hash?: string) => {
    const query = new URLSearchParams(qs);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) query.delete(key);
      else query.set(key, value);
    }
    const search = query.toString();
    setQs(search);
    const url = `${pathname}${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`;
    if (how === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  };

  const selectTab = (next: TabKey) => {
    if (next !== tab) go({ type: next }, "push");
  };
  const onTabKey = (event: KeyboardEvent, index: number) => {
    const last = TAB_KEYS.length - 1;
    const to =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (to === null) return;
    event.preventDefault();
    selectTab(TAB_KEYS[to]);
    tabRefs.current[TAB_KEYS[to]]?.focus();
  };

  const setFilters = (changes: Record<string, string | null>) => go(changes, "replace");
  const reset = () => setFilters({ src: null, board: null, year: null, diff: null });

  /** "Open" on the board list: the question's own tab, scrolled to and flashed. */
  const openQuestion = (q: Question) => {
    pendingFocus.current = domId(q);
    go({ type: tabOfType(q.type) }, "push", domId(q));
  };

  useEffect(() => {
    // After "Open", or on arriving with #q-… in the address (from a search result).
    const id = pendingFocus.current ?? decodeURIComponent(window.location.hash.slice(1));
    pendingFocus.current = null;
    if (!id.startsWith("q-")) return;
    const el = document.getElementById(id);
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
    el.classList.remove("qb-flash");
    void el.offsetWidth; // restart the animation
    el.classList.add("qb-flash");
  }, [qs]);

  const print = (scope: PrintScope) => {
    flushSync(() => setPrintScope(scope));
    window.addEventListener("afterprint", () => setPrintScope("chapter"), { once: true });
    window.print();
  };

  const noun = (n: number) => (tab === "board" ? "" : n === 1 ? TYPE_META[typeOfTab(tab)].noun : TYPE_META[typeOfTab(tab)].nouns);
  const summary =
    tab === "board"
      ? filters.board
        ? `Past ${filters.board} board questions from this chapter`
        : "Past board questions from this chapter"
      : `Showing ${list.length} of ${totals[tab]} ${noun(totals[tab])}${tab === "mcq" && list.length > 0 ? " — tap an option to check" : ""}`;

  const printGroups: PrintGroup[] = (["CQ", "MCQ", "SQ"] as const).map((type) => ({
    heading: TYPE_META[type].tab,
    questions: (printScope === "board" ? boardRows : matching).filter((q) => q.type === type),
  }));
  const printNote = [
    printScope === "board" ? "Board questions" : sameSources(filters.sources, DEFAULT_SOURCES) ? "Board questions and top school tests" : filters.sources.map((s) => SOURCE_LABELS[s]).join(", ") || "No sources",
    filters.board,
    filters.year === "older" ? `Before ${olderThan}` : filters.year,
    filters.difficulty && filters.difficulty[0].toUpperCase() + filters.difficulty.slice(1),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className="border-b border-line bg-surface print:hidden">
        <div className="page-x flex flex-col gap-[18px] pt-6">
          {crumbs}
          <div className="flex flex-wrap items-end justify-between gap-4">
            {title}
            {(prev || next) && (
              <div className="flex gap-2">
                {prev && (
                  <Link href={`${prev.href}?type=${tab}`} className={cx(button.outline, "h-[46px] px-3.5 text-[15px]")}>
                    ← Ch {prev.no}
                  </Link>
                )}
                {next && (
                  <Link href={`${next.href}?type=${tab}`} className={cx(button.outline, "h-[46px] px-3.5 text-[15px]")}>
                    Ch {next.no} →
                  </Link>
                )}
              </div>
            )}
          </div>
          <div
            role="tablist"
            aria-label="Question type"
            className="scrollbar-none flex gap-1 overflow-x-auto min-[480px]:flex-wrap"
          >
            {TAB_KEYS.map((key, i) => {
              const on = key === tab;
              return (
                <button
                  key={key}
                  ref={(el) => {
                    tabRefs.current[key] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`tab-${key}`}
                  aria-selected={on}
                  aria-controls="questions-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => selectTab(key)}
                  onKeyDown={(e) => onTabKey(e, i)}
                  className={cx(
                    // Phones: four equal tabs with short names. Wider: the mockup's tabs.
                    "inline-flex h-[52px] flex-1 shrink-0 items-center justify-center gap-1.5 border-b-[3px] px-1 text-[16px] font-semibold whitespace-nowrap focus-visible:-outline-offset-2 min-[480px]:flex-none min-[480px]:gap-2 min-[480px]:px-3 sm:px-[18px]",
                    on ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink",
                  )}
                >
                  <span className="md:hidden">{TAB_LABELS[key].short}</span>
                  <span className="hidden md:inline">{TAB_LABELS[key].full}</span>
                  <span
                    className={cx(
                      "rounded-full px-2 py-px text-[13px]",
                      on ? "bg-accent text-white" : "bg-divider text-muted",
                    )}
                  >
                    {counts[key]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="page-x flex flex-wrap items-start gap-7 pt-7 pb-16 print:hidden">
        <FiltersPanel
          filters={filters}
          boards={boards}
          years={years}
          onSources={(sources) =>
            setFilters({ src: sameSources(sources, DEFAULT_SOURCES) ? null : sources.join(",") })
          }
          onBoard={(board) => setFilters({ board })}
          onYear={(year) => setFilters({ year: year === null ? null : String(year) })}
          onDifficulty={(diff) => setFilters({ diff })}
          onReset={reset}
          onPrint={() => print("chapter")}
        />

        <section
          id="questions-panel"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          className="flex min-w-0 flex-[999_1_560px] flex-col gap-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <p className="m-0 text-muted">{summary}</p>
            {tab === "board" ? (
              <button
                type="button"
                onClick={() => print("board")}
                disabled={list.length === 0}
                title="Opens the print dialog; choose “Save as PDF” to download"
                className={cx(button.outline, "h-11 px-4 disabled:opacity-50")}
              >
                Download board set
              </button>
            ) : (
              <button
                type="button"
                onClick={() => answers.toggleAll(list)}
                disabled={list.length === 0}
                className={cx(button.outline, "h-11 px-4 disabled:opacity-50")}
              >
                {toggle.label}
              </button>
            )}
          </div>

          {tab === "board" ? (
            <BoardList
              chips={chips}
              filters={filters}
              olderThan={olderThan}
              rows={list}
              onBoard={(board) => setFilters({ board })}
              onOpen={openQuestion}
            />
          ) : (
            <QuestionCards list={list} numbers={numbers} answers={answers} />
          )}

          {tab !== "board" && list.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-10 text-center">
              <p className="m-0 font-semibold">
                {totals[tab] === 0
                  ? `No ${TYPE_META[typeOfTab(tab)].nouns} in this chapter yet.`
                  : `No ${TYPE_META[typeOfTab(tab)].nouns} match these filters.`}
              </p>
              {totals[tab] > 0 && (
                <button type="button" onClick={reset} className={cx(button.outline, "h-11 px-4")}>
                  Reset filters
                </button>
              )}
            </div>
          )}

          <p role="status" className="sr-only">
            {answers.announcement}
          </p>
        </section>
      </div>

      <PrintSheet title={printTitle} subtitle={printNote} groups={printGroups} numbers={numbers} />
    </>
  );
}
