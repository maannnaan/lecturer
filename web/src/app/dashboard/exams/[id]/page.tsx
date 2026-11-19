import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3, ChevronDown, ChevronUp, Eye, EyeOff, Send, Trash2 } from "lucide-react";
import { PendingButton } from "@/components/form";
import { QuestionPicker } from "@/components/question-picker";
import { RichContent } from "@/components/rich-content";
import { boardTag } from "@/components/qbank/views";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { chapterLabel } from "@/lib/chapter-label";
import { requireTeacher } from "@/server/auth/current";
import { listSubjectsWithChapters } from "@/server/bank";
import { listBatches } from "@/server/batches";
import { listCourses } from "@/server/courses";
import { getDb } from "@/server/db";
import { getExam, hasAttempts, listExamQuestions } from "@/server/exams";
import { listChapterQuestions } from "@/server/questions";
import { batchLabel } from "../../students/text";
import { addExamQuestionsAction, moveExamQuestionAction, publishExamAction, removeExamQuestionAction } from "../actions";
import { DeleteExamForm, ExamForm } from "../exam-forms";
import { STATE_BADGE, examFormText, examState, examValues } from "../text";

export const instant = false;

export const metadata: Metadata = { title: "পরীক্ষা" };

type Search = Promise<{ s?: string; c?: string }>;

/**
 * One exam: publishing it, its questions (and adding more from the bank: `?s=<subject>&c=<chapter>`
 * picks the chapter to choose from), its settings, and deleting it.
 */
