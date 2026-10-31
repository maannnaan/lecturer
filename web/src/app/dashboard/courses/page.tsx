import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, ChevronUp, Eye, Pencil, Plus } from "lucide-react";
import { CourseIconGlyph } from "@/components/course-icon";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { chapterCounts, listCourses } from "@/server/courses";
import { getDb } from "@/server/db";
import { moveCourseAction } from "./actions";

export const instant = false;

export const metadata: Metadata = { title: "কোর্স ও অধ্যায়" };

export default async function CoursesPage() {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.courses;
  const db = await getDb();
  const [courses, counts] = await Promise.all([listCourses(db, teacher.id), chapterCounts(db, teacher.id)]);

  return (
    <main className="dash-content">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl">{t.title}</h2>
          <p className="mt-1 text-ink-2">{t.lead}</p>
        </div>
        <Link href="/dashboard/courses/new" className="btn btn-primary btn-sm">
          <Plus aria-hidden="true" />
          {t.new}
        </Link>
      </header>

      {courses.length === 0 ? (
        <p className="card p-6 text-ink-2">{t.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {courses.map((course, i) => (
            <li key={course.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <span
                className={`course-cover cv-${course.cover} !h-16 !w-16 shrink-0 !items-center !justify-center !p-0 rounded-md`}
                aria-hidden="true"
              >
                <CourseIconGlyph name={course.icon} className="!size-7" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <Link href={`/dashboard/courses/${course.id}`} className="text-lg font-semibold text-ink">
                    {course.title}
                  </Link>
                  <span className={course.published ? "badge badge-ok" : "badge"}>
                    {course.published ? d.common.published : d.common.draft}
                  </span>
                </p>
                <p className="text-sm text-muted">
                  {[course.level, t.chaptersCount(formatNumber(counts.get(course.id) ?? 0, locale))]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="row-actions">
                {(["up", "down"] as const).map((dir) => (
                  <form key={dir} action={moveCourseAction}>
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="direction" value={dir} />
                    <button
                      type="submit"
                      className="icon-btn"
                      disabled={dir === "up" ? i === 0 : i === courses.length - 1}
                      aria-label={`${dir === "up" ? d.common.moveUp : d.common.moveDown}: ${course.title}`}
                    >
                      {dir === "up" ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                    </button>
                  </form>
                ))}
                <Link href={`/dashboard/courses/${course.id}`} className="btn btn-ghost btn-xs">
                  <Pencil aria-hidden="true" />
                  {d.common.edit}
                </Link>
                {course.published && (
                  <Link href={`/${teacher.handle}/courses/${course.number}`} className="btn btn-ghost btn-xs">
                    <Eye aria-hidden="true" />
                    {d.common.view}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
