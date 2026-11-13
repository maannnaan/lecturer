import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { asciiDigits } from "@/lib/digits";
import { STUDENT_STATUSES, type StudentStatus } from "@/lib/students";
import { requireTeacher } from "@/server/auth/current";
import { listCourses } from "@/server/courses";
import { getDb } from "@/server/db";
import { listEnrollments } from "@/server/enrollments";
import { STUDENTS_PAGE_SIZE, countStudents, listStudents } from "@/server/students";

export const instant = false;

export const metadata: Metadata = { title: "শিক্ষার্থী" };

type Search = Promise<{ q?: string; course?: string; status?: string; source?: string; page?: string }>;

/** Every student of the teacher, by name: found by name or number, narrowed by course, status or how they joined. */
export default async function StudentsPage({ searchParams }: { searchParams: Search }) {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.students;
  const s = await searchParams;
  const db = await getDb();

  const status = (STUDENT_STATUSES as readonly string[]).includes(s.status ?? "") ? (s.status as StudentStatus) : undefined;
  const source = s.source === "online" || s.source === "offline" ? s.source : undefined;
  const page = Math.max(1, Number(asciiDigits(s.page ?? "")) || 1);
  const [courses, all, list, active] = await Promise.all([
    listCourses(db, teacher.id),
    countStudents(db, teacher.id),
    listStudents(db, teacher.id, { search: s.q, courseId: s.course || undefined, status, source, page }),
    listEnrollments(db, teacher.id, { status: "active" }),
  ]);
  // Each student's courses, for the line under their name.
  const places = new Map<string, string[]>();
  for (const e of active) {
    const line = [e.courseTitle, e.batchName, e.roll && `${d.dashboard.requests.roll} ${formatNumber(Number(e.roll), locale)}`].filter(Boolean).join(" · ");
    places.set(e.studentId, [...(places.get(e.studentId) ?? []), line]);
  }
  const filtered = Boolean(s.q || s.course || status || source);
  const pages = Math.max(1, Math.ceil(list.total / STUDENTS_PAGE_SIZE));
  const pageHref = (n: number) => {
    const query = new URLSearchParams(Object.entries({ q: s.q, course: s.course, status, source }).filter((entry): entry is [string, string] => Boolean(entry[1])));
    if (n > 1) query.set("page", String(n));
    return `/dashboard/students${query.size ? `?${query}` : ""}`;
  };

  return (
    <main className="dash-content">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-lead">{t.lead}</p>
        </div>
        {all > 0 && (
          <Link href="/dashboard/students/new" className="btn btn-primary btn-sm">
            <Plus aria-hidden="true" />
            {t.new}
          </Link>
        )}
      </header>

      {all === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">
            <Users />
          </span>
          <p className="empty-text">{t.empty}</p>
          <Link href="/dashboard/students/new" className="btn btn-primary">
            <Plus aria-hidden="true" />
            {t.new}
          </Link>
        </div>
      ) : (
        <>
          <form className="card grid items-end gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto]" role="search">
            <div className="field">
              <label className="field-label" htmlFor="q">
                {t.search}
              </label>
              <input id="q" name="q" className="input" defaultValue={s.q ?? ""} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="course">
                {t.course}
              </label>
              <select id="course" name="course" className="input" defaultValue={s.course ?? ""}>
                <option value="">{t.allCourses}</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="status">
                {d.dashboard.account.title}
              </label>
              <select id="status" name="status" className="input" defaultValue={status ?? ""}>
                <option value="">{t.allStatuses}</option>
                {STUDENT_STATUSES.map((key) => (
                  <option key={key} value={key}>
                    {t.statuses[key]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="source">
                {t.sources.online} / {t.sources.offline}
              </label>
              <select id="source" name="source" className="input" defaultValue={source ?? ""}>
                <option value="">{t.allSources}</option>
                <option value="online">{t.sources.online}</option>
                <option value="offline">{t.sources.offline}</option>
              </select>
            </div>
            <button type="submit" className="btn btn-ghost">
              {t.filter}
            </button>
          </form>

          <p className="text-[15px] text-ink-2">{t.count(formatNumber(list.total, locale))}</p>

          {list.items.length === 0 ? (
            <div className="empty">
              <p className="empty-text">{t.noMatch}</p>
              {filtered && (
                <Link href="/dashboard/students" className="btn btn-ghost btn-sm">
                  {d.qbank.clearFilters}
                </Link>
              )}
            </div>
          ) : (
            <ul className="card divide-y divide-line">
              {list.items.map((student) => (
                <li key={student.id}>
                  <Link href={`/dashboard/students/${student.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-surface-2">
                    <span className="avatar" aria-hidden="true">
                      {[...student.name][0]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block font-semibold text-ink">{student.name}</b>
                      <span className="block text-[14px] text-muted">
                        {[student.phone, student.classLevel, student.institution].filter(Boolean).join(" · ")}
                      </span>
                      {places.get(student.id)?.map((line) => (
                        <span key={line} className="block text-[14px] text-ink-2">
                          {line}
                        </span>
                      ))}
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      <span className="badge">{t.sources[student.source]}</span>
                      {student.status === "inactive" && <span className="badge badge-bad">{t.statuses.inactive}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {pages > 1 && (
            <nav className="flex flex-wrap items-center gap-3" aria-label={d.qbank.page(formatNumber(page, locale), formatNumber(pages, locale))}>
              {page > 1 && (
                <Link href={pageHref(page - 1)} className="btn btn-ghost btn-sm">
                  {d.qbank.prevPage}
                </Link>
              )}
              <span className="text-[15px] text-muted">{d.qbank.page(formatNumber(page, locale), formatNumber(pages, locale))}</span>
              {page < pages && (
                <Link href={pageHref(page + 1)} className="btn btn-ghost btn-sm">
                  {d.qbank.nextPage}
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
