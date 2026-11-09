import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { QUESTION_TYPES, type QuestionType } from "@/lib/questions";
import { requireTeacher } from "@/server/auth/current";
import { listCoursesWithChapters } from "@/server/courses";
import { getDb } from "@/server/db";
import { courseChoices } from "../choices";
import { QuestionForm } from "../question-form";

export const instant = false;

export const metadata: Metadata = { title: "নতুন প্রশ্ন" };

type Search = { type?: string; course?: string; chapter?: string; added?: string };

export default async function NewQuestionPage({ searchParams }: { searchParams: Promise<Search> }) {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.bank;
  const s = await searchParams;
  const courses = await listCoursesWithChapters(await getDb(), teacher.id);

  const back = (
    <Link href="/dashboard/bank" className="link text-[15px]">
      <ArrowLeft aria-hidden="true" />
      {t.backToBank}
    </Link>
  );

  if (courses.length === 0) {
    return (
      <main className="dash-content">
        {back}
        <div className="card flex flex-col items-start gap-3 p-6">
          <p className="text-ink-2">{t.noCourses}</p>
          <Link href="/dashboard/courses/new" className="btn btn-primary btn-sm">
            <Plus aria-hidden="true" />
            {t.createCourse}
          </Link>
        </div>
      </main>
    );
  }

  const course = courses.find((c) => c.id === s.course) ?? courses[0];
  const chapterId = course.chapters.some((ch) => ch.id === s.chapter) ? s.chapter! : "";
  const type = (QUESTION_TYPES as readonly string[]).includes(s.type ?? "") ? (s.type as QuestionType) : null;
  const place = new URLSearchParams({ course: course.id });
  if (chapterId) place.set("chapter", chapterId);

  if (!type) {
    return (
      <main className="dash-content">
        {back}
        <h2 className="text-2xl">{t.pickType}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {QUESTION_TYPES.map((option) => (
            <li key={option}>
              <Link href={`/dashboard/bank/new?type=${option}&${place}`} className="card flex h-full items-start gap-3 p-4 hover:border-primary">
                <span className="min-w-0 flex-1">
                  <b className="block text-lg text-ink">{d.questions.types[option]}</b>
                  <span className="text-[14.5px] text-ink-2">{d.questions.typeHints[option]}</span>
                </span>
                <ArrowRight className="mt-1 size-5 text-primary-text" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="dash-content">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {back}
        <Link href={`/dashboard/bank/new?${place}`} className="btn btn-ghost btn-sm">
          {t.changeType}
        </Link>
      </div>
      <h2 className="text-2xl">
        {t.newTitle}: {d.questions.types[type]}
      </h2>
      {s.added && (
        <p className="form-ok" role="status">
          {t.added}
        </p>
      )}
      <QuestionForm
        // A fresh, empty form after each "add and write the next".
        key={s.added ?? "new"}
        type={type}
        courses={courseChoices(courses, d, locale)}
        defaults={{ courseId: course.id, chapterId }}
        t={t.form}
        q={d.questions}
        c={d.common}
        uploadErrors={{ type: d.errors.uploadType, size: d.errors.uploadSize, unavailable: d.errors.uploadOff }}
      />
    </main>
  );
}
