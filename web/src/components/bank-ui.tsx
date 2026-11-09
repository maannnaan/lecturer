import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { type Dictionary, type Locale, formatNumber } from "@/i18n";
import type { TabCounts } from "@/lib/bank-tree";
import { BANK_TABS, type BankTab } from "@/lib/questions";

// Pieces shared by the question bank's pages in the dashboard and on a teacher's website.

/** A trail of links to where this page sits; the last item is the page itself. */
export function Crumbs({
  items,
  label,
  className = "crumbs",
}: {
  items: { label: string; href?: string }[];
  label: string;
  className?: string;
}) {
  return (
    <nav className={className} aria-label={label}>
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <ChevronRight aria-hidden="true" />}
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <b aria-current="page">{item.label}</b>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

/**
 * The sections that have questions, each with its count: "MCQ ১২", "CQ ৪". With `href`, each
 * links to that section.
 */
export function SectionChips({
  counts,
  d,
  locale,
  href,
}: {
  counts: TabCounts;
  d: Dictionary;
  locale: Locale;
  href?: (tab: BankTab) => string;
}) {
  const tabs = BANK_TABS.filter((tab) => counts[tab] > 0);
  if (tabs.length === 0) return null;
  return (
    <ul className="chips">
      {tabs.map((tab) => {
        const text = `${d.questions.tabs[tab]} ${formatNumber(counts[tab], locale)}`;
        return (
          <li key={tab}>
            {href ? (
              <Link href={href(tab)} className="tag" title={d.questions.tabNames[tab]}>
                {text}
              </Link>
            ) : (
              <span className="tag" title={d.questions.tabNames[tab]}>
                {text}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
