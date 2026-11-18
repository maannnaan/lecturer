import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { QbPrintButton } from "@/components/qbank/auto-print";
import { RichContent } from "@/components/rich-content";
import { formatDateTime, formatMarks, formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { examResults } from "@/server/exams";

export const instant = false;

export const metadata: Metadata = { title: "পরীক্ষার ফলাফল" };

/** "১২:০৫": minutes and seconds. */
function duration(ms: number, locale: "bn" | "en"): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const two = (value: number) => formatNumber(value, locale).padStart(2, locale === "bn" ? "০" : "0");
  return `${formatNumber(Math.floor(seconds / 60), locale)}:${two(seconds % 60)}`;
}

/**
 * An exam's results: the merit list, who is still sitting it and who hasn't, and how each question
 * went (how many got it right, and which options were picked). Printable.
 */
export default async function ExamResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const results = await examResults(await getDb(), teacher.id, id, new Date());
  if (!results) notFound();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.exams;
  const n = (value: number) => formatNumber(value, locale);
  const { exam, merit, sitting, absent, questions } = results;
  const total = questions.length * exam.markHundredths;

  return (
    <main className="dash-content">
      <div className="flex flex-wrap items-center justify-between gap-3" data-print-hide>
        <Link href={`/dashboard/exams/${exam.id}`} className="link text-[15px]">
          <ArrowLeft aria-hidden="true" />
          {exam.title}
        </Link>
        {merit.length > 0 && <QbPrintButton label={t.print} className="btn btn-ghost btn-sm" />}
      </div>
      <header>
        <h1 className="page-title">
          {t.results}: {exam.title}
        </h1>
        <p className="page-lead">
          {[formatDateTime(exam.startsAt, locale), t.questions(n(questions.length)), t.sat(n(merit.length))].join(" · ")}
        </p>
      </header>

      <section className="card overflow-x-auto" aria-labelledby="merit-title">
        <h2 id="merit-title" className="panel-title px-5 pt-5">
          {t.merit}
        </h2>
        {merit.length === 0 ? (
          <p className="px-5 py-4 text-ink-2">{t.noOneYet}</p>
        ) : (
          <table className="routine roster mt-2">
            <thead>
              <tr>
                <th scope="col">{t.rank}</th>
                <th scope="col">{t.name}</th>
                <th scope="col">{t.roll}</th>
                <th scope="col">{t.score}</th>
                <th scope="col">{t.right}</th>
                <th scope="col">{t.wrong}</th>
                <th scope="col">{t.skipped}</th>
                <th scope="col">{t.took}</th>
              </tr>
            </thead>
            <tbody>
              {merit.map((row) => (
                <tr key={row.attemptId}>
                  <td>{n(row.rank)}</td>
                  <td>
                    <Link href={`/dashboard/students/${row.studentId}`} className="tl-link">
                      {row.name}
                    </Link>
                  </td>
                  <td>{row.roll ? n(Number(row.roll)) : "—"}</td>
                  <td className="font-semibold text-ink">{t.outOf(formatMarks(row.scoreHundredths, locale), formatMarks(total, locale))}</td>
                  <td>{n(row.correct)}</td>
                  <td>{n(row.wrong)}</td>
                  <td>{n(row.skipped)}</td>
                  <td>{duration(row.tookMs, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {(sitting.length > 0 || absent.length > 0) && (
        <div className="grid items-start gap-6 md:grid-cols-2" data-print-hide>
          {sitting.length > 0 && (
            <section className="card p-5" aria-labelledby="sitting-title">
              <h2 id="sitting-title" className="panel-title">
                {t.sitting} ({n(sitting.length)})
              </h2>
              <p className="mt-2 text-[15px] text-ink-2">{sitting.map((x) => x.name).join(", ")}</p>
            </section>
          )}
          {absent.length > 0 && (
            <section className="card p-5" aria-labelledby="absent-title">
              <h2 id="absent-title" className="panel-title">
                {t.absent} ({n(absent.length)})
              </h2>
              <p className="mt-2 text-[15px] text-ink-2">{absent.map((x) => x.name).join(", ")}</p>
            </section>
          )}
        </div>
      )}

      {merit.length > 0 && (
        <section className="card p-5" aria-labelledby="questions-title" data-print-hide>
          <h2 id="questions-title" className="panel-title">
            {t.perQuestion}
          </h2>
          <ol className="mt-3 flex flex-col divide-y divide-line">
            {questions.map((q, i) => {
              const share = q.sat > 0 ? q.right / q.sat : 0;
              return (
                <li key={q.id} className="flex flex-col gap-2 py-3.5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-[13px] font-bold text-ink-2">{n(i + 1)}</span>
                    <div className="line-clamp-2 min-w-0 flex-1 text-[15px] text-ink">
                      <RichContent value={q.question.body.stem} />
                    </div>
                    <b className={`shrink-0 text-[14.5px] ${share < 0.4 ? "text-bad" : "text-ink"}`}>{t.rightOf(n(q.right), n(q.sat))}</b>
                  </div>
                  <div className="progress ml-10" aria-hidden="true">
                    <i style={{ width: `${Math.round(share * 100)}%` }} />
                  </div>
                  <p className="ml-10 text-[13.5px] text-muted">
                    {q.picks
                      .map((count, k) => `${d.questions.optionKeys[k]}${k === q.question.body.answer ? " ✓" : ""}: ${n(count)}`)
                      .join(" · ")}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </main>
  );
}
