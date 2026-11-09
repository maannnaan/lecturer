import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, Pencil, Plus } from "lucide-react";
import { Crumbs, SectionChips } from "@/components/bank-ui";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { buildBankTree } from "@/lib/bank-tree";
import { chapterLabel } from "@/lib/chapter-label";
import { gradeName, gradeOf } from "@/lib/grades";
import { requireTeacher } from "@/server/auth/current";
import { getSubject } from "@/server/bank";
import { getDb } from "@/server/db";
import { bankCounts } from "@/server/questions";

export const instant = false;

export const metadata: Metadata = { title: "প্রশ্নব্যাংক" };

/** The bank's third level: one subject's chapters, with how many questions each section has. */
export default async function BankSubjectPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const teacher = await requireTeacher();
  const { subjectId } = await params;
  const db = await getDb();
  const subject = await getSubject(db, teacher.id, subjectId);
  if (!subject) notFound();
  const node = buildBankTree([subject], await bankCounts(db, teacher.id))[0].subjects[0];
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.bank;
  const grade = gradeOf(subject);
  const base = `/dashboard/bank/subject/${subject.id}`;
  const total = (n: number) => t.total(formatNumber(n, locale));
  const onSite = node.total > 0 ? `/${teacher.handle}/bank/${grade}/${subject.number}` : null;

  return (
    <main className="dash-content">
      <Crumbs
        className="crumbs !pt-0"
        label={d.common.breadcrumb}
        items={[
          { label: t.title, href: "/dashboard/bank" },
          { label: gradeName(grade, d).label, href: `/dashboard/bank/class/${grade}` },
          { label: subject.name },
        ]}
      />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl">{subject.name}</h2>
          <p className="mt-1 text-ink-2">{`${t.chapters(formatNumber(subject.chapters.length, locale))} · ${total(node.total)}`}</p>
        </div>
        <div className="row-actions">
          {onSite && (
            <Link href={onSite} className="btn btn-ghost btn-sm">
              <Eye aria-hidden="true" />
              {t.viewOnSite}
            </Link>
          )}
          <Link href={`${base}/edit`} className="btn btn-ghost btn-sm">
            <Pencil aria-hidden="true" />
            {t.editSubject}
          </Link>
          <Link href={`/dashboard/bank/new?subject=${subject.id}`} className="btn btn-primary btn-sm">
            <Plus aria-hidden="true" />
            {t.new}
          </Link>
        </div>
      </header>

      {subject.chapters.length === 0 && (
        <div className="card flex flex-col items-start gap-3 p-6">
          <p className="text-ink-2">{t.noChapters}</p>
          <Link href={`${base}/edit#chapters`} className="btn btn-primary btn-sm">
            <Plus aria-hidden="true" />
            {t.chaptersEditor.add}
          </Link>
        </div>
      )}
      {(subject.chapters.length > 0 || node.unfiled.total > 0) && (
        <ul className="card ch-rows">
          {node.chapters.map(({ chapter, counts: sections, total: n }, i) => (
            <li key={chapter.id}>
              <Link href={`${base}/${chapter.id}`} className="ch-row">
                <span className="min-w-0">
                  <span className="ch-row-label">{chapterLabel(chapter, i, d, locale)}</span>
                  <span className="ch-row-title">{chapter.title}</span>
                </span>
                <span className="ch-row-side">
                  <SectionChips counts={sections} d={d} locale={locale} />
                  <span className="ch-row-total">{total(n)}</span>
                </span>
              </Link>
            </li>
          ))}
          {node.unfiled.total > 0 && (
            <li>
              <Link href={`${base}/unfiled`} className="ch-row">
                <span className="min-w-0">
                  <span className="ch-row-title">{t.unfiled}</span>
                </span>
                <span className="ch-row-side">
                  <SectionChips counts={node.unfiled.counts} d={d} locale={locale} />
                  <span className="ch-row-total">{total(node.unfiled.total)}</span>
                </span>
              </Link>
            </li>
          )}
        </ul>
      )}
    </main>
  );
}
