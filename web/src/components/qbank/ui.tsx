import Link from "next/link";
import type { ReactNode } from "react";
import type { Tone } from "@/lib/bank-look";
import type { BankTab } from "@/lib/questions";

// Small pieces of the question bank's look (the QBank design), shared by its pages in the
// dashboard and on a teacher's website. Colours come from the qb-* tokens in globals.css.

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");
export { cx };

export const qbButton = {
  /** Green: Show answers, New question */
  accent:
    "inline-flex items-center justify-center gap-2 rounded-[10px] bg-qb-accent font-semibold text-white no-underline hover:bg-qb-accent-hover hover:text-white",
  /** White with a border: Bookmark, ← Chapter 1 */
  outline:
    "inline-flex items-center justify-center gap-2 rounded-[10px] border border-qb-field bg-qb-surface font-semibold text-qb-ink no-underline hover:bg-qb-page hover:text-qb-ink",
  /** Black: Download chapter PDF */
  dark: "inline-flex items-center justify-center gap-2 rounded-[10px] bg-qb-ink font-semibold text-white no-underline hover:bg-qb-ink-soft hover:text-white",
};

/** Each tab's colours: CQ blue, MCQ green, SQ orange, board yellow; the two problem tabs purple and rose. */
export const TAB_TONE: Record<BankTab, string> = {
  textbook: "bg-qb-purple-soft text-qb-purple",
  practice: "bg-qb-rose-soft text-qb-rose",
  mcq: "bg-qb-mcq-soft text-qb-mcq",
  sq: "bg-qb-sq-soft text-qb-sq",
  cq: "bg-qb-cq-soft text-qb-cq",
  board: "bg-qb-board-soft text-qb-board",
};

/** A class's or subject's colour, for its number or its square. */
export const TONE: Record<Tone, { box: string; text: string }> = {
  blue: { box: "bg-qb-cq-soft text-qb-cq", text: "text-qb-cq" },
  green: { box: "bg-qb-mcq-soft text-qb-mcq", text: "text-qb-mcq" },
  orange: { box: "bg-qb-sq-soft text-qb-sq", text: "text-qb-sq" },
  purple: { box: "bg-qb-purple-soft text-qb-purple", text: "text-qb-purple" },
  gray: { box: "bg-qb-chip text-qb-muted", text: "text-qb-muted" },
};

/** "Home / HSC / Physics": the trail on every inner page; the last item is the page itself. */
export function QbCrumbs({ items, label }: { items: { label: string; href?: string }[]; label: string }) {
  return (
    <nav aria-label={label} className="text-[14px] text-qb-subtle" data-print-hide>
      <ol className="m-0 flex list-none flex-wrap gap-2 p-0">
        {items.map((item, i) => (
          <li key={`${i}-${item.label}`} className="flex min-w-0 gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** "CQ ১", "MCQ" … in the tab's colours. */
export function QbBadge({ tab, children, className }: { tab: BankTab; children: ReactNode; className?: string }) {
  return <span className={cx("rounded-md px-2.5 py-[3px] text-[13px] font-bold whitespace-nowrap", TAB_TONE[tab], className)}>{children}</span>;
}

/** The yellow tag of a board question ("ঢাকা বোর্ড · ২০২৪"), or the test a question comes from. */
export function QbTag({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-qb-board-soft px-2.5 py-[3px] text-[13px] font-semibold text-qb-board">{children}</span>;
}

/** "শুধু আপনি": a question students don't see. */
export function QbPrivate({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-qb-chip px-2.5 py-[3px] text-[13px] font-semibold text-qb-muted">{children}</span>;
}

/** "CQ ১৮", "বোর্ড ১১" on a chapter row. */
export function QbCountChip({ tab, children }: { tab: BankTab; children: ReactNode }) {
  return <span className={cx("rounded-md px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap", TAB_TONE[tab])}>{children}</span>;
}

/** The coloured square with a subject's abbreviation. */
export function QbSubjectIcon({ abbr, tone, size = "md" }: { abbr: string; tone: Tone; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex shrink-0 items-center justify-center font-qb-display font-bold",
        TONE[tone].box,
        size === "lg" ? "size-[72px] rounded-[18px] text-[28px]" : "size-12 rounded-xl text-[18px]",
      )}
    >
      {abbr}
    </span>
  );
}

/** Uppercase label above a heading; green unless a colour is given. */
export function QbEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("m-0 text-[14px] font-semibold tracking-[0.06em] uppercase", className ?? "text-qb-accent")}>{children}</p>;
}

export function QbChevron({ className }: { className?: string }) {
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

/** A page heading in the design's display face; h1 on the website, h2 under the dashboard's own h1. */
export function QbTitle({
  as: Tag = "h1",
  size = "md",
  children,
  className,
}: {
  as?: "h1" | "h2";
  size?: "lg" | "md";
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag
      className={cx(
        "m-0 font-qb-display leading-[1.1] font-bold tracking-[-0.03em]",
        size === "lg" ? "text-[clamp(32px,7vw,44px)]" : "text-[clamp(30px,7vw,40px)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
