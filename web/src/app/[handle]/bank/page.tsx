import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Crumbs, SectionChips } from "@/components/bank-ui";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { gradeName } from "@/lib/grades";
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
  const tree = await getSiteBank(teacher.id);
  const home = `/${teacher.handle}`;

  return (
    <main>
      <div className="wrap pb-20">
        <Crumbs
          label={d.common.breadcrumb}
          items={[{ label: locale === "bn" ? teacher.nameBn : teacher.nameEn, href: home }, { label: b.title }]}
        />
        <div className="ch-head mt-5">
          <h1>{b.title}</h1>
          <p className="mt-2 text-[16.5px] text-ink-2">{b.lead}</p>
        </div>

        {tree.length === 0 ? (
          <p className="card mt-6 p-6 text-ink-2">{b.empty}</p>
        ) : (
          <ul className="bank-grid mt-6">
            {tree.map((grade) => {
              const name = gradeName(grade.grade, d);
              return (
                <li key={grade.grade}>
                  <Link href={`${home}/bank/${grade.grade}`} className="bank-card">
                    <span className="bank-card-title">
                      {name.label}
                      <ArrowRight aria-hidden="true" />
                    </span>
                    <span className="bank-card-detail">{name.detail}</span>
                    <span className="bank-card-meta">
                      {`${b.subjects(formatNumber(grade.subjects.length, locale))} · ${b.questions(formatNumber(grade.total, locale))}`}
                    </span>
                    <SectionChips counts={grade.counts} d={d} locale={locale} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
