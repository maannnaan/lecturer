"use client";

import Link from "next/link";
import { useState } from "react";
import type { BankTab } from "@/lib/questions";
import { QbChevron, QbCountChip } from "./ui";

export type QbChapterRow = {
  id: string;
  href: string;
  /** The number on its tile: "০২"; "–" for questions in no chapter. */
  number: string;
  title: string;
  /** A second line under the title (the teacher's own label, if any). */
  note?: string;
  /** "MCQ ১২", "বোর্ড ৪": the tabs that have questions. */
  chips: { tab: BankTab; text: string }[];
  /** What the find box matches: the title, label and number, in both scripts. */
  search: string;
};

/** A subject's chapters, with a find box and each chapter's question counts. */
export function QbChapterList({
  rows,
  text,
}: {
  rows: QbChapterRow[];
  text: { title: string; find: string; placeholder: string; chapter: string; questions: string; none: string; noMatch: string };
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = needle ? rows.filter((r) => r.search.includes(needle)) : rows;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-[22px] font-bold">{text.title}</h2>
        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor="qb-find" className="text-[14px] text-qb-subtle">
            {text.find}
          </label>
          <input
            id="qb-find"
            type="search"
            placeholder={text.placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-[240px] max-w-full rounded-[10px] border border-qb-field bg-qb-surface px-3.5 text-qb-ink placeholder:text-qb-faint"
          />
        </div>
      </div>

      <div className="@container overflow-hidden rounded-2xl border border-qb-line bg-qb-surface">
        <div className="flex flex-wrap gap-3 border-b border-qb-line bg-qb-surface-alt px-5 py-3 text-[13px] font-semibold tracking-[0.04em] text-qb-subtle uppercase">
          <span className="flex-[999_1_360px]">{text.chapter}</span>
          <span className="hidden flex-[1_1_320px] @min-[744px]:block">{text.questions}</span>
        </div>
        <ul role="list" aria-label={text.title} className="m-0 list-none p-0">
          {shown.map((r) => (
            <li key={r.id} className="border-b border-qb-divider last:border-b-0">
              <Link
                href={r.href}
                className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 text-qb-ink no-underline hover:bg-qb-surface-alt hover:text-qb-ink"
              >
                <span className="flex min-w-0 flex-[999_1_360px] items-center gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-qb-chip font-qb-display font-bold text-qb-muted">
                    {r.number}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[17px] font-semibold">{r.title}</span>
                    {r.note && <span className="text-[14px] text-qb-subtle">{r.note}</span>}
                  </span>
                </span>
                <span className="flex flex-[1_1_320px] flex-wrap items-center gap-2 pl-14 @min-[744px]:pl-0">
                  {r.chips.length > 0 ? (
                    r.chips.map((chip) => (
                      <QbCountChip key={chip.tab} tab={chip.tab}>
                        {chip.text}
                      </QbCountChip>
                    ))
                  ) : (
                    <span className="text-[14px] text-qb-subtle">{text.none}</span>
                  )}
                  <QbChevron className="ml-auto shrink-0" />
                </span>
              </Link>
            </li>
          ))}
          {shown.length === 0 && <li className="px-5 py-7 text-center text-qb-subtle">{text.noMatch.replace("{q}", query.trim())}</li>}
        </ul>
      </div>
    </>
  );
}
