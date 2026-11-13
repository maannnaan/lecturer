import type { Metadata } from "next";
import Link from "next/link";
import { cx, qbButton } from "@/components/qbank/ui";
import { type QbCtx, QbClassesView } from "@/components/qbank/views";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { buildBankTree } from "@/lib/bank-tree";
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
  const ctx: QbCtx = { d, locale, voice: t.qb, titleAs: "h1" };
  const db = await getDb();
  const [classes, subjects, counts] = await Promise.all([
    listBankClasses(db, teacher.id),
    listSubjectsWithChapters(db, teacher.id),
    bankCounts(db, teacher.id),
  ]);
  const tree = buildBankTree(classes, subjects, counts);

  return (
    <QbClassesView
      ctx={ctx}
      title={t.title}
      actions={
        <Link href="/dashboard/bank/class/new" className={cx(qbButton.accent, "h-11 px-4")}>
          <span aria-hidden="true" className="text-[20px] leading-none">
            +
          </span>
          {t.newClass}
        </Link>
      }
      heading={t.qb.chooseClass}
      classes={tree.map(({ bankClass, subjects: inClass, total }) => ({
        id: bankClass.id,
        name: bankClass.name,
        href: `/dashboard/bank/class/${bankClass.id}`,
        line: `${t.subjects(formatNumber(inClass.length, locale))} · ${t.total(formatNumber(total, locale))}`,
      }))}
      empty={<p className="m-0 rounded-2xl border border-qb-line bg-qb-surface p-6 text-qb-muted">{t.noClasses}</p>}
    />
  );
}
