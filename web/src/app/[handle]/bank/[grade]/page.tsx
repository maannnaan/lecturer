import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { Crumbs, SectionChips } from "@/components/bank-ui";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { gradeName, isGrade } from "@/lib/grades";
import { getSite, getSiteBank } from "../../data";

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
  const node = (await getSiteBank(teacher.id)).find((g) => g.grade === grade);
  const name = gradeName(grade, d);
  const home = `/${teacher.handle}`;

  return (
    <main>
      <div className="wrap pb-20">
        <Crumbs
          label={d.common.breadcrumb}
          items={[
            { label: locale === "bn" ? teacher.nameBn : teacher.nameEn, href: home },
            { label: b.title, href: `${home}/bank` },
            { label: name.label },
          ]}
        />
        <div className="ch-head mt-5">
          <p className="ch-course">{b.title}</p>
          <h1>{name.label}</h1>
          <p className="mt-2 text-[16.5px] text-ink-2">{name.detail}</p>
        </div>

        {!node ? (
          <p className="card mt-6 p-6 text-ink-2">{b.emptyGrade}</p>
        ) : (
          <ul className="bank-grid mt-6">
            {node.subjects.map(({ subject, chapters, counts, total }) => (
              <li key={subject.id}>
                <Link href={`${home}/bank/${grade}/${subject.number}`} className="bank-card bank-subject">
                  <span className="bank-icon" aria-hidden="true">
                    <BookOpen />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="bank-card-title">{subject.name}</span>
                    <span className="bank-card-meta">
                      {`${b.chapters(formatNumber(chapters.length, locale))} · ${b.questions(formatNumber(total, locale))}`}
                    </span>
                    <SectionChips counts={counts} d={d} locale={locale} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
