"use client";

import Link from "next/link";
import { useState } from "react";
import { type ChapterFilters, DIFFICULTIES, type Difficulty, SOURCES, type Source, activeFilters, filterParams } from "@/lib/questions";
import { useQbNav } from "./nav";
import { cx, qbButton } from "./ui";

export type QbFilterText = {
  filters: string;
  /** "১টি চালু" … for 0–5 filters in use, written out on the server in the page's digits. */
  filtersOn: string[];
  topic: string;
  allTopics: string;
  reset: string;
  source: string;
  sources: Record<Source, string>;
  board: string;
  allBoards: string;
  year: string;
  allYears: string;
  difficulty: string;
  anyDifficulty: string;
  difficulties: Record<Difficulty, string>;
  pdf: string;
  pdfHint: string;
};

const caption = "p-0 text-[13px] font-bold tracking-[0.05em] text-qb-subtle uppercase";
const field = "h-11 w-full rounded-[10px] border border-qb-field bg-qb-surface px-3 text-qb-ink";
const row = "flex min-h-8 items-center gap-2.5";
// Chrome's own margins around checkboxes and radios, which the design keeps and Tailwind resets.
const box = "size-[18px] shrink-0 accent-qb-accent my-[3px] mr-[3px] ml-1";
const radio = "size-[18px] shrink-0 accent-qb-accent mt-[3px] mr-[3px] ml-[5px]";

/**
 * The chapter page's filter sidebar: sub-chapter (when the chapter has any), source, board, year and
 * difficulty, for every tab. A change
 * reloads the questions in place (the list dims meanwhile); the boxes show the new choice at once.
 * Where the sidebar sits above the questions (narrow screens) it folds into a "Filters" button.
 */
export function QbFilters({
  path,
  tab,
  filters,
  topics,
  boards,
  years,
  pdfHref,
  text,
}: {
  /** The chapter page's address without a query. */
  path: string;
  tab: string;
  filters: ChapterFilters;
  /** The chapter's sub-chapters, "৪.১ বল ও গতির সূত্র", by number. */
  topics: { number: number; label: string }[];
  boards: { key: string; label: string }[];
  years: { value: number; label: string }[];
  pdfHref: string;
  text: QbFilterText;
}) {
  const { go } = useQbNav();
  // The page's filters, followed at once on a click and whenever the page brings new ones.
  const key = JSON.stringify(filters);
  const [state, setState] = useState(filters);
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setState(filters);
  }
  const [open, setOpen] = useState(false);

  const apply = (next: ChapterFilters) => {
    setState(next);
    const query = new URLSearchParams({ tab, ...filterParams(next) });
    go(`${path}?${query}`);
  };
  const sources = state.sources ?? [...SOURCES];
  const active = activeFilters(state);
  const boardOptions = state.board && state.board !== "any" && !boards.some((b) => b.key === state.board) ? [...boards, { key: state.board, label: state.board }] : boards;

  return (
    <aside
      aria-label={text.filters}
      className="flex min-w-0 flex-[1_1_260px] flex-col gap-[22px] rounded-2xl border border-qb-line bg-qb-surface p-[22px]"
      data-print-hide
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-[18px] font-bold">
          <span className="hidden @min-[848px]:inline">{text.filters}</span>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="qb-filters-body"
            onClick={() => setOpen((o) => !o)}
            className="-my-2 flex items-center gap-2 py-2 text-[18px] font-bold text-qb-ink @min-[848px]:hidden"
          >
            {text.filters}
            {active > 0 && (
              <span className="rounded-full bg-qb-accent px-2 py-px text-[12px] font-semibold text-white">{text.filtersOn[active]}</span>
            )}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={cx("transition-transform", open && "rotate-180")}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </h2>
        <button type="button" onClick={() => apply({})} className="py-2 text-[14px] font-semibold text-qb-accent hover:text-qb-accent-hover">
          {text.reset}
        </button>
      </div>

      <div id="qb-filters-body" className={cx("flex-col gap-[22px]", open ? "flex" : "hidden @min-[848px]:flex")}>
        {topics.length > 0 && (
          <div className="flex flex-col gap-2">
            <label htmlFor="qb-topic" className={caption}>
              {text.topic}
            </label>
            <select
              id="qb-topic"
              className={field}
              value={state.topic ? String(state.topic) : ""}
              onChange={(e) => apply({ ...state, topic: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">{text.allTopics}</option>
              {topics.map((t) => (
                <option key={t.number} value={t.number}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <fieldset className="m-0 flex flex-col gap-2 border-none p-0">
          <legend className={cx(caption, "mb-2")}>{text.source}</legend>
          {SOURCES.map((s) => (
            <label key={s} className={row}>
              <input
                type="checkbox"
                className={box}
                checked={sources.includes(s)}
                onChange={(e) =>
                  apply({
                    ...state,
                    sources: e.target.checked ? SOURCES.filter((k) => k === s || sources.includes(k)) : sources.filter((k) => k !== s),
                  })
                }
              />
              {text.sources[s]}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-2">
          <label htmlFor="qb-board" className={caption}>
            {text.board}
          </label>
          <select id="qb-board" className={field} value={state.board ?? ""} onChange={(e) => apply({ ...state, board: e.target.value || undefined })}>
            <option value="">{text.allBoards}</option>
            {boardOptions.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="qb-year" className={caption}>
            {text.year}
          </label>
          <select
            id="qb-year"
            className={field}
            value={state.year ? String(state.year) : ""}
            onChange={(e) => apply({ ...state, year: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">{text.allYears}</option>
            {years.map((y) => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
            {state.year && !years.some((y) => y.value === state.year) && <option value={state.year}>{state.year}</option>}
          </select>
        </div>

        <fieldset className="m-0 flex flex-col gap-2 border-none p-0">
          <legend className={cx(caption, "mb-2")}>{text.difficulty}</legend>
          {([undefined, ...DIFFICULTIES] as Array<Difficulty | undefined>).map((d) => (
            <label key={d ?? "any"} className={row}>
              <input type="radio" name="qb-difficulty" className={radio} checked={state.difficulty === d} onChange={() => apply({ ...state, difficulty: d })} />
              {d ? text.difficulties[d] : text.anyDifficulty}
            </label>
          ))}
        </fieldset>

        <Link href={pdfHref} title={text.pdfHint} className={cx(qbButton.dark, "h-[46px]")}>
          {text.pdf}
        </Link>
      </div>
    </aside>
  );
}
