import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Printer } from "lucide-react";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { listCourses } from "@/server/courses";
import { getDb } from "@/server/db";
import { listPapers } from "@/server/papers";
import { STATUS_BADGE } from "./text";

export const instant = false;

export const metadata: Metadata = { title: "প্রশ্নপত্র" };

/** The teacher's question papers, latest first. */
export default async function PapersPage() {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.papers;
  const db = await getDb();
  const [list, courses] = await Promise.all([listPapers(db, teacher.id), listCourses(db, teacher.id)]);
  const n = (value: number) => formatNumber(value, locale);

  return (
    <main className="dash-content">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-lead">{t.lead}</p>
        </div>
        {courses.length > 0 && list.length > 0 && (
          <Link href="/dashboard/papers/new" className="btn btn-primary btn-sm">
            <Plus aria-hidden="true" />
            {t.new}
          </Link>
        )}
      </header>

      {list.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">
            <Printer />
          </span>
          <p className="empty-text">{courses.length === 0 ? t.noCourses : t.empty}</p>
          <Link href={courses.length === 0 ? "/dashboard/courses/new" : "/dashboard/papers/new"} className="btn btn-primary">
            <Plus aria-hidden="true" />
            {courses.length === 0 ? d.dashboard.courses.new : t.new}
          </Link>
        </div>
      ) : (
        <ul className="card divide-y divide-line">
          {list.map((paper) => (
            <li key={paper.id}>
              <Link href={`/dashboard/papers/${paper.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <b className="block font-semibold text-ink">{paper.title}</b>
                  <span className="block text-[14px] text-ink-2">{[paper.courseTitle, paper.batchName].filter(Boolean).join(" · ")}</span>
                  <span className="block text-[13.5px] text-muted">
                    {[t.mcqCount(n(paper.mcqCount)), paper.writtenCount > 0 && t.writtenCount(n(paper.writtenCount)), t.setCount(n(paper.setCount))].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className={STATUS_BADGE[paper.status]}>{t.statuses[paper.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
