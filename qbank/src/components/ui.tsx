import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { TONE, TYPE_META, toneOf } from "@/lib/format";
import type { TabKey } from "@/lib/questions";
import type { QType, Subject } from "@/lib/types";

/* Small pieces the mockups repeat on every page. */

export const button = {
  /** Green: Search, Show answers, Start a mixed MCQ test */
  accent:
    "inline-flex items-center justify-center rounded-[10px] bg-accent font-semibold text-white no-underline hover:bg-accent-hover hover:text-white",
  /** White with a border: Bookmark, All board questions, ← Ch 1 */
  outline:
    "inline-flex items-center justify-center rounded-[10px] border border-field bg-surface font-semibold text-ink no-underline hover:bg-page hover:text-ink",
  /** Black: Download chapter PDF */
  dark: "inline-flex items-center justify-center rounded-[10px] bg-ink font-semibold text-white no-underline hover:bg-ink-soft hover:text-white",
};

/** "CQ 1", "MCQ" … in the type's colours. */
export function TypeBadge({ type, children, className }: { type: QType; children?: ReactNode; className?: string }) {
  return (
    <span className={cx("rounded-md px-2.5 py-[3px] text-[13px] font-bold", TYPE_META[type].badge, className)}>
      {children ?? type}
    </span>
  );
}

/** The yellow board / source tag: "Dhaka Board · 2024", "Model test". */
export function BoardTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("rounded-md bg-board-soft px-2.5 py-[3px] text-[13px] font-semibold text-board", className)}>
      {children}
    </span>
  );
}

const COUNT_CHIP: Record<TabKey, { label: string; className: string }> = {
  cq: { label: "CQ", className: "bg-cq-soft text-cq" },
  mcq: { label: "MCQ", className: "bg-mcq-soft text-mcq" },
  sq: { label: "SQ", className: "bg-sq-soft text-sq" },
  board: { label: "Board", className: "bg-board-soft text-board" },
};

/** "CQ 18", "Board 11" on a chapter row. */
export function CountChip({ tab, count }: { tab: TabKey; count: number }) {
  const chip = COUNT_CHIP[tab];
  return (
    <span className={cx("rounded-md px-2.5 py-1 text-[13px] font-semibold", chip.className, count === 0 && "opacity-60")}>
      {chip.label} {count}
    </span>
  );
}

/** The coloured square with a subject's abbreviation. */
export function SubjectIcon({ subject, size = "md" }: { subject: Pick<Subject, "abbr" | "tone">; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex shrink-0 items-center justify-center font-display font-bold",
        TONE[toneOf(subject)].box,
        size === "lg" ? "size-[72px] rounded-[18px] text-[28px]" : "size-12 rounded-xl text-[18px]",
      )}
    >
      {subject.abbr}
    </span>
  );
}

/** Uppercase green label above a section heading. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("m-0 text-[14px] font-semibold tracking-[0.06em] text-accent uppercase", className)}>{children}</p>
  );
}

export function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#8A8F97"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
