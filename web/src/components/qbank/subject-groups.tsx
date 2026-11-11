"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type KeyboardEvent, useRef, useState } from "react";
import type { Tone } from "@/lib/bank-look";
import type { BankTab } from "@/lib/questions";
import { QbSubjectIcon, TAB_TONE, cx } from "./ui";

export type QbSubjectCard = {
  id: string;
  href: string;
  name: string;
  abbr: string;
  tone: Tone;
  /** "১৪টি অধ্যায়" */
  meta: string;
  /** A key of the class's groups, or "none". */
  group: string;
  /** The sections that have questions, by their short names. */
  chips: { tab: BankTab; label: string }[];
};

/**
 * A class's subject cards. When the class's subjects belong to more than one group (বিজ্ঞান,
 * মানবিক…), tabs pick the group, starting on the group of the teacher's first subject; the choice
 * is kept in the address (?group=) so Back returns to it.
 */
export function QbSubjectGroups({
  groups,
  subjects,
  label,
  add,
}: {
  groups: { key: string; label: string }[];
  subjects: QbSubjectCard[];
  /** The tabs' name for screen readers: "বিভাগ". */
  label: string;
  /** The dashboard's "+ নতুন বিষয়" card. */
  add?: { href: string; label: string };
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabbed = groups.length > 1;
  // Without ?group=, the group of the teacher's first subject in this class.
  const fallback = groups.find((g) => g.key === subjects[0]?.group)?.key ?? groups[0]?.key ?? "";
  const urlGroup = groups.find((g) => g.key === params.get("group"))?.key ?? fallback;
  // Shown at once on click; Next applies the address change in a transition a moment later.
  const [group, setGroup] = useState(urlGroup);
  const [lastUrlGroup, setLastUrlGroup] = useState(urlGroup);
  if (urlGroup !== lastUrlGroup) {
    setLastUrlGroup(urlGroup);
    setGroup(urlGroup);
  }
  const shown = tabbed ? subjects.filter((s) => s.group === group) : subjects;

  const pick = (next: string) => {
    setGroup(next);
    const query = new URLSearchParams(params.toString());
    if (next === fallback) query.delete("group");
    else query.set("group", next);
    const qs = query.toString();
    window.history.replaceState(null, "", `${pathname}${qs ? `?${qs}` : ""}`);
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const last = groups.length - 1;
    const to =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (to === null) return;
    event.preventDefault();
    pick(groups[to].key);
    tabs.current[to]?.focus();
  };

  return (
    <>
      {tabbed && (
        <div role="tablist" aria-label={label} className="qb-scroll flex gap-2 overflow-x-auto shadow-[inset_0_-1px_0_#E3E1DA]">
          {groups.map((g, i) => {
            const on = g.key === group;
            return (
              <button
                key={g.key}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`qb-group-${g.key}`}
                aria-selected={on}
                aria-controls="qb-subjects"
                tabIndex={on ? 0 : -1}
                onClick={() => pick(g.key)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cx(
                  "h-12 shrink-0 border-b-[3px] px-[18px] text-[16px] font-semibold whitespace-nowrap focus-visible:-outline-offset-2",
                  on ? "border-qb-accent text-qb-accent" : "border-transparent text-qb-muted hover:text-qb-ink",
                )}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      )}

      <div
        id="qb-subjects"
        role={tabbed ? "tabpanel" : undefined}
        aria-labelledby={tabbed ? `qb-group-${group}` : undefined}
        className="grid grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-4"
      >
        {shown.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            className="flex flex-col gap-4 rounded-2xl border border-qb-line bg-qb-surface p-[22px] text-qb-ink no-underline hover:border-qb-field hover:text-qb-ink"
          >
            <span className="flex items-center gap-3.5">
              <QbSubjectIcon abbr={s.abbr} tone={s.tone} />
              <span className="min-w-0 text-[19px] leading-[1.25] font-bold">{s.name}</span>
            </span>
            <span className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-qb-divider pt-3.5 text-[14px] text-qb-muted">
              <span>{s.meta}</span>
              {s.chips.length > 0 && (
                <span className="flex flex-wrap gap-1.5" aria-hidden="true">
                  {s.chips.map((chip) => (
                    <span key={chip.tab} className={cx("rounded-[5px] px-2 py-0.5 text-[12px] font-bold", TAB_TONE[chip.tab])}>
                      {chip.label}
                    </span>
                  ))}
                </span>
              )}
            </span>
          </Link>
        ))}
        {add && (
          <Link
            href={add.href}
            className="flex min-h-[150px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-qb-field p-[22px] font-semibold text-qb-accent no-underline hover:border-qb-accent hover:bg-qb-surface hover:text-qb-accent"
          >
            <span aria-hidden="true" className="text-[22px] leading-none">
              +
            </span>
            {add.label}
          </Link>
        )}
      </div>
    </>
  );
}
