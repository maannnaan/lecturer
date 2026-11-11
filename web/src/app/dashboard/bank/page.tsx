import type { Metadata } from "next";
import Link from "next/link";
import { cx, qbButton } from "@/components/qbank/ui";
import { type QbCtx, QbClassesView } from "@/components/qbank/views";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { buildBankTree } from "@/lib/bank-tree";
import { gradeName } from "@/lib/grades";
import { requireTeacher } from "@/server/auth/current";
import { listSubjectsWithChapters } from "@/server/bank";
import { getDb } from "@/server/db";
import { bankCounts } from "@/server/questions";

export const instant = false;

export const metadata: Metadata = { title: "প্রশ্নব্যাংক" };

/** The bank's first level: search, the teacher's tools, and the classes their subjects are for. */
export default async function BankPage() {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.bank;
  const ctx: QbCtx = { d, locale, voice: t.qb, titleAs: "h2" };
  const db = await getDb();
  const [subjects, counts] = await Promise.all([listSubjectsWithChapters(db, teacher.id), bankCounts(db, teacher.id)]);
  const tree = buildBankTree(subjects, counts);

  const band = (
    <>
      <div className="flex flex-wrap gap-2.5">
        {subjects.length > 0 && (
          <Link href="/dashboard/bank/new" className={cx(qbButton.accent, "h-11 px-4")}>
            + {t.new}
          </Link>
        )}
        <Link href="/dashboard/bank/subject/new" className={cx(subjects.length > 0 ? qbButton.outline : qbButton.accent, "h-11 px-4")}>
          + {t.newSubject}
        </Link>
        {subjects.length > 0 && (
          <Link href="/dashboard/bank/all" className={cx(qbButton.outline, "h-11 px-4")}>
            {t.allQuestions}
          </Link>
        )}
      </div>
      {subjects.length > 0 && (
        <form
          role="search"
          action="/dashboard/bank/all"
          method="get"
          className="flex max-w-[760px] flex-wrap gap-2.5 rounded-[14px] border border-qb-field bg-qb-surface p-2 shadow-qb-search focus-within:border-qb-accent"
        >
          <label htmlFor="bank-search" className="sr-only">
            {t.filters.search}
          </label>
          <input
            id="bank-search"
            type="search"
            name="q"
            placeholder={t.filters.search}
            className="h-12 min-w-0 flex-[1_1_260px] border-none bg-transparent px-3 text-[17px] text-qb-ink outline-none placeholder:text-qb-faint focus-visible:outline-none"
          />
          <button type="submit" className={cx(qbButton.accent, "h-12 flex-[1_1_auto] px-6 sm:flex-none")}>
            {t.filters.apply}
          </button>
        </form>
      )}
    </>
  );

  return (
    <QbClassesView
      ctx={ctx}
      title={t.title}
      lead={t.lead}
      band={band}
      heading={t.qb.chooseClass}
      grades={tree.map((g) => ({
        grade: g.grade,
        href: `/dashboard/bank/class/${g.grade}`,
        line: `${gradeName(g.grade, d).detail} · ${t.subjects(formatNumber(g.subjects.length, locale))} · ${t.total(formatNumber(g.total, locale))}`,
      }))}
      empty={<p className="m-0 rounded-2xl border border-qb-line bg-qb-surface p-6 text-qb-muted">{t.noSubjects}</p>}
    />
  );
}
