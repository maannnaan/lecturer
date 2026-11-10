"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";

type Section = "classes" | "subjects" | "board" | null;

/** The main nav. Which item is current depends on the page, as in the mockups:
 *  a class page is under Classes, a subject or chapter page under Subjects. */
export function SiteNav({ classIds, fallbackClassId, className }: { classIds: string[]; fallbackClassId: string; className?: string }) {
  const parts = usePathname().split("/").filter(Boolean);
  const classId = parts[0] === "class" && classIds.includes(parts[1]) ? parts[1] : undefined;

  let section: Section = null;
  if (parts[0] === "class") section = parts.length >= 3 ? "subjects" : "classes";
  if (parts[0] === "questions") section = "board";

  const items: Array<{ key: Section | "tests"; label: string; href: string }> = [
    { key: "classes", label: "Classes", href: "/#classes" },
    { key: "subjects", label: "Subjects", href: `/class/${classId ?? fallbackClassId}` },
    { key: "board", label: "Board Questions", href: "/questions?board=any" },
    { key: "tests", label: "Model Tests", href: "/#types" },
  ];

  return (
    <nav aria-label="Main" className={cx("flex flex-wrap gap-1", className)}>
      {items.map((item) => {
        const current = item.key === section;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cx(
              "rounded-lg px-3.5 py-2.5 no-underline",
              current ? "bg-accent-soft font-semibold text-accent hover:text-accent" : "font-medium text-ink hover:bg-page hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
