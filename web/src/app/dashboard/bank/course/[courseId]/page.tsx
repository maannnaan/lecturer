import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Crumbs, SectionChips } from "@/components/bank-ui";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { buildBankTree } from "@/lib/bank-tree";
import { chapterLabel } from "@/lib/chapter-label";
import { gradeName, gradeOf, subjectOf } from "@/lib/grades";
import { requireTeacher } from "@/server/auth/current";
import { listCoursesWithChapters } from "@/server/courses";
import { getDb } from "@/server/db";
import { bankCounts } from "@/server/questions";

export const instant = false;

export const metadata: Metadata = { title: "প্রশ্নব্যাংক" };

/** The bank's third level: one subject's chapters, with how many questions each section has. */
export default async function BankCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const teacher = await requireTeacher();
  const { courseId } = await params;
  const db = await getDb();
  const [courses, counts] = await Promise.all([listCoursesWithChapters(db, teacher.id), bankCounts(db, teacher.id)]);
  const node = buildBankTree(courses, counts)
    .flatMap((g) => g.courses)
    .find((c) => c.course.id === courseId);
  if (!node) notFound();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.bank;
  const { course } = node;
  const grade = gradeOf(course);
  const subject = subjectOf(course);
  const subtitle = [subject !== course.title && course.title, course.session].filter(Boolean).join(" · ");
  const base = `/dashboard/bank/course/${course.id}`;
  const total = (n: number) => t.total(formatNumber(n, locale));

  return (
    <main className="dash-content">
      <Crumbs
        className="crumbs !pt-0"
        label={d.common.breadcrumb}
        items={[
          { label: t.title, href: "/dashboard/bank" },
          { label: gradeName(grade, d).label, href: `/dashboard/bank/class/${grade}` },
          { label: subject },
        ]}
      />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl">{subject}</h2>
          {subtitle && <p className="mt-1 text-ink-2">{subtitle}</p>}
        </div>
        <div className="row-actions">
          <Link href={`/dashboard/courses/${course.id}`} className="btn btn-ghost btn-sm">
            <Pencil aria-hidden="true" />
            {t.editChapters}
          </Link>
          <Link href={`/dashboard/bank/new?course=${course.id}`} className="btn btn-primary btn-sm">
            <Plus aria-hidden="true" />
            {t.new}
          </Link>
        </div>
      </header>

      {node.chapters.length === 0 && <p className="card p-6 text-ink-2">{t.noChapters}</p>}
      {(node.chapters.length > 0 || node.unfiled.total > 0) && (
        <ul className="card ch-rows">
          {node.chapters.map(({ chapter, counts: sections, total: n }, i) => (
            <li key={chapter.id}>
              <Link href={`${base}/${chapter.id}`} className="ch-row">
                <span className="min-w-0">
                  <span className="ch-row-label">{chapterLabel(chapter, i, d, locale)}</span>
                  <span className="ch-row-title">{chapter.title}</span>
                </span>
                <span className="ch-row-side">
                  <SectionChips counts={sections} d={d} locale={locale} />
                  <span className="ch-row-total">{total(n)}</span>
                </span>
              </Link>
            </li>
          ))}
          {node.unfiled.total > 0 && (
            <li>
              <Link href={`${base}/unfiled`} className="ch-row">
                <span className="min-w-0">
                  <span className="ch-row-title">{t.unfiled}</span>
                </span>
                <span className="ch-row-side">
                  <SectionChips counts={node.unfiled.counts} d={d} locale={locale} />
                  <span className="ch-row-total">{total(node.unfiled.total)}</span>
                </span>
              </Link>
            </li>
          )}
        </ul>
      )}
    </main>
  );
}
