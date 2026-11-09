import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { Crumbs, SectionChips } from "@/components/bank-ui";
import { CourseIconGlyph } from "@/components/course-icon";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { buildBankTree } from "@/lib/bank-tree";
import { gradeName, isGrade, subjectOf } from "@/lib/grades";
import { requireTeacher } from "@/server/auth/current";
import { listCoursesWithChapters } from "@/server/courses";
import { getDb } from "@/server/db";
import { bankCounts } from "@/server/questions";

export const instant = false;

export const metadata: Metadata = { title: "প্রশ্নব্যাংক" };

/** The bank's second level: the subjects (courses) of one class. */
export default async function BankClassPage({ params }: { params: Promise<{ grade: string }> }) {
  const teacher = await requireTeacher();
  const { grade } = await params;
  if (!isGrade(grade)) notFound();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.bank;
  const db = await getDb();
  const [courses, counts] = await Promise.all([listCoursesWithChapters(db, teacher.id), bankCounts(db, teacher.id)]);
  const node = buildBankTree(courses, counts).find((g) => g.grade === grade);
  const name = gradeName(grade, d);

  return (
    <main className="dash-content">
      <Crumbs className="crumbs !pt-0" label={d.common.breadcrumb} items={[{ label: t.title, href: "/dashboard/bank" }, { label: name.label }]} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl">{name.label}</h2>
          {name.detail && <p className="mt-1 text-ink-2">{name.detail}</p>}
        </div>
        <Link href="/dashboard/bank/new" className="btn btn-primary btn-sm">
          <Plus aria-hidden="true" />
          {t.new}
        </Link>
      </header>

      {!node ? (
        <p className="card p-6 text-ink-2">{t.noSubjects}</p>
      ) : (
        <ul className="bank-grid">
          {node.courses.map(({ course, chapters, counts: sections, total }) => {
            const subject = subjectOf(course);
            const subtitle = [subject !== course.title && course.title, course.session].filter(Boolean).join(" · ");
            return (
              <li key={course.id}>
                <Link href={`/dashboard/bank/course/${course.id}`} className="bank-card bank-subject">
                  <span className={`course-cover cv-${course.cover} bank-cover`} aria-hidden="true">
                    <CourseIconGlyph name={course.icon} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="bank-card-title">{subject}</span>
                    {subtitle && <span className="bank-card-detail">{subtitle}</span>}
                    <span className="bank-card-meta">
                      {`${t.chapters(formatNumber(chapters.length, locale))} · ${t.total(formatNumber(total, locale))}`}
                    </span>
                    <SectionChips counts={sections} d={d} locale={locale} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
