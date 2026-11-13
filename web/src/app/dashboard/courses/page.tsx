import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChevronDown, ChevronUp, Eye, Pencil, Plus } from "lucide-react";
import { CourseIconGlyph } from "@/components/course-icon";
import { PendingButton } from "@/components/form";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { gradeName } from "@/lib/grades";
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
      <header className="page-head">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-lead">{t.lead}</p>
        </div>
        {courses.length > 0 && (
          <Link href="/dashboard/courses/new" className="btn btn-primary btn-sm">
            <Plus aria-hidden="true" />
            {t.new}
          </Link>
        )}
      </header>

      {courses.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">
            <BookOpen />
          </span>
          <p className="empty-text">{t.empty}</p>
          <Link href="/dashboard/courses/new" className="btn btn-primary">
            <Plus aria-hidden="true" />
            {t.new}
          </Link>
        </div>
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
                  {[gradeName(course.grade, d).label, t.chaptersCount(formatNumber(counts.get(course.id) ?? 0, locale))]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="row-actions">
                {(["up", "down"] as const).map((dir) => (
                  <form key={dir} action={moveCourseAction}>
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="direction" value={dir} />
                    <PendingButton
                      className="icon-btn"
                      disabled={dir === "up" ? i === 0 : i === courses.length - 1}
                      aria-label={`${dir === "up" ? d.common.moveUp : d.common.moveDown}: ${course.title}`}
                    >
                      {dir === "up" ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                    </PendingButton>
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
