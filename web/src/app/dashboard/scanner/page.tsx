import type { Metadata } from "next";
import Link from "next/link";
import { Download, ScanLine } from "lucide-react";
import { formatNumber, formatYear, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { OMR_APP_URL } from "@/lib/omr";
import { requireTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { omrPaperList } from "@/server/omr-api";

export const instant = false;

export const metadata: Metadata = { title: "স্ক্যানার অ্যাপ" };

/** The OMR Scanner app: where to get it, how it works with the question papers, and which papers it will find. */
export default async function ScannerPage() {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.scanner;
  const papers = await omrPaperList(await getDb(), teacher, "");
  const n = (value: number) => formatNumber(value, locale);

  return (
    <main className="dash-content max-w-[960px]">
      <header>
        <h1 className="page-title">{t.title}</h1>
        <p className="page-lead">{t.lead}</p>
      </header>

      <section className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center" aria-label={t.download}>
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary" aria-hidden="true">
          <ScanLine className="size-6" />
        </span>
        <p className="min-w-0 flex-1 text-[15px] text-ink-2">{t.downloadNote}</p>
        <a href={OMR_APP_URL} className="btn btn-primary self-start sm:self-auto">
          <Download aria-hidden="true" />
          {t.download}
        </a>
      </section>

      <section aria-labelledby="steps-title" className="flex flex-col gap-3">
        <h2 id="steps-title" className="panel-title">
          {t.stepsTitle}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {t.steps.map((step, i) => (
            <li key={step.title} className="card flex gap-3 p-5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[14px] font-bold text-ink-2">{n(i + 1)}</span>
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold text-ink">{step.title}</h3>
                <p className="mt-1 text-[15px] text-ink-2">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card p-5" aria-labelledby="papers-title">
        <h2 id="papers-title" className="panel-title">
          {t.papersTitle}
        </h2>
        <p className="panel-lead">{t.papersLead}</p>
        {papers.length === 0 ? (
          <div className="mt-3 flex flex-col items-start gap-3">
            <p className="text-[15px] text-muted">{t.noPapers}</p>
            <Link href="/dashboard/papers" className="btn btn-ghost btn-sm">
              {t.toPapers}
            </Link>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {papers.map((paper) => (
              <li key={paper.id}>
                <Link href={`/dashboard/papers/${paper.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:text-primary">
                  <span className="badge">{paper.code}</span>
                  <b className="min-w-0 flex-1 font-semibold text-ink">{paper.title}</b>
                  <span className="text-[14px] text-muted">
                    {[d.dashboard.papers.mcqCount(n(paper.questions)), d.dashboard.papers.printRun(formatYear(Number(paper.firstSet), locale), formatYear(Number(paper.lastSet), locale))].join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
