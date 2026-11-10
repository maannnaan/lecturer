"use client";

import { cx } from "@/lib/cx";
import { TYPE_META } from "@/lib/format";
import { previewText, tagMatches, type QuestionFilters } from "@/lib/questions";
import type { Question } from "@/lib/types";

/** The Board tab: board chips, then one row per board question with its board and year and an
 *  Open button that jumps to the question in its own tab. */
export function BoardList({
  chips,
  filters,
  olderThan,
  rows,
  onBoard,
  onOpen,
}: {
  chips: string[];
  filters: QuestionFilters;
  olderThan: number;
  rows: Question[];
  onBoard: (board: string | null) => void;
  onOpen: (q: Question) => void;
}) {
  const options: Array<string | null> = [null, ...chips];
  return (
    <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Board">
        {options.map((b) => {
          const on = (filters.board ?? null) === b;
          return (
            <button
              key={b ?? "all"}
              type="button"
              aria-pressed={on}
              onClick={() => onBoard(b)}
              className={cx(
                "h-10 rounded-full border px-3.5 text-[14px] font-semibold",
                on ? "border-ink bg-ink text-white" : "border-field bg-surface text-ink hover:bg-page",
              )}
            >
              {b ?? "All boards"}
            </button>
          );
        })}
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <ul role="list" className="m-0 list-none p-0">
          {rows.map((q) => {
            // Show the board and year the filters picked, or all of them.
            const narrowed = filters.board || filters.year;
            const tags = narrowed ? q.boards.filter((t) => tagMatches(t, filters, olderThan)) : q.boards;
            return (
              <li
                key={q.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-divider px-5 py-4 last:border-b-0"
              >
                <span
                  className={cx(
                    "w-[52px] shrink-0 rounded-md py-[3px] text-center text-[13px] font-bold",
                    TYPE_META[q.type].badge,
                  )}
                >
                  {q.type}
                </span>
                <span className="line-clamp-2 min-w-0 flex-[999_1_180px] sm:line-clamp-1 sm:flex-[999_1_300px]">
                  {previewText(q)}
                </span>
                {tags.map((t) => (
                  <span
                    key={`${t.board}-${t.year}`}
                    className="shrink-0 rounded-md bg-board-soft px-2.5 py-1 text-[13px] font-semibold text-board"
                  >
                    {t.board} · {t.year}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => onOpen(q)}
                  className="ml-auto h-10 shrink-0 rounded-lg border border-field bg-surface px-3.5 text-[14px] font-semibold text-ink hover:bg-page sm:ml-0"
                >
                  Open<span className="sr-only"> {TYPE_META[q.type].noun}: {previewText(q).slice(0, 60)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {rows.length === 0 && (
          <p className="m-0 px-5 py-7 text-center text-subtle">
            {filters.board
              ? `No questions from ${filters.board} board in this chapter yet.`
              : "No board questions match these filters."}
          </p>
        )}
      </div>
    </>
  );
}
