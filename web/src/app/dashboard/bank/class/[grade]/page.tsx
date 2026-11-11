import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PendingButton } from "@/components/form";
import { groupTabs, subjectCard } from "@/components/qbank/build";
import { QbCrumbs, cx, qbButton } from "@/components/qbank/ui";
import { type QbCtx, QbClassView } from "@/components/qbank/views";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { buildBankTree } from "@/lib/bank-tree";
import { gradeName, isGrade } from "@/lib/grades";
import { requireTeacher } from "@/server/auth/current";
import { listBankClasses, listSubjectsWithChapters } from "@/server/bank";
import { getDb } from "@/server/db";
import { bankCounts } from "@/server/questions";
import { removeClassAction } from "../../actions";

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
  const [subjects, counts, classes] = await Promise.all([
    listSubjectsWithChapters(db, teacher.id),
    bankCounts(db, teacher.id),
    listBankClasses(db, teacher.id),
  ]);
  const tree = buildBankTree(subjects, counts, classes);
  const node = tree.find((g) => g.grade === grade);
  // A class that isn't in this teacher's bank: it is added with "নতুন শ্রেণি" first.
  if (!node) notFound();
  const cards = node.subjects.map((s) => subjectCard(s, `/dashboard/bank/subject/${s.subject.id}`, subjects, d, locale, t.chapters));
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
        node.subjects.length === 0 ? (
          <form
            action={removeClassAction}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-qb-line bg-qb-surface px-6 py-5"
          >
            <input type="hidden" name="grade" value={grade} />
            <p className="m-0 text-qb-muted">
              {t.noSubjectsInClass} {t.removeClass.lead}
            </p>
            <PendingButton className={cx(qbButton.outline, "h-11 px-4")}>{t.removeClass.button}</PendingButton>
          </form>
        ) : node.counts.board > 0 ? (
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
