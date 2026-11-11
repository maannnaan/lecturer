import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toneFor } from "@/components/qbank/build";
import { QbCrumbs, cx, qbButton } from "@/components/qbank/ui";
import { type QbCtx, QbSubjectView, chapterChips, chapterSearch, pad2 } from "@/components/qbank/views";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { subjectAbbr } from "@/lib/bank-look";
import { buildBankTree } from "@/lib/bank-tree";
import { gradeName, gradeOf } from "@/lib/grades";
import { requireTeacher } from "@/server/auth/current";
import { getSubject, listSubjects } from "@/server/bank";
import { getDb } from "@/server/db";
import { bankCounts } from "@/server/questions";

export const instant = false;

export const metadata: Metadata = { title: "প্রশ্নব্যাংক" };

/** The bank's third level: one subject's chapters, with how many questions each tab has. */
export default async function BankSubjectPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const teacher = await requireTeacher();
  const { subjectId } = await params;
  const db = await getDb();
  const subject = await getSubject(db, teacher.id, subjectId);
  if (!subject) notFound();
  const [counts, all] = await Promise.all([bankCounts(db, teacher.id), listSubjects(db, teacher.id)]);
  const node = buildBankTree([subject], counts)[0].subjects[0];
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.bank;
  const ctx: QbCtx = { d, locale, voice: t.qb, titleAs: "h2" };
  const grade = gradeOf(subject);
  const base = `/dashboard/bank/subject/${subject.id}`;
  const onSite = node.total > 0 ? `/${teacher.handle}/bank/${grade}/${subject.number}` : null;

  const rows = node.chapters.map(({ chapter, counts: tabs }, i) => ({
    id: chapter.id,
    href: `${base}/${chapter.id}`,
    number: pad2(i + 1, locale),
    title: chapter.title,
    note: chapter.label || undefined,
    chips: chapterChips(tabs, ctx),
    search: chapterSearch([chapter.title, chapter.label, i + 1], locale),
  }));
  if (node.unfiled.total > 0) {
    rows.push({
      id: "unfiled",
      href: `${base}/unfiled`,
      number: "–",
      title: t.unfiled,
      note: undefined,
      chips: chapterChips(node.unfiled.counts, ctx),
      search: t.unfiled.toLowerCase(),
    });
  }

  return (
    <QbSubjectView
      ctx={ctx}
      crumbs={
        <QbCrumbs
          label={d.common.breadcrumb}
          items={[
            { label: t.title, href: "/dashboard/bank" },
            { label: gradeName(grade, d).label, href: `/dashboard/bank/class/${grade}` },
            { label: subject.name },
          ]}
        />
      }
      name={subject.name}
      abbr={subjectAbbr(subject.name)}
      tone={toneFor(subject, all)}
      facts={[
        gradeName(grade, d).label,
        subject.group ? (subject.group === "common" ? d.qbank.forAllGroups : d.qbank.groupOf(d.bankGroups[subject.group as keyof typeof d.bankGroups])) : null,
        t.chapters(formatNumber(subject.chapters.length, locale)),
        t.total(formatNumber(node.total, locale)),
      ].filter((f): f is string => Boolean(f))}
      actions={
        <>
          <Link href={`/dashboard/bank/new?subject=${subject.id}`} className={cx(qbButton.accent, "h-[46px] px-[18px]")}>
            + {t.new}
          </Link>
          <Link href={`${base}/edit`} className={cx(qbButton.outline, "h-[46px] px-[18px]")}>
            {t.editSubject}
          </Link>
          {onSite && (
            <Link href={onSite} className={cx(qbButton.outline, "h-[46px] px-[18px]")}>
              {t.viewOnSite}
            </Link>
          )}
        </>
      }
      rows={rows}
      empty={
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-qb-line bg-qb-surface p-6">
          <p className="m-0 text-qb-muted">{t.noChapters}</p>
          <Link href={`${base}/edit#chapters`} className={cx(qbButton.accent, "h-11 px-4")}>
            + {t.chaptersEditor.add}
          </Link>
        </div>
      }
    />
  );
}
