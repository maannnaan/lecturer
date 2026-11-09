import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { QUESTION_TYPES, type QuestionType, tabOf } from "@/lib/questions";
import { requireTeacher } from "@/server/auth/current";
import { listSubjectsWithChapters } from "@/server/bank";
import { getDb } from "@/server/db";
import { subjectChoices } from "../choices";
import { NoSubjects } from "../no-subjects";
import { QuestionForm } from "../question-form";

export const instant = false;

export const metadata: Metadata = { title: "নতুন প্রশ্ন" };

type Search = { type?: string; subject?: string; chapter?: string; added?: string };

export default async function NewQuestionPage({ searchParams }: { searchParams: Promise<Search> }) {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.bank;
  const s = await searchParams;
  const subjects = await listSubjectsWithChapters(await getDb(), teacher.id);
  const type = (QUESTION_TYPES as readonly string[]).includes(s.type ?? "") ? (s.type as QuestionType) : null;

  // Back to where the teacher came from: the chapter (on this type's section), the subject, or the bank.
  const asked = subjects.find((x) => x.id === s.subject);
  const askedChapter = asked?.chapters.find((ch) => ch.id === s.chapter);
  const backHref = asked
    ? `/dashboard/bank/subject/${asked.id}${askedChapter ? `/${askedChapter.id}${type ? `?tab=${tabOf(type)}` : ""}` : ""}`
    : "/dashboard/bank";
  const back = (
    <Link href={backHref} className="link text-[15px]">
      <ArrowLeft aria-hidden="true" />
      {t.backToBank}
    </Link>
  );

  if (subjects.length === 0) {
    return (
      <main className="dash-content">
        {back}
        <NoSubjects t={t} />
      </main>
    );
  }

  const subject = asked ?? subjects[0];
  const chapterId = askedChapter?.id ?? "";
  const place = new URLSearchParams({ subject: subject.id });
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
                  <span className="tag mb-2">{d.questions.tabs[tabOf(option)]}</span>
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
        subjects={subjectChoices(subjects, d, locale)}
        defaults={{ subjectId: subject.id, chapterId }}
        t={t.form}
        q={d.questions}
        c={d.common}
        uploadErrors={{ type: d.errors.uploadType, size: d.errors.uploadSize, unavailable: d.errors.uploadOff }}
      />
    </main>
  );
}
