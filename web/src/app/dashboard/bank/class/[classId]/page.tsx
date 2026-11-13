import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { PendingButton } from "@/components/form";
import { groupTabs, subjectCard } from "@/components/qbank/build";
import { QbCrumbs, cx, qbButton } from "@/components/qbank/ui";
import { type QbCtx, QbClassView } from "@/components/qbank/views";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { buildBankTree } from "@/lib/bank-tree";
import { requireTeacher } from "@/server/auth/current";
import { listBankClasses, listSubjectsWithChapters } from "@/server/bank";
import { getDb } from "@/server/db";
import { bankCounts } from "@/server/questions";
import { removeClassAction } from "../../actions";

export const instant = false;

export const metadata: Metadata = { title: "প্রশ্নব্যাংক" };

/** The bank's second level: one class's subjects, by group, and a card to add another. */
export default async function BankClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const teacher = await requireTeacher();
  const { classId } = await params;
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
  const node = tree.find((g) => g.bankClass.id === classId);
  if (!node) notFound();
  const { bankClass } = node;
  const cards = node.subjects.map((s) => subjectCard(s, `/dashboard/bank/subject/${s.subject.id}`, subjects, d, locale, t.chapters));

  return (
    <QbClassView
      ctx={ctx}
      crumbs={<QbCrumbs label={d.common.breadcrumb} items={[{ label: t.title, href: "/dashboard/bank" }, { label: bankClass.name }]} />}
      title={bankClass.name}
      current={bankClass.id}
      classes={tree.map((g) => ({ id: g.bankClass.id, name: g.bankClass.name, href: `/dashboard/bank/class/${g.bankClass.id}` }))}
      groups={groupTabs(cards, d)}
      subjects={cards}
      add={{ href: `/dashboard/bank/subject/new?class=${bankClass.id}`, label: t.newSubject }}
      actions={
        <Link href={`/dashboard/bank/class/${bankClass.id}/edit`} className={cx(qbButton.outline, "h-10 px-3.5 text-[15px] [&_svg]:size-4")}>
          <Pencil aria-hidden="true" />
          {t.renameClass}
        </Link>
      }
      aside={
        node.subjects.length === 0 ? (
          <form
            action={removeClassAction}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-qb-line bg-qb-surface px-6 py-5"
          >
            <input type="hidden" name="classId" value={bankClass.id} />
            <p className="m-0 text-qb-muted">
              {t.noSubjectsInClass} {t.removeClass.lead}
            </p>
            <PendingButton className={cx(qbButton.outline, "h-11 px-4")}>{t.removeClass.button}</PendingButton>
          </form>
        ) : null
      }
    />
  );
}
