import type { Metadata } from "next";
import Link from "next/link";
import { cx, qbButton } from "@/components/qbank/ui";
import { type QbCtx, QbClassesView } from "@/components/qbank/views";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { buildBankTree } from "@/lib/bank-tree";
import { GRADES, gradeName } from "@/lib/grades";
import { requireTeacher } from "@/server/auth/current";
import { listBankClasses, listSubjectsWithChapters } from "@/server/bank";
import { getDb } from "@/server/db";
import { bankCounts } from "@/server/questions";

export const instant = false;

export const metadata: Metadata = { title: "প্রশ্নব্যাংক" };

/** The bank's first level: the teacher's classes, and "নতুন শ্রেণি" to add one. */
export default async function BankPage() {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.bank;
  const ctx: QbCtx = { d, locale, voice: t.qb, titleAs: "h2" };
  const db = await getDb();
  const [subjects, counts, classes] = await Promise.all([
    listSubjectsWithChapters(db, teacher.id),
    bankCounts(db, teacher.id),
    listBankClasses(db, teacher.id),
  ]);
  const tree = buildBankTree(subjects, counts, classes);

  return (
    <QbClassesView
      ctx={ctx}
      title={t.title}
      actions={
        // Every class is in the bank already: nothing left to add.
        tree.length < GRADES.length ? (
          <Link href="/dashboard/bank/class/new" className={cx(qbButton.accent, "h-11 px-4")}>
            <span aria-hidden="true" className="text-[20px] leading-none">
              +
            </span>
            {t.newClass}
          </Link>
        ) : undefined
      }
      heading={t.qb.chooseClass}
      grades={tree.map((g) => ({
        grade: g.grade,
        href: `/dashboard/bank/class/${g.grade}`,
        line: `${gradeName(g.grade, d).detail} · ${t.subjects(formatNumber(g.subjects.length, locale))} · ${t.total(formatNumber(g.total, locale))}`,
      }))}
      empty={<p className="m-0 rounded-2xl border border-qb-line bg-qb-surface p-6 text-qb-muted">{t.noClasses}</p>}
    />
  );
}
