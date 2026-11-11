import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

// The trail on the question bank's editing pages (new subject, edit subject, all questions). The
// browsing pages use the QBank design's own (components/qbank).

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
