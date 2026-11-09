import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Copy, Eye } from "lucide-react";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { tabOf } from "@/lib/questions";
import { requireTeacher } from "@/server/auth/current";
import { listCoursesWithChapters } from "@/server/courses";
import { getDb } from "@/server/db";
import { getQuestion } from "@/server/questions";
import { duplicateQuestionAction } from "../actions";
import { courseChoices } from "../choices";
import { bankHref } from "../links";
import { DeleteQuestionForm, QuestionForm } from "../question-form";

export const instant = false;

export const metadata: Metadata = { title: "প্রশ্ন সম্পাদনা" };

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const db = await getDb();
  const question = await getQuestion(db, teacher.id, id);
  if (!question) notFound();
  const courses = await listCoursesWithChapters(db, teacher.id);
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.bank;

  const course = courses.find((c) => c.id === question.courseId);
  const chapter = course?.chapters.find((ch) => ch.id === question.chapterId);
  const onSite =
    question.visibility === "public" && course?.published && chapter
      ? `/${teacher.handle}/courses/${course.number}/chapters/${chapter.number}?tab=${tabOf(question.type)}`
      : null;

  return (
    <main className="dash-content">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={bankHref(question)} className="link text-[15px]">
          <ArrowLeft aria-hidden="true" />
          {t.backToBank}
        </Link>
        <div className="row-actions">
          <form action={duplicateQuestionAction}>
            <input type="hidden" name="questionId" value={question.id} />
            <button type="submit" className="btn btn-ghost btn-sm">
              <Copy aria-hidden="true" />
              {t.duplicate}
            </button>
          </form>
          {onSite && (
            <Link href={onSite} className="btn btn-ghost btn-sm">
              <Eye aria-hidden="true" />
              {t.viewOnSite}
            </Link>
          )}
        </div>
      </div>
      <h2 className="flex flex-wrap items-center gap-3 text-2xl">
        {t.editTitle}
        <span className="tag">{d.questions.types[question.type]}</span>
      </h2>
      <QuestionForm
        question={{
          id: question.id,
          type: question.type,
          courseId: question.courseId,
          chapterId: question.chapterId,
          visibility: question.visibility,
          body: question.body,
          board: question.board,
          year: question.year,
          source: question.source,
          videoUrl: question.videoUrl,
        }}
        type={question.type}
        courses={courseChoices(courses, d, locale)}
        defaults={{ courseId: question.courseId, chapterId: question.chapterId ?? "" }}
        t={t.form}
        q={d.questions}
        c={d.common}
        uploadErrors={{ type: d.errors.uploadType, size: d.errors.uploadSize, unavailable: d.errors.uploadOff }}
      />
      <DeleteQuestionForm questionId={question.id} t={t.remove} label={d.common.delete} />
    </main>
  );
}
