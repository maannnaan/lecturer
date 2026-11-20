import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Download, EyeOff, Send, Trash2 } from "lucide-react";
import { PendingButton } from "@/components/form";
import { QbPrintButton } from "@/components/qbank/auto-print";
import { formatMarks, formatNumber, formatRoll, formatYear, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { marksOf } from "@/lib/exams";
import { setCodes } from "@/lib/papers";
import { requireTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { paperResultsView } from "@/server/paper-results";
import { listPaperQuestions } from "@/server/papers";
import { deleteResultAction, publishResultsAction, setWrittenAction } from "../../actions";
import { ResultEntryForm } from "../../result-forms";

export const instant = false;

export const metadata: Metadata = { title: "প্রশ্নপত্রের ফলাফল", robots: { index: false } };

/**
 * A final paper's results: typing in its answer sheets, letting its students see their results,
 * the merit list (with each sheet's written marks), and who of its students has no sheet in.
 */
export default async function PaperResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const db = await getDb();
  const view = await paperResultsView(db, teacher.id, id);
  if (!view) notFound();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.papers;
  const r = t.results;
  const n = (value: number) => formatNumber(value, locale);
  const { paper, rows, absent, mcqCount } = view;
  const hasWritten = (await listPaperQuestions(db, teacher.id, paper.id)).some((q) => q.section === "written");
  const published = paper.resultsPublishedAt !== null;
  const base = `/dashboard/papers/${paper.id}`;

  return (
    <main className="dash-content">
      <div className="flex flex-wrap items-center justify-between gap-3" data-print-hide>
        <Link href={base} className="link text-[15px]">
          <ArrowLeft aria-hidden="true" />
          {paper.title}
        </Link>
        {rows.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <a href={`${base}/results/export`} className="btn btn-ghost btn-sm" download>
              <Download aria-hidden="true" />
              {r.csv}
            </a>
            <QbPrintButton label={r.print} className="btn btn-ghost btn-sm" />
          </div>
        )}
      </div>
      <header>
        <h1 className="page-title">{r.pageTitle(paper.title)}</h1>
        <p className="page-lead">{[r.sheetsIn(n(rows.length)), t.mcqCount(n(mcqCount)), t.setCount(n(paper.setCount))].join(" · ")}</p>
      </header>

      {paper.status !== "final" ? (
        <p className="card p-6 text-ink-2">{r.notFinal}</p>
      ) : (
        <>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]" data-print-hide>
            <section className="card flex flex-col gap-4 p-5" aria-labelledby="entry-title">
              <div>
                <h2 id="entry-title" className="panel-title">
                  {r.entryTitle}
                </h2>
                <p className="panel-lead">{r.lead}</p>
              </div>
              <ResultEntryForm
                paperId={paper.id}
                codes={setCodes(paper).map((code) => ({ value: String(code), label: formatYear(code, locale) }))}
                mcqCount={mcqCount}
                hasWritten={hasWritten}
                bangla={locale === "bn"}
                t={{
                  roll: r.roll,
                  setCode: r.setCode,
                  answers: r.answers,
                  answersHint: r.answersHint,
                  answersCount: r.answersCount,
                  written: r.written,
                  optional: d.common.optional,
                  save: r.save,
                  saving: d.common.saving,
                }}
              />
            </section>
            <section className="card flex flex-col gap-3 p-5" aria-labelledby="publish-title">
              <h2 id="publish-title" className="panel-title">
                {r.publishTitle}
              </h2>
              <p className={published ? "form-ok" : "text-[15px] text-ink-2"} role="status">
                {published ? r.publishedNote : r.unpublishedNote}
              </p>
              <form action={publishResultsAction}>
                <input type="hidden" name="paperId" value={paper.id} />
                {published && <input type="hidden" name="hide" value="1" />}
                <PendingButton className={published ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"} disabled={!published && rows.length === 0}>
                  {published ? <EyeOff aria-hidden="true" /> : <Send aria-hidden="true" />}
                  {published ? r.unpublish : r.publish}
                </PendingButton>
              </form>
            </section>
          </div>

          {/* Positioned, so the column heading's hidden label scrolls with the table instead of widening the page. */}
          <section className="card relative overflow-x-auto" aria-labelledby="merit-title">
            <h2 id="merit-title" className="panel-title px-5 pt-5">
              {r.merit}
            </h2>
            {rows.length === 0 ? (
              <p className="px-5 py-4 text-ink-2">{r.noResults}</p>
            ) : (
              <table className="routine roster mt-2">
                <thead>
                  <tr>
                    <th scope="col">{r.rank}</th>
                    <th scope="col">{r.roll}</th>
                    <th scope="col">{r.name}</th>
                    <th scope="col">{r.set}</th>
                    <th scope="col">{r.right}</th>
                    <th scope="col">{r.wrong}</th>
                    <th scope="col">{r.blank}</th>
                    <th scope="col">{r.doubled}</th>
                    <th scope="col">{r.mcq}</th>
                    {hasWritten && <th scope="col">{r.written2}</th>}
                    <th scope="col">{r.total}</th>
                    <th scope="col" data-print-hide>
                      <span className="sr-only">{r.remove}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const roll = formatRoll(row.roll, locale);
                    const written = row.writtenHundredths === null ? "" : String(marksOf(row.writtenHundredths));
                    return (
                      <tr key={row.id}>
                        <td>{n(row.rank)}</td>
                        <td>{roll}</td>
                        <td>
                          {row.studentId ? (
                            <Link href={`/dashboard/students/${row.studentId}`} className="tl-link">
                              {row.name}
                            </Link>
                          ) : (
                            <span className="text-muted">{r.nobody}</span>
                          )}
                        </td>
                        <td>{formatYear(row.setCode, locale)}</td>
                        <td>{n(row.correct)}</td>
                        <td>{n(row.wrong)}</td>
                        <td>{n(row.blank)}</td>
                        <td>{n(row.doubled)}</td>
                        <td>{formatMarks(row.scoreHundredths, locale)}</td>
                        {hasWritten && (
                          <td>
                            <span className="hidden print:inline">{row.writtenHundredths === null ? "—" : formatMarks(row.writtenHundredths, locale)}</span>
                            <form action={setWrittenAction} className="flex items-center gap-1 print:hidden">
                              <input type="hidden" name="resultId" value={row.id} />
                              <input name="written" aria-label={`${r.written}: ${roll}`} className="input !h-9 w-20 !px-2" inputMode="decimal" defaultValue={written} />
                              <PendingButton className="icon-btn" aria-label={`${r.saveWritten}: ${roll}`}>
                                <Check aria-hidden="true" />
                              </PendingButton>
                            </form>
                          </td>
                        )}
                        <td className="font-semibold text-ink">{formatMarks(row.totalHundredths, locale)}</td>
                        <td data-print-hide>
                          <form action={deleteResultAction}>
                            <input type="hidden" name="resultId" value={row.id} />
                            <PendingButton className="icon-btn" aria-label={`${r.remove}: ${roll}`}>
                              <Trash2 aria-hidden="true" />
                            </PendingButton>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          {absent.length > 0 && (
            <section className="card p-5" aria-labelledby="absent-title" data-print-hide>
              <h2 id="absent-title" className="panel-title">
                {r.absent} ({n(absent.length)})
              </h2>
              <p className="mt-2 text-[15px] text-ink-2">{absent.map((p) => `${p.name} (${p.roll ? formatRoll(p.roll, locale) : r.noRoll})`).join(", ")}</p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
