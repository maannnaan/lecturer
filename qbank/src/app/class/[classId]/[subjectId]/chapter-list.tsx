"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, CountChip } from "@/components/ui";
import { pad2, plural } from "@/lib/format";
import type { TabKey } from "@/lib/questions";
import { chapterHref } from "@/lib/routes";

export interface ChapterRow {
  id: string;
  no: number;
  titleEn: string;
  titleBn: string;
  counts: Record<TabKey, number>;
}

/** "Chapters" with its "Find a chapter" box, and the chapter rows with their question counts. */
export function ChapterList({ chapters }: { chapters: ChapterRow[] }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? chapters.filter(
        (c) =>
          c.titleEn.toLowerCase().includes(needle) ||
          c.titleBn.includes(needle) ||
          String(c.no) === needle ||
          pad2(c.no) === needle,
      )
    : chapters;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-[22px] font-bold">Chapters</h2>
        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor="filter" className="text-[14px] text-subtle">
            Find a chapter
          </label>
          <input
            id="filter"
            type="search"
            placeholder="e.g. Motion"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-[240px] max-w-full rounded-[10px] border border-field bg-surface px-3.5 text-ink placeholder:text-faint"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap gap-3 border-b border-line bg-surface-alt px-5 py-3 text-[13px] font-semibold tracking-[0.04em] text-subtle uppercase">
          <span className="flex-[999_1_360px]">Chapter</span>
          <span className="hidden flex-[1_1_320px] min-[800px]:block">Questions available</span>
        </div>
        <p role="status" className="sr-only">
          {needle ? `${plural(shown.length, "chapter")} shown` : ""}
        </p>
        <ul role="list" className="m-0 list-none p-0">
          {shown.map((c) => (
            <li key={c.id} className="border-b border-divider last:border-b-0">
              <Link
                href={chapterHref(c)}
                className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 text-ink no-underline hover:bg-surface-alt hover:text-ink"
              >
                <span className="flex min-w-0 flex-[999_1_360px] items-center gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-chip font-display font-bold text-muted">
                    {pad2(c.no)}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[17px] font-semibold">{c.titleEn}</span>
                    <span lang="bn" className="text-[14px] text-subtle">
                      {c.titleBn}
                    </span>
                  </span>
                </span>
                <span className="flex flex-[1_1_320px] flex-wrap items-center gap-2 pl-14 min-[800px]:pl-0">
                  <CountChip tab="cq" count={c.counts.cq} />
                  <CountChip tab="mcq" count={c.counts.mcq} />
                  <CountChip tab="sq" count={c.counts.sq} />
                  <CountChip tab="board" count={c.counts.board} />
                  <ChevronRight className="ml-auto shrink-0" />
                </span>
              </Link>
            </li>
          ))}
          {shown.length === 0 && (
            <li className="px-5 py-7 text-center text-subtle">No chapter matches “{query.trim()}”.</li>
          )}
        </ul>
      </div>
    </>
  );
}