export default async function ExamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const db = await getDb();
  const exam = await getExam(db, teacher.id, id);
  if (!exam) notFound();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.exams;
  const n = (value: number) => formatNumber(value, locale);
  const s = await searchParams;

  const [questions, subjects, courses, batches] = await Promise.all([
    listExamQuestions(db, teacher.id, exam.id),
    listSubjectsWithChapters(db, teacher.id),
    listCourses(db, teacher.id),
    listBatches(db, teacher.id),
  ]);
  const state = examState(exam, new Date());
  const locked = await hasAttempts(db, exam.id);

  // The chapter to choose questions from: the one asked for, else the first chapter there is.
  const subject = subjects.find((x) => x.id === s.s) ?? subjects.find((x) => x.chapters.length > 0) ?? subjects[0];
  const chapter = subject?.chapters.find((x) => x.id === s.c) ?? subject?.chapters[0];
  const inExam = new Set(questions.map((q) => q.questionId));
  const bank =
    subject && chapter && !locked
      ? (await listChapterQuestions(db, teacher.id, { subjectId: subject.id, chapterId: chapter.id }, { tab: "mcq", includePrivate: true, pageSize: 200 })).items
      : [];

  return (
    <main className="dash-content">
      <Link href="/dashboard/exams" className="link text-[15px]">
        <ArrowLeft aria-hidden="true" />
        {t.backToList}
      </Link>
      <header className="page-head">
        <div className="min-w-0">
          <h1 className="page-title">{exam.title}</h1>
          <p className="page-lead flex flex-wrap items-center gap-2">
            <span className={STATE_BADGE[state]}>{t.statuses[state]}</span>
            {t.questions(n(questions.length))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {exam.status === "published" && (
            <Link href={`/dashboard/exams/${exam.id}/results`} className="btn btn-ghost btn-sm">
              <BarChart3 aria-hidden="true" />
              {t.results}
            </Link>
          )}
          {exam.status === "draft" ? (
            <form action={publishExamAction}>
              <input type="hidden" name="examId" value={exam.id} />
              <PendingButton className="btn btn-primary btn-sm" disabled={questions.length === 0}>
                <Send aria-hidden="true" />
                {t.publish}
              </PendingButton>
            </form>
          ) : (
            !locked && (
              <form action={publishExamAction}>
                <input type="hidden" name="examId" value={exam.id} />
                <input type="hidden" name="unpublish" value="1" />
                <PendingButton className="btn btn-ghost btn-sm">
                  <EyeOff aria-hidden="true" />
                  {t.unpublish}
                </PendingButton>
              </form>
            )
          )}
        </div>
      </header>
      <p className={exam.status === "published" ? "form-ok" : "text-[15px] text-ink-2"} role="status">
        {exam.status === "published" ? (locked ? `${t.publishedNote} ${t.lockedNote}` : t.publishedNote) : questions.length === 0 ? t.needQuestions : t.publishHint}
      </p>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="card flex flex-col gap-4 p-5" aria-labelledby="questions-title">
            <div>
              <h2 id="questions-title" className="panel-title">
                {t.questionsTitle}
              </h2>
              <p className="panel-lead">{t.questionsLead}</p>
            </div>
            {questions.length === 0 ? (
              <p className="text-[15px] text-muted">{t.noQuestions}</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {questions.map((q, i) => (
                  <li key={q.id} className="flex items-start gap-3 rounded-lg border border-line p-3">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-[13px] font-bold text-ink-2">{n(i + 1)}</span>
                    <div className="line-clamp-3 min-w-0 flex-1 text-[15px] text-ink">{q.question ? <RichContent value={q.question.body.stem} /> : "—"}</div>
                    {!locked && (
                      <div className="row-actions shrink-0">
                        {(["up", "down"] as const).map((dir) => (
                          <form key={dir} action={moveExamQuestionAction}>
                            <input type="hidden" name="examQuestionId" value={q.id} />
                            <input type="hidden" name="direction" value={dir} />
                            <PendingButton
                              className="icon-btn"
                              disabled={dir === "up" ? i === 0 : i === questions.length - 1}
                              aria-label={`${dir === "up" ? d.common.moveUp : d.common.moveDown}: ${n(i + 1)}`}
                            >
                              {dir === "up" ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                            </PendingButton>
                          </form>
                        ))}
                        <form action={removeExamQuestionAction}>
                          <input type="hidden" name="examQuestionId" value={q.id} />
                          <PendingButton className="icon-btn" aria-label={`${t.remove}: ${n(i + 1)}`}>
                            <Trash2 aria-hidden="true" />
                          </PendingButton>
                        </form>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {!locked && subject && (
            <section className="card flex flex-col gap-4 p-5" aria-labelledby="bank-title">
              <h2 id="bank-title" className="panel-title">
                {t.fromBank}
              </h2>
              {/* Which chapter to choose from: a plain form, so the address carries it. */}
              <form className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <div className="field">
                  <label className="field-label" htmlFor="s">
                    {t.subject}
                  </label>
                  <select id="s" name="s" className="input" defaultValue={subject.id}>
                    {subjects.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="c">
                    {t.chapter}
                  </label>
                  <select id="c" name="c" className="input" defaultValue={chapter?.id ?? ""}>
                    {subject.chapters.map((x, i) => (
                      <option key={x.id} value={x.id}>
                        {`${chapterLabel(x, i, d, locale)}: ${x.title}`}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn btn-ghost">
                  <Eye aria-hidden="true" />
                  {t.show}
                </button>
              </form>
              {chapter && (
                <QuestionPicker
                  key={chapter.id}
                  action={addExamQuestionsAction}
                  hidden={{ examId: exam.id, subjectId: subject.id, chapterId: chapter.id }}
                  items={bank.map((q) => ({
                    id: q.id,
                    stem: <RichContent value={q.body.stem} />,
                    tags: [d.questions.types[q.type], q.board ? boardTag(q, d, locale) : q.source].filter(Boolean).join(" · "),
                    added: inExam.has(q.id),
                  }))}
                  t={{
                    pickHint: t.pickHint,
                    add: t.add,
                    already: t.already,
                    none: t.noMcqs,
                    randomCount: t.randomCount,
                    addRandom: t.addRandom,
                    saving: d.common.saving,
                  }}
                />
              )}
            </section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="settings-title" className="flex flex-col gap-3">
            <h2 id="settings-title" className="panel-title">
              {t.settings}
            </h2>
            <ExamForm
              exam={examValues(exam)}
              defaults={examValues(exam)}
              locked={locked}
              courses={courses.map((course) => ({
                id: course.id,
                title: course.title,
                batches: batches.filter((b) => b.courseId === course.id).map((b) => ({ id: b.id, label: batchLabel(b) })),
              }))}
              t={examFormText(d)}
              c={d.common}
            />
          </section>
          <DeleteExamForm examId={exam.id} t={t.delete} label={d.common.delete} />
        </div>
      </div>
    </main>
  );
}

