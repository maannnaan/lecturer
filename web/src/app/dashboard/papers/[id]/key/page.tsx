import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { QbPrintButton } from "@/components/qbank/auto-print";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { setCodes } from "@/lib/papers";
import { requireTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { getPaper, listPaperQuestions, paperSets } from "@/server/papers";

export const instant = false;

export const metadata: Metadata = { title: "উত্তরমালা", robots: { index: false } };

/** Every set's answer key, in the order that set prints its MCQs. Printable. */
export default async function PaperKeyPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const db = await getDb();
  const paper = await getPaper(db, teacher.id, id);
  if (!paper) notFound();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.papers;
  const n = (value: number) => formatNumber(value, locale);
  const sets = paperSets(paper, await listPaperQuestions(db, teacher.id, paper.id), setCodes(paper));

  return (
    <main className="dash-content print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3" data-print-hide>
        <Link href={`/dashboard/papers/${paper.id}`} className="link text-[15px]">
          <ArrowLeft aria-hidden="true" />
          {paper.title}
        </Link>
        <QbPrintButton label={t.printAgain} className="btn btn-ghost btn-sm" />
      </div>
      <header>
        <h1 className="page-title">{t.keyTitle(paper.title)}</h1>
        <p className="page-lead">{t.keyLead}</p>
      </header>
      {paper.status === "draft" && (
        <p className="form-alert" role="status" data-print-hide>
          {t.draftBanner}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {sets.map((set) => (
          <section key={set.code} className="card break-inside-avoid p-5" aria-labelledby={`set-${set.code}`}>
            <h2 id={`set-${set.code}`} className="panel-title">
              {t.printSet(n(set.code))}
            </h2>
            <ol className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-x-3 gap-y-1.5 text-[15px]">
              {set.key.map((answer, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="font-num text-muted">{n(i + 1)}.</span>
                  <b className="text-ink">{answer >= 0 ? d.questions.optionKeys[answer] : "—"}</b>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </main>
  );
}
