"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import { SubjectIcon } from "@/components/ui";
import { cx } from "@/lib/cx";
import { subjectHref } from "@/lib/routes";
import type { Tone } from "@/lib/types";

export interface SubjectCardData {
  id: string;
  group: string;
  nameEn: string;
  nameBn: string;
  abbr: string;
  tone?: Tone;
  meta: string;
}

const slug = (group: string) => group.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** The group tabs (Common, Science, …) and the subject cards of the chosen group.
 *  The group is kept in the address (?group=science) so Back returns to it. */
export function SubjectGroups({
  groups,
  defaultGroup,
  subjects,
}: {
  groups: string[];
  defaultGroup: string;
  subjects: SubjectCardData[];
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  // Shown at once on click; Next applies the address change in a transition a moment later.
  const urlGroup = groups.find((g) => slug(g) === params.get("group")) ?? defaultGroup;
  const [group, setGroup] = useState(urlGroup);
  const [lastUrlGroup, setLastUrlGroup] = useState(urlGroup);
  if (urlGroup !== lastUrlGroup) {
    // Back or Forward changed the address: follow it.
    setLastUrlGroup(urlGroup);
    setGroup(urlGroup);
  }
  const tabbed = groups.length > 1;
  const shown = tabbed ? subjects.filter((s) => s.group === group) : subjects;

  const pick = (next: string) => {
    setGroup(next);
    const query = new URLSearchParams(params.toString());
    if (next === defaultGroup) query.delete("group");
    else query.set("group", slug(next));
    const qs = query.toString();
    window.history.replaceState(null, "", `${pathname}${qs ? `?${qs}` : ""}`);
  };

  // Arrow keys move between tabs, as in the WAI-ARIA tabs pattern.
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
    pick(groups[to]);
    tabs.current[to]?.focus();
  };

  return (
    <>
      {tabbed && (
        <div
          role="tablist"
          aria-label="Group"
          className="scrollbar-none flex gap-2 overflow-x-auto shadow-[inset_0_-1px_0_#E3E1DA]"
        >
          {groups.map((g, i) => {
            const on = g === group;
            return (
              <button
                key={g}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`group-tab-${slug(g)}`}
                aria-selected={on}
                aria-controls="subjects-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => pick(g)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cx(
                  "h-12 shrink-0 border-b-[3px] px-[18px] text-[16px] font-semibold whitespace-nowrap focus-visible:-outline-offset-2",
                  on ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {g}
              </button>
            );
          })}
        </div>
      )}

      <div
        id="subjects-panel"
        role={tabbed ? "tabpanel" : undefined}
        aria-labelledby={tabbed ? `group-tab-${slug(group)}` : undefined}
        className="grid grid-cols-[repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-4"
      >
        {shown.map((s) => (
          <Link
            key={s.id}
            href={subjectHref(s)}
            className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-[22px] text-ink no-underline hover:border-field hover:text-ink"
          >
            <span className="flex items-center gap-3.5">
              <SubjectIcon subject={s} />
              <span className="flex min-w-0 flex-col">
                <span className="text-[19px] leading-[1.25] font-bold">{s.nameEn}</span>
                <span lang="bn" className="text-[14px] text-subtle">
                  {s.nameBn}
                </span>
              </span>
            </span>
            <span className="flex items-center justify-between gap-3 border-t border-divider pt-3.5 text-[14px] text-muted">
              <span>{s.meta}</span>
              <span className="flex gap-1.5" aria-hidden="true">
                <span className="rounded-[5px] bg-cq-soft px-2 py-0.5 text-[12px] font-bold text-cq">CQ</span>
                <span className="rounded-[5px] bg-mcq-soft px-2 py-0.5 text-[12px] font-bold text-mcq">MCQ</span>
                <span className="rounded-[5px] bg-sq-soft px-2 py-0.5 text-[12px] font-bold text-sq">SQ</span>
              </span>
            </span>
          </Link>
        ))}
        {shown.length === 0 && (
          <p className="m-0 rounded-2xl border border-dashed border-field p-6 text-center text-subtle">
            Subjects for this group are coming soon.
          </p>
        )}
      </div>
    </>
  );
}
