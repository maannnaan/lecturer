import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Radio } from "lucide-react";
import { formatDateTime, formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { listCourses } from "@/server/courses";
import { getDb } from "@/server/db";
import { listExams } from "@/server/exams";
import { STATE_BADGE, examState } from "./text";

export const instant = false;

export const metadata: Metadata = { title: "লাইভ MCQ পরীক্ষা" };

/** The teacher's exams, latest first, each with where it stands. */
export default async function ExamsPage() {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.exams;
  const db = await getDb();
  const [list, courses] = await Promise.all([listExams(db, teacher.id), listCourses(db, teacher.id)]);
  const now = new Date();
  const n = (value: number) => formatNumber(value, locale);

  return (
    <main className="dash-content">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-lead">{t.lead}</p>
        </div>
        {courses.length > 0 && list.length > 0 && (
          <Link href="/dashboard/exams/new" className="btn btn-primary btn-sm">
            <Plus aria-hidden="true" />
            {t.new}
          </Link>
        )}
      </header>

      {list.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">
            <Radio />
          </span>
          <p className="empty-text">{courses.length === 0 ? t.noCourses : t.empty}</p>
          <Link href={courses.length === 0 ? "/dashboard/courses/new" : "/dashboard/exams/new"} className="btn btn-primary">
            <Plus aria-hidden="true" />
            {courses.length === 0 ? d.dashboard.courses.new : t.new}
          </Link>
        </div>
      ) : (
        <ul className="card divide-y divide-line">
          {list.map((exam) => {
            const state = examState(exam, now);
            return (
              <li key={exam.id}>
                <Link href={`/dashboard/exams/${exam.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <b className="block font-semibold text-ink">{exam.title}</b>
                    <span className="block text-[14px] text-ink-2">{[exam.courseTitle, exam.batchName].filter(Boolean).join(" · ")}</span>
                    <span className="block text-[13.5px] text-muted">
                      {[formatDateTime(exam.startsAt, locale), t.minutes(n(exam.durationMin)), t.questions(n(exam.questionCount)), exam.attemptCount > 0 && t.sat(n(exam.attemptCount))]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className={STATE_BADGE[state]}>{t.statuses[state]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
