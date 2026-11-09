import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ListChecks, Plus, Search } from "lucide-react";
import { SectionChips } from "@/components/bank-ui";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { buildBankTree } from "@/lib/bank-tree";
import { gradeName } from "@/lib/grades";
import { requireTeacher } from "@/server/auth/current";
import { listCoursesWithChapters } from "@/server/courses";
import { getDb } from "@/server/db";
import { bankCounts } from "@/server/questions";
import { NoCourses } from "./no-courses";

export const instant = false;

export const metadata: Metadata = { title: "প্রশ্নব্যাংক" };

/** The bank's first level: the classes the teacher's courses are for. */
export default async function BankPage() {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.bank;
  const db = await getDb();
  const [courses, counts] = await Promise.all([listCoursesWithChapters(db, teacher.id), bankCounts(db, teacher.id)]);
  const tree = buildBankTree(courses, counts);

  return (
    <main className="dash-content">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl">{t.title}</h2>
          <p className="mt-1 max-w-[52em] text-ink-2">{t.lead}</p>
        </div>
        {courses.length > 0 && (
          <div className="row-actions">
            <Link href="/dashboard/bank/all" className="btn btn-ghost btn-sm">
              <ListChecks aria-hidden="true" />
              {t.allQuestions}
            </Link>
            <Link href="/dashboard/bank/new" className="btn btn-primary btn-sm">
              <Plus aria-hidden="true" />
              {t.new}
            </Link>
          </div>
        )}
      </header>

      {courses.length === 0 ? (
        <NoCourses t={t} />
      ) : (
        <>
          <form action="/dashboard/bank/all" method="get" role="search" className="flex flex-wrap items-end gap-2">
            <label className="field min-w-[14rem] flex-1">
              <span className="field-label">{t.filters.search}</span>
              <input type="search" name="q" className="input" />
            </label>
            <button type="submit" className="btn btn-ghost">
              <Search aria-hidden="true" />
              {t.filters.apply}
            </button>
          </form>

          <ul className="bank-grid">
            {tree.map((grade) => {
              const name = gradeName(grade.grade, d);
              return (
                <li key={grade.grade}>
                  <Link href={`/dashboard/bank/class/${grade.grade}`} className="bank-card">
                    <span className="bank-card-title">
                      {name.label}
                      <ArrowRight aria-hidden="true" />
                    </span>
                    {name.detail && <span className="bank-card-detail">{name.detail}</span>}
                    <span className="bank-card-meta">
                      {`${t.subjects(formatNumber(grade.courses.length, locale))} · ${t.total(formatNumber(grade.total, locale))}`}
                    </span>
                    <SectionChips counts={grade.counts} d={d} locale={locale} />
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="text-[14.5px] text-muted">
            {t.gradeHint}{" "}
            <Link href="/dashboard/courses" className="link">
              {t.coursesLink}
            </Link>
          </p>
        </>
      )}
    </main>
  );
}
