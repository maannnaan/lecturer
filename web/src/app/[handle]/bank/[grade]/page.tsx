import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { groupTabs, subjectCard } from "@/components/qbank/build";
import { QbCrumbs } from "@/components/qbank/ui";
import { type QbCtx, QbClassView } from "@/components/qbank/views";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { gradeName, isGrade } from "@/lib/grades";
import { getSite, getSiteBank, getSiteSubjects } from "../../data";

export const instant = false;

type Params = Promise<{ handle: string; grade: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { handle, grade } = await params;
  const site = await getSite(handle.toLowerCase());
  if (!site || !isGrade(grade) || site.teacher.status !== "approved") return { robots: { index: false } };
  const locale = await getLocale(site.teacher.locale);
  const d = getDictionary(locale);
  const empty = !(await getSiteBank(site.teacher.id)).some((g) => g.grade === grade);
  return {
    title: { absolute: `${gradeName(grade, d).label} · ${d.site.bank.title} — ${site.teacher.nameBn}` },
    alternates: { canonical: `/${site.teacher.handle}/bank/${grade}` },
    robots: empty ? { index: false } : undefined,
  };
}

/** The website's question bank, second level: one class's subjects that have questions. */
export default async function SiteBankClassPage({ params }: { params: Params }) {
  const { handle, grade } = await params;
  const site = await getSite(handle.toLowerCase());
  if (!site || !isGrade(grade)) notFound();
  const teacher = site.teacher;
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);
  const b = d.site.bank;
  const ctx: QbCtx = { d, locale, voice: d.site.chapter.qb, titleAs: "h1" };
  const [tree, all] = await Promise.all([getSiteBank(teacher.id), getSiteSubjects(teacher.id)]);
  const node = tree.find((g) => g.grade === grade);
  const home = `/${teacher.handle}`;
  const subjects = (node?.subjects ?? []).map((s) => subjectCard(s, `${home}/bank/${grade}/${s.subject.number}`, all, d, locale, b.chapters));

  return (
    <QbClassView
      ctx={ctx}
      crumbs={
        <QbCrumbs
          label={d.common.breadcrumb}
          items={[
            { label: locale === "bn" ? teacher.nameBn : teacher.nameEn, href: home },
            { label: b.title, href: `${home}/bank` },
            { label: gradeName(grade, d).label },
          ]}
        />
      }
      grade={grade}
      classes={tree.map((g) => ({ grade: g.grade, href: `${home}/bank/${g.grade}` }))}
      groups={groupTabs(subjects, d)}
      subjects={subjects}
      empty={<p className="m-0 rounded-2xl border border-qb-line bg-qb-surface p-6 text-qb-muted">{b.emptyGrade}</p>}
    />
  );
}
