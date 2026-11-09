import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { Crumbs } from "@/components/bank-ui";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { BOARDS, QUESTION_TYPES, VISIBILITIES } from "@/lib/questions";
import { requireTeacher } from "@/server/auth/current";
import { listCoursesWithChapters } from "@/server/courses";
import { getDb } from "@/server/db";
import { BANK_PAGE_SIZE, type QuestionFilters, listQuestions } from "@/server/questions";
import { placeNames } from "../choices";
import { NoCourses } from "../no-courses";
import { QuestionRow } from "../question-row";

export const instant = false;

export const metadata: Metadata = { title: "সব প্রশ্ন" };

type Search = { course?: string; chapter?: string; type?: string; board?: string; visibility?: string; q?: string; page?: string };

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return (allowed as readonly string[]).includes(value ?? "") ? (value as T) : undefined;
}

/** Every question in one list, to search and filter across classes, subjects and chapters. */
export default async function AllQuestionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.bank;
  const s = await searchParams;
  const db = await getDb();
  const courses = await listCoursesWithChapters(db, teacher.id);
  const crumbs = (
    <Crumbs className="crumbs !pt-0" label={d.common.breadcrumb} items={[{ label: t.title, href: "/dashboard/bank" }, { label: t.allQuestions }]} />
  );

  if (courses.length === 0) {
    return (
      <main className="dash-content">
        {crumbs}
        <h2 className="text-2xl">{t.allQuestions}</h2>
        <NoCourses t={t} />
      </main>
    );
  }

  const course = courses.find((c) => c.id === s.course);
  // A chapter only counts with its own course chosen; "none" means questions filed under no chapter.
  const chapterId = course && (s.chapter === "none" || course.chapters.some((ch) => ch.id === s.chapter)) ? s.chapter : undefined;
  const filters: QuestionFilters = {
    courseId: course?.id,
    chapterId,
    type: oneOf(s.type, QUESTION_TYPES),
    board: s.board === "any" ? "any" : oneOf(s.board, BOARDS),
    visibility: oneOf(s.visibility, VISIBILITIES),
    search: s.q?.slice(0, 100),
    page: Math.max(1, Number(s.page) || 1),
  };
  const { items, total } = await listQuestions(db, teacher.id, filters);
  const pages = Math.max(1, Math.ceil(total / BANK_PAGE_SIZE));
  const page = Math.min(filters.page ?? 1, pages);
  const { courseTitle, chapterName } = placeNames(courses, d, locale);
  const filtered = Boolean(course || filters.type || filters.board || filters.visibility || filters.search);

  const query = (extra: Record<string, string | undefined>) => {
    const out = new URLSearchParams();
    const all = { course: course?.id, chapter: chapterId, type: filters.type, board: filters.board, visibility: filters.visibility, q: filters.search, ...extra };
    for (const [k, v] of Object.entries(all)) if (v) out.set(k, v);
    const text = out.toString();
    return text ? `?${text}` : "";
  };
  const newPlace = new URLSearchParams();
  if (course) newPlace.set("course", course.id);
  if (course && chapterId && chapterId !== "none") newPlace.set("chapter", chapterId);
  const newHref = `/dashboard/bank/new${newPlace.toString() ? `?${newPlace}` : ""}`;

  return (
    <main className="dash-content">
      {crumbs}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl">{t.allQuestions}</h2>
          <p className="mt-1 max-w-[52em] text-ink-2">{t.allLead}</p>
        </div>
        <Link href={newHref} className="btn btn-primary btn-sm">
          <Plus aria-hidden="true" />
          {t.new}
        </Link>
      </header>

      <AutoSubmitForm
        // Remount on every filter change, so "clear filters" and links can't leave stale choices showing.
        key={query({ page: undefined })}
        className="card grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))]"
        label={t.filters.apply}
      >
        <label className="field">
          <span className="field-label">{t.filters.course}</span>
          <select name="course" defaultValue={course?.id ?? ""} className="input">
            <option value="">{t.filters.all}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{t.filters.chapter}</span>
          <select name="chapter" defaultValue={chapterId ?? ""} className="input" disabled={!course}>
            <option value="">{t.filters.all}</option>
            {course?.chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {chapterName.get(ch.id)}
              </option>
            ))}
            {course && <option value="none">{t.filters.noChapter}</option>}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{t.filters.type}</span>
          <select name="type" defaultValue={filters.type ?? ""} className="input">
            <option value="">{t.filters.all}</option>
            {QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {d.questions.types[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{t.filters.board}</span>
          <select name="board" defaultValue={filters.board ?? ""} className="input">
            <option value="">{t.filters.all}</option>
            <option value="any">{t.filters.anyBoard}</option>
            {BOARDS.map((b) => (
              <option key={b} value={b}>
                {d.questions.boards[b]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">{t.filters.visibility}</span>
          <select name="visibility" defaultValue={filters.visibility ?? ""} className="input">
            <option value="">{t.filters.all}</option>
            {VISIBILITIES.map((option) => (
              <option key={option} value={option}>
                {d.dashboard.bank.form.visibilityOptions[option].split(":")[0]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-5">
          <label className="field min-w-[14rem] flex-1">
            <span className="field-label">{t.filters.search}</span>
            <input type="search" name="q" defaultValue={filters.search ?? ""} className="input" />
          </label>
          <button type="submit" className="btn btn-primary">
            <Search aria-hidden="true" />
            {t.filters.apply}
          </button>
          {filtered && (
            <Link href="/dashboard/bank/all" className="btn btn-ghost">
              {t.filters.clear}
            </Link>
          )}
        </div>
      </AutoSubmitForm>

      {items.length === 0 ? (
        <p className="card p-6 text-ink-2">{filtered ? t.noMatch : t.empty}</p>
      ) : (
        <>
          <p className="text-[15px] text-muted" role="status">
            {t.total(formatNumber(total, locale))}
          </p>
          <ul className="flex flex-col gap-3">
            {items.map((question) => (
              <QuestionRow
                key={question.id}
                question={question}
                d={d}
                locale={locale}
                place={[courseTitle.get(question.courseId), question.chapterId && chapterName.get(question.chapterId)].filter(Boolean).join(" · ")}
              />
            ))}
          </ul>
          {pages > 1 && (
            <nav className="flex flex-wrap items-center gap-3" aria-label={t.page(formatNumber(page, locale), formatNumber(pages, locale))}>
              {page > 1 && (
                <Link href={`/dashboard/bank/all${query({ page: String(page - 1) })}`} className="btn btn-ghost btn-sm">
                  {t.prev}
                </Link>
              )}
              <span className="text-[15px] text-muted">{t.page(formatNumber(page, locale), formatNumber(pages, locale))}</span>
              {page < pages && (
                <Link href={`/dashboard/bank/all${query({ page: String(page + 1) })}`} className="btn btn-ghost btn-sm">
                  {t.next}
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
