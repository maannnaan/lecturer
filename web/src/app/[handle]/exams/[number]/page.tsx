import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Check, Clock, X } from "lucide-react";
import { PendingButton } from "@/components/form";
import { RichContent } from "@/components/rich-content";
import { formatDateTime, formatMarks, formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getCurrentStudent } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { examResults, getStudentExam, resultVisible, sittingView } from "@/server/exams";
import { getSite } from "../../data";
import { startExamAction } from "../../student-actions";
import { ExamTaker } from "../exam-taker";

export const instant = false;

export const metadata: Metadata = { robots: { index: false } };

type Props = { params: Promise<{ handle: string; number: string }> };

/**
 * One exam, for a student who may sit it: before it opens, what it is; while it is open, the start
 * button and then the questions with the clock; afterwards, their marks and place (when the exam
 * says they may see them) and, if the teacher allows it, the right answers. The answers are never
 * on the page before the result is.
 */
export default async function StudentExamPage({ params }: Props) {
  const { handle, number } = await params;
  const site = await getSite(handle.toLowerCase());
  if (!site || !/^\d{1,6}$/.test(number)) notFound();
  const teacher = site.teacher;
  const student = await getCurrentStudent(teacher.id);
  if (!student) redirect(`/${teacher.handle}/login`);
  const db = await getDb();
  const now = new Date();
  const found = await getStudentExam(db, teacher.id, student.id, Number(number), now);
  if (!found) notFound();
  const { exam, attempt, questionCount } = found;
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);
  const t = d.site.student;
  const home = `/${teacher.handle}`;
  const n = (value: number) => formatNumber(value, locale);
  const numbers = Array.from({ length: 201 }, (_, i) => n(i));
  const view = attempt ? await sittingView(db, attempt, false) : [];
  const total = questionCount * exam.markHundredths;

  const header = (
    <>
      <Link href={`${home}/exams`} className="link text-[15px]" data-print-hide>
        <ArrowLeft aria-hidden="true" />
        {t.exams}
      </Link>
      <header>
        <h1 className="text-[clamp(24px,4vw,34px)]">{exam.title}</h1>
        <p className="mt-1 text-ink-2">
          {[t.examFacts(n(questionCount), n(exam.durationMin)), t.marking(formatMarks(exam.markHundredths, locale), formatMarks(exam.negativeHundredths, locale))]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>
    </>
  );

  // Sitting it now: the questions without their answers, and the clock.
  if (attempt && !attempt.submittedAt) {
    return (
      <main className="section !pt-8">
        <div className="wrap flex max-w-[860px] flex-col gap-5">
          {header}
          <ExamTaker
            handle={teacher.handle}
            number={exam.number}
            attemptId={attempt.id}
            deadline={attempt.deadlineAt.getTime()}
            serverNow={now.getTime()}
            initial={attempt.answers}
            questions={view.map((q) => ({
              id: q.id,
              stem: <RichContent value={q.stem} />,
              statements: q.statements.map((s, i) => ({ key: d.questions.statementKeys[i] ?? String(i + 1), text: <RichContent value={s} inline /> })),
              prompt: q.type === "mcq_multi" ? q.prompt || d.questions.defaultPrompt : "",
              options: q.optionOrder.map((index, place) => ({ index, key: d.questions.optionKeys[place] ?? String(place + 1), text: <RichContent value={q.options[index]} inline /> })),
            }))}
            t={{
              timeLeft: t.timeLeft,
              answered: Array.from({ length: view.length + 1 }, (_, i) => t.answered(n(i), n(view.length))),
              saving: t.saving,
              saved: t.savedAnswer,
              saveFailed: t.saveFailed,
              clear: t.clear,
              submit: t.submitExam,
              confirmSubmit: t.confirmSubmit,
              numbers,
            }}
          />
        </div>
      </main>
    );
  }

  // Handed in: the result, when the exam lets them see it.
  if (attempt?.submittedAt) {
    const visible = resultVisible(exam, attempt, now);
    const results = visible ? await examResults(db, teacher.id, exam.id, now) : null;
    const place = results?.merit.find((row) => row.attemptId === attempt.id);
    const review = visible && exam.showAnswers ? await sittingView(db, attempt, true) : [];
    return (
      <main className="section !pt-8">
        <div className="wrap flex max-w-[860px] flex-col gap-5">
          {header}
          {!visible ? (
            <div className="card flex flex-col items-start gap-2 p-6">
              <p className="form-ok" role="status">
                {t.submitted}
              </p>
              <p className="text-ink-2">{t.resultLater(formatDateTime(exam.endsAt, locale))}</p>
            </div>
          ) : (
            <section className="card flex flex-wrap items-center gap-x-8 gap-y-3 p-6" aria-labelledby="score-title">
              <div>
                <p id="score-title" className="text-[15px] text-ink-2">
                  {t.yourScore}
                </p>
                <p className="font-num text-[40px] leading-tight font-bold text-ink">
                  {d.dashboard.exams.outOf(formatMarks(attempt.scoreHundredths ?? 0, locale), formatMarks(total, locale))}
                </p>
                {place && results && <p className="font-semibold text-primary-text">{t.yourRank(n(place.rank), n(results.merit.length))}</p>}
              </div>
              <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[15px]">
                {(
                  [
                    [d.dashboard.exams.right, attempt.correct],
                    [d.dashboard.exams.wrong, attempt.wrong],
                    [d.dashboard.exams.skipped, attempt.skipped],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted">{label}</dt>
                    <dd className="font-num text-[22px] font-bold text-ink">{n(value ?? 0)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {review.length > 0 && (
            <section className="flex flex-col gap-4" aria-labelledby="review-title">
              <h2 id="review-title" className="text-xl">
                {t.review}
              </h2>
              <ol className="flex flex-col gap-4">
                {review.map((q, i) => {
                  const given = attempt.answers[q.id];
                  return (
                    <li key={q.id} className="card p-5">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[14px] font-bold text-ink-2">{n(i + 1)}</span>
                        <div className="min-w-0 flex-1 text-[16px] text-ink">
                          <RichContent value={q.stem} />
                        </div>
                        {given === undefined ? (
                          <span className="badge">{t.notAnswered}</span>
                        ) : given === q.answer ? (
                          <Check className="size-6 shrink-0 text-ok" aria-label={t.rightAnswer} />
                        ) : (
                          <X className="size-6 shrink-0 text-bad" aria-label={t.yourAnswer} />
                        )}
                      </div>
                      <div className="options">
                        {q.optionOrder.map((index, place) => (
                          <div key={index} className={`opt ${index === q.answer ? "correct" : index === given ? "wrong" : ""}`}>
                            <span className="k">{d.questions.optionKeys[place]}</span>
                            <span className="min-w-0">
                              <RichContent value={q.options[index]} inline />
                            </span>
                          </div>
                        ))}
                      </div>
                      {q.explanation && (
                        <div className="explain">
                          <b>{d.questions.explanation}</b> <RichContent value={q.explanation} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </div>
      </main>
    );
  }

  // Not started: what it is, and the way in while it is open.
  const open = now >= exam.startsAt && now < exam.endsAt;
  return (
    <main className="section !pt-8">
      <div className="wrap flex max-w-[720px] flex-col gap-5">
        {header}
        <section className="card flex flex-col gap-4 p-6">
          <p className="flex items-center gap-2 text-[15.5px] text-ink-2">
            <Clock className="size-5 text-primary-text" aria-hidden="true" />
            {t.opensAt(formatDateTime(exam.startsAt, locale))} · {t.closesAt(formatDateTime(exam.endsAt, locale))}
          </p>
          {exam.instructions && <p className="rounded-md bg-surface-2 p-4 text-[15.5px] whitespace-pre-line text-ink-2">{exam.instructions}</p>}
          {open ? (
            <form action={startExamAction} className="flex flex-col gap-3">
              <input type="hidden" name="handle" value={teacher.handle} />
              <input type="hidden" name="examId" value={exam.id} />
              <input type="hidden" name="number" value={exam.number} />
              <p className="text-[14.5px] text-muted">{t.startNote}</p>
              <PendingButton className="btn btn-primary self-start">{t.startExam}</PendingButton>
            </form>
          ) : (
            <p className="form-alert">{now < exam.startsAt ? t.notYet : t.closed}</p>
          )}
        </section>
      </div>
    </main>
  );
}
