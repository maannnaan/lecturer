import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronUp, Eye, Trash2 } from "lucide-react";
import { formatDayRange, formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { getCourse, listChapters } from "@/server/courses";
import { getDb } from "@/server/db";
import { chapterLabel } from "@/lib/chapter-label";
import { deleteChapterAction, moveChapterAction } from "../actions";
import { AddChapterForm, CourseForm, DeleteCourseForm, EditChapterForm } from "../course-forms";

export const instant = false;

export const metadata: Metadata = { title: "কোর্স সম্পাদনা" };

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const db = await getDb();
  const course = await getCourse(db, teacher.id, id);
  if (!course) notFound();
  const chapters = await listChapters(db, teacher.id, course.id);
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.courses;
  // Everything but the label function, which can't be handed to the browser.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { defaultLabel: _defaultLabel, ...chapterText } = t.chapters;

  return (
    <main className="dash-content">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/courses" className="link text-[15px]">
          <ArrowLeft aria-hidden="true" />
          {t.backToList}
        </Link>
        {course.published && (
          <Link href={`/${teacher.handle}/courses/${course.number}`} className="btn btn-ghost btn-sm">
            <Eye aria-hidden="true" />
            {d.common.view}
          </Link>
        )}
      </div>
      <h2 className="text-2xl">{course.title}</h2>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="min-w-0">
          <CourseForm course={course} heading={t.editTitle} t={t.form} c={d.common} />
        </div>

        <section className="card flex min-w-0 flex-col gap-4 p-5" aria-labelledby="chapters-title">
          <div>
            <h3 id="chapters-title" className="panel-title">
              {t.chapters.title}
            </h3>
            <p className="panel-lead">{t.chapters.lead}</p>
          </div>
          {chapters.length === 0 && <p className="text-[15px] text-muted">{t.chapters.empty}</p>}
          <ol className="flex flex-col gap-2">
            {chapters.map((chapter, i) => {
              const dates = formatDayRange(chapter.startsOn, chapter.endsOn, locale);
              return (
                <li key={chapter.id} className="flex items-start gap-2 rounded-lg border border-line p-3">
                  <details className="min-w-0 flex-1">
                    <summary className="cursor-pointer list-none">
                      <span className="block text-[13px] font-semibold text-muted">
                        {chapterLabel(chapter, i, d, locale)}
                        {dates && ` · ${dates}`}
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">{chapter.title}</span>
                        <span
                          className={
                            chapter.status === "done"
                              ? "badge badge-ok"
                              : chapter.status === "ongoing"
                                ? "badge badge-warn"
                                : "badge"
                          }
                        >
                          {t.statuses[chapter.status]}
                        </span>
                      </span>
                    </summary>
                    <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
                      <EditChapterForm
                        chapter={chapter}
                        autoLabel={t.chapters.defaultLabel(formatNumber(i + 1, locale))}
                        t={chapterText}
                        statuses={t.statuses}
                        c={d.common}
                      />
                      <form action={deleteChapterAction}>
                        <input type="hidden" name="chapterId" value={chapter.id} />
                        <button type="submit" className="btn btn-danger btn-xs">
                          <Trash2 aria-hidden="true" />
                          {d.common.delete}
                        </button>
                      </form>
                    </div>
                  </details>
                  <div className="row-actions shrink-0">
                    {(["up", "down"] as const).map((dir) => (
                      <form key={dir} action={moveChapterAction}>
                        <input type="hidden" name="chapterId" value={chapter.id} />
                        <input type="hidden" name="direction" value={dir} />
                        <button
                          type="submit"
                          className="icon-btn"
                          disabled={dir === "up" ? i === 0 : i === chapters.length - 1}
                          aria-label={`${dir === "up" ? d.common.moveUp : d.common.moveDown}: ${chapter.title}`}
                        >
                          {dir === "up" ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                        </button>
                      </form>
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
          <AddChapterForm
            courseId={course.id}
            autoLabel={t.chapters.defaultLabel(formatNumber(chapters.length + 1, locale))}
            t={chapterText}
            statuses={t.statuses}
            c={d.common}
          />
        </section>
      </div>

      <DeleteCourseForm courseId={course.id} t={t.remove} c={d.common} />
    </main>
  );
}
