import type { Metadata } from "next";
import Link from "next/link";
import { Layers, Trash2, Users } from "lucide-react";
import { PendingButton } from "@/components/form";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { listBatches } from "@/server/batches";
import { listCourses } from "@/server/courses";
import { getDb } from "@/server/db";
import { deleteBatchAction } from "../students/actions";
import { BatchForm } from "../students/student-forms";
import { batchFormText } from "../students/text";

export const instant = false;

export const metadata: Metadata = { title: "ব্যাচ" };

/** Each course's batches: when they meet, how many they hold, whether they are taking students; and opening a new one. */
export default async function BatchesPage() {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.batches;
  const db = await getDb();
  const [courses, batches] = await Promise.all([listCourses(db, teacher.id), listBatches(db, teacher.id)]);
  const text = batchFormText(d);
  const groups = courses.map((course) => ({ course, batches: batches.filter((b) => b.courseId === course.id) })).filter((g) => g.batches.length > 0);

  return (
    <main className="dash-content">
      <header>
        <h1 className="page-title">{t.title}</h1>
        <p className="page-lead">{t.lead}</p>
      </header>

      {courses.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">
            <Layers />
          </span>
          <p className="empty-text">{t.noCourses}</p>
          <Link href="/dashboard/courses/new" className="btn btn-primary">
            {d.dashboard.courses.new}
          </Link>
        </div>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="flex min-w-0 flex-col gap-6">
            {groups.length === 0 && (
              <div className="empty">
                <span className="empty-icon" aria-hidden="true">
                  <Layers />
                </span>
                <p className="empty-text">{t.empty}</p>
              </div>
            )}
            {groups.map(({ course, batches: list }) => (
              <section key={course.id} className="card flex flex-col gap-3 p-5" aria-labelledby={`course-${course.id}`}>
                <h2 id={`course-${course.id}`} className="panel-title">
                  {course.title}
                </h2>
                <ul className="flex flex-col gap-2">
                  {list.map((batch) => (
                    <li key={batch.id} className="rounded-lg border border-line p-3">
                      <details className="fold">
                        <summary className="cursor-pointer list-none">
                          <span className="flex flex-wrap items-center gap-2">
                            <b className="font-semibold text-ink">{batch.name}</b>
                            <span className={batch.open ? "badge badge-ok" : "badge"}>{batch.open ? t.openBadge : t.closedBadge}</span>
                          </span>
                          <span className="block text-[14px] text-muted">
                            {[
                              batch.schedule,
                              batch.capacity
                                ? t.seats(formatNumber(batch.students, locale), formatNumber(batch.capacity, locale))
                                : t.students(formatNumber(batch.students, locale)),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </summary>
                        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
                          <BatchForm batch={{ id: batch.id, name: batch.name, schedule: batch.schedule, capacity: batch.capacity, open: batch.open }} t={text} c={d.common} />
                          <div className="row-actions">
                            <Link href={`/dashboard/batches/${batch.id}`} className="btn btn-ghost btn-xs">
                              <Users aria-hidden="true" />
                              {t.roster}
                            </Link>
                            <form action={deleteBatchAction}>
                              <input type="hidden" name="batchId" value={batch.id} />
                              <PendingButton className="btn btn-danger btn-xs" aria-label={`${d.common.delete}: ${batch.name}`}>
                                <Trash2 aria-hidden="true" />
                                {d.common.delete}
                              </PendingButton>
                            </form>
                          </div>
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <section className="card flex flex-col gap-4 p-5" aria-labelledby="new-batch-title">
            <h2 id="new-batch-title" className="panel-title">
              {t.newTitle}
            </h2>
            <BatchForm courses={courses.map((course) => ({ id: course.id, title: course.title }))} t={text} c={d.common} />
          </section>
        </div>
      )}
    </main>
  );
}
