import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QbCrumbs } from "@/components/qbank/ui";
import { type QbCtx, QbClassesView } from "@/components/qbank/views";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getSite, getSiteBank } from "../data";

export const instant = false;

type Params = Promise<{ handle: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const site = await getSite((await params).handle.toLowerCase());
  if (!site || site.teacher.status !== "approved") return { robots: { index: false } };
  const locale = await getLocale(site.teacher.locale);
  const empty = (await getSiteBank(site.teacher.id)).length === 0;
  return {
    title: { absolute: `${getDictionary(locale).site.bank.title} — ${site.teacher.nameBn}` },
    alternates: { canonical: `/${site.teacher.handle}/bank` },
    robots: empty ? { index: false } : undefined,
  };
}

/** The website's question bank, first level: the classes that have questions to practise. */
export default async function SiteBankPage({ params }: { params: Params }) {
  const site = await getSite((await params).handle.toLowerCase());
  if (!site) notFound();
  const teacher = site.teacher;
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);
  const b = d.site.bank;
  const ctx: QbCtx = { d, locale, voice: d.site.chapter.qb, titleAs: "h1" };
  const tree = await getSiteBank(teacher.id);
  const home = `/${teacher.handle}`;

  return (
    <QbClassesView
      ctx={ctx}
      crumbs={<QbCrumbs label={d.common.breadcrumb} items={[{ label: locale === "bn" ? teacher.nameBn : teacher.nameEn, href: home }, { label: b.title }]} />}
      title={b.title}
      lead={b.lead}
      heading={ctx.voice.chooseClass}
      classes={tree.map(({ bankClass, subjects }) => ({
        id: bankClass.id,
        name: bankClass.name,
        href: `${home}/bank/${bankClass.number}`,
        line: b.subjects(formatNumber(subjects.length, locale)),
      }))}
      empty={<p className="m-0 rounded-2xl border border-qb-line bg-qb-surface p-6 text-qb-muted">{b.empty}</p>}
    />
  );
}
