import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { groupTabs, subjectCard } from "@/components/qbank/build";
import { QbCrumbs } from "@/components/qbank/ui";
import { type QbCtx, QbClassView } from "@/components/qbank/views";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { buildBankTree } from "@/lib/bank-tree";
import { gradeName, isGrade } from "@/lib/grades";
import { requireTeacher } from "@/server/auth/current";
import { listSubjectsWithChapters } from "@/server/bank";
import { getDb } from "@/server/db";
import { bankCounts } from "@/server/questions";

export const instant = false;

export const metadata: Metadata = { title: "প্রশ্নব্যাংক" };

/** The bank's second level: one class's subjects, by group, and a card to add another. */
export default async function BankClassPage({ params }: { params: Promise<{ grade: string }> }) {
  const teacher = await requireTeacher();
  const { grade } = await params;
  if (!isGrade(grade)) notFound();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.bank;
  const ctx: QbCtx = { d, locale, voice: t.qb, titleAs: "h2" };
  const db = await getDb();
  const [subjects, counts] = await Promise.all([listSubjectsWithChapters(db, teacher.id), bankCounts(db, teacher.id)]);
  const tree = buildBankTree(subjects, counts);
  const node = tree.find((g) => g.grade === grade);
  const cards = (node?.subjects ?? []).map((s) => subjectCard(s, `/dashboard/bank/subject/${s.subject.id}`, subjects, d, locale, t.chapters));
  const name = gradeName(grade, d);

  return (
    <QbClassView
      ctx={ctx}
      crumbs={<QbCrumbs label={d.common.breadcrumb} items={[{ label: t.title, href: "/dashboard/bank" }, { label: name.label }]} />}
      grade={grade}
      classes={tree.map((g) => ({ grade: g.grade, href: `/dashboard/bank/class/${g.grade}` }))}
      groups={groupTabs(cards, d)}
      subjects={cards}
      add={{ href: `/dashboard/bank/subject/new?grade=${grade}`, label: t.newSubject }}
      aside={
        node && node.counts.board > 0 ? (
          <div className="on-dark flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-qb-ink px-7 py-6 text-white">
            <div className="flex flex-col gap-1">
              <span className="font-qb-display text-[22px] font-bold">{t.prep.title(name.label)}</span>
              <span className="text-qb-footer">{t.prep.lead}</span>
            </div>
            <Link
              href="/dashboard/bank/all?board=any"
              className="rounded-[10px] bg-qb-board-cta px-5 py-3 font-bold text-qb-ink no-underline hover:bg-[#f5c25c] hover:text-qb-ink"
            >
              {t.prep.cta}
            </Link>
          </div>
        ) : null
      }
    />
  );
}
