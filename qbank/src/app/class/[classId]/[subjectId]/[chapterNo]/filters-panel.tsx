"use client";

import { useState } from "react";
import { button } from "@/components/ui";
import { cx } from "@/lib/cx";
import {
  activeFilterCount,
  DIFFICULTIES,
  parseYear,
  SOURCE_KEYS,
  SOURCE_LABELS,
  type QuestionFilters,
  type SourceKey,
  type YearFilter,
} from "@/lib/questions";
import type { Difficulty } from "@/lib/types";

const caption = "p-0 text-[13px] font-bold tracking-[0.05em] text-subtle uppercase";
const legend = `${caption} mb-2`;
const field = "h-11 rounded-[10px] border border-field bg-surface px-3 text-ink";
const check = "flex min-h-8 items-center gap-2.5";
// Chrome's own margins around checkboxes and radios, which the mockup keeps and Tailwind resets.
const box = "size-[18px] shrink-0 accent-accent my-[3px] mr-[3px] ml-1";
const radio = "size-[18px] shrink-0 accent-accent mt-[3px] mr-[3px] ml-[5px]";

/** The filter sidebar. On a wide screen it sits beside the questions; when it stacks above them
 *  (phones, tablets) it folds into a "Filters" button so the questions stay near the top. */
export function FiltersPanel({
  filters,
  boards,
  years,
  onSources,
  onBoard,
  onYear,
  onDifficulty,
  onReset,
  onPrint,
}: {
  filters: QuestionFilters;
  boards: string[];
  years: number[];
  onSources: (sources: SourceKey[]) => void;
  onBoard: (board: string | null) => void;
  onYear: (year: YearFilter) => void;
  onDifficulty: (difficulty: Difficulty | null) => void;
  onReset: () => void;
  onPrint: () => void;
}) {
  const [open, setOpen] = useState(false);
  const active = activeFilterCount(filters);
  // A year from the address that this chapter doesn't list still shows as picked.
  const year = filters.year;
  const yearOptions = typeof year === "number" && !years.includes(year) ? [...years, year].sort((a, b) => b - a) : years;

  return (
    <aside
      aria-label="Filters"
      className="flex min-w-0 flex-[1_1_260px] flex-col gap-[22px] rounded-2xl border border-line bg-surface p-[22px] print:hidden"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-[18px] font-bold">
          <span className="hidden min-[896px]:inline">Filters</span>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="filters-body"
            onClick={() => setOpen((o) => !o)}
            className="-my-2 flex items-center gap-2 py-2 text-[18px] font-bold text-ink min-[896px]:hidden"
          >
            Filters
            {active > 0 && (
              <span className="rounded-full bg-accent px-2 py-px text-[12px] font-semibold text-white">{active} on</span>
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
        <button type="button" onClick={onReset} className="py-2 text-[14px] font-semibold text-accent hover:text-accent-hover">
          Reset
        </button>
      </div>

      <div id="filters-body" className={cx("flex-col gap-[22px]", open ? "flex" : "hidden min-[896px]:flex")}>
        <fieldset className="m-0 flex flex-col gap-2 border-none p-0">
          <legend className={legend}>Source</legend>
          {SOURCE_KEYS.map((key) => (
            <label key={key} className={check}>
              <input
                type="checkbox"
                className={box}
                checked={filters.sources.includes(key)}
                onChange={(e) =>
                  onSources(
                    e.target.checked
                      ? SOURCE_KEYS.filter((k) => k === key || filters.sources.includes(k))
                      : filters.sources.filter((k) => k !== key),
                  )
                }
              />
              {SOURCE_LABELS[key]}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-2">
          <label htmlFor="board" className={caption}>
            Board
          </label>
          <select id="board" className={field} value={filters.board ?? ""} onChange={(e) => onBoard(e.target.value || null)}>
            <option value="">All boards</option>
            {boards.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="year" className={caption}>
            Year
          </label>
          <select id="year" className={field} value={year === null ? "" : String(year)} onChange={(e) => onYear(parseYear(e.target.value))}>
            <option value="">All years</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
            {year === "older" && <option value="older">Older</option>}
          </select>
        </div>

        <fieldset className="m-0 flex flex-col gap-2 border-none p-0">
          <legend className={legend}>Difficulty</legend>
          {([null, ...DIFFICULTIES] as Array<Difficulty | null>).map((d) => (
            <label key={d ?? "any"} className={check}>
              <input
                type="radio"
                name="difficulty"
                className={radio}
                checked={filters.difficulty === d}
                onChange={() => onDifficulty(d)}
              />
              {d ? d[0].toUpperCase() + d.slice(1) : "Any"}
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          onClick={onPrint}
          title="Opens the print dialog; choose “Save as PDF” to download"
          className={cx(button.dark, "h-[46px]")}
        >
          Download chapter PDF
        </button>
      </div>
    </aside>
  );
}
