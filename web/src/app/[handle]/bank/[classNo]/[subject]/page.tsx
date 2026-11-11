import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { toneFor } from "@/components/qbank/build";
import { QbCrumbs } from "@/components/qbank/ui";
import { type QbCtx, QbSubjectView, chapterChips, chapterSearch, pad2 } from "@/components/qbank/views";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { subjectAbbr } from "@/lib/bank-look";
import { getSiteSubjects } from "../../../data";
import { getPageSubject } from "./data";

export const instant = false;

type Params = Promise<{ handle: string; classNo: string; subject: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { handle, classNo, subject } = await params;
  const found = await getPageSubject(handle, classNo, subject);
  if (!found || found.teacher.status !== "approved") return { robots: { index: false } };
  const d = getDictionary(await getLocale(found.teacher.locale));
  const s = found.node.subject;
  return {
    title: { absolute: `${s.name} (${found.bankClass.name}) · ${d.site.bank.title} — ${found.teacher.nameBn}` },
    alternates: { canonical: `/${found.teacher.handle}/bank/${found.bankClass.number}/${s.number}` },
    robots: found.node.total === 0 ? { index: false } : undefined,
  };
}

/** The website's question bank, third level: a subject's chapters and what each has to practise. */
export default async function SiteBankSubjectPage({ params }: { params: Params }) {
  const { handle, classNo, subject: number } = await params;
  const found = await getPageSubject(handle, classNo, number);
  if (!found) notFound();
  const { teacher, bankClass, node } = found;
  const { subject } = node;
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);
  const b = d.site.bank;
  const ctx: QbCtx = { d, locale, voice: d.site.chapter.qb, titleAs: "h1" };
  const all = await getSiteSubjects(teacher.id);
  const home = `/${teacher.handle}`;
  const classPath = `${home}/bank/${bankClass.number}`;
  const subjectPath = `${classPath}/${subject.number}`;

  return (
    <QbSubjectView
      ctx={ctx}
      crumbs={
        <QbCrumbs
          label={d.common.breadcrumb}
          items={[
            { label: locale === "bn" ? teacher.nameBn : teacher.nameEn, href: home },
            { label: b.title, href: `${home}/bank` },
            { label: bankClass.name, href: classPath },
            { label: subject.name },
          ]}
        />
      }
      name={subject.name}
      abbr={subjectAbbr(subject.name)}
      tone={toneFor(subject, all)}
      facts={[
        bankClass.name,
        subject.group ? (subject.group === "common" ? d.qbank.forAllGroups : d.qbank.groupOf(d.bankGroups[subject.group as keyof typeof d.bankGroups])) : null,
        subject.chapters.length > 0 ? b.chapters(formatNumber(subject.chapters.length, locale)) : null,
        node.total > 0 ? b.questions(formatNumber(node.total, locale)) : null,
      ].filter((f): f is string => Boolean(f))}
      rows={node.chapters.map(({ chapter, counts }, i) => ({
        id: chapter.id,
        href: `${subjectPath}/${chapter.number}`,
        number: pad2(i + 1, locale),
        title: chapter.title,
        note: chapter.label || undefined,
        chips: chapterChips(counts, ctx),
        search: chapterSearch([chapter.title, chapter.label, i + 1], locale),
      }))}
      empty={<p className="m-0 rounded-2xl border border-qb-line bg-qb-surface p-6 text-qb-muted">{b.empty}</p>}
    />
  );
}
