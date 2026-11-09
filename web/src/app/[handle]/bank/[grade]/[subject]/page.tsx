import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crumbs, SectionChips } from "@/components/bank-ui";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { chapterLabel } from "@/lib/chapter-label";
import { gradeName } from "@/lib/grades";
import { getPageSubject } from "./data";

export const instant = false;

type Params = Promise<{ handle: string; grade: string; subject: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { handle, grade, subject } = await params;
  const found = await getPageSubject(handle, grade, subject);
  if (!found || found.teacher.status !== "approved") return { robots: { index: false } };
  const d = getDictionary(await getLocale(found.teacher.locale));
  const s = found.node.subject;
  return {
    title: { absolute: `${s.name} (${gradeName(s.grade, d).label}) · ${d.site.bank.title} — ${found.teacher.nameBn}` },
    alternates: { canonical: `/${found.teacher.handle}/bank/${grade}/${s.number}` },
    robots: found.node.total === 0 ? { index: false } : undefined,
  };
}

/** The website's question bank, third level: a subject's chapters and what each has to practise. */
export default async function SiteBankSubjectPage({ params }: { params: Params }) {
  const { handle, grade, subject: number } = await params;
  const found = await getPageSubject(handle, grade, number);
  if (!found) notFound();
  const { teacher, node } = found;
  const { subject } = node;
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);
  const b = d.site.bank;
  const home = `/${teacher.handle}`;
  const subjectPath = `${home}/bank/${grade}/${subject.number}`;

  return (
    <main>
      <div className="wrap pb-20">
        <Crumbs
          label={d.common.breadcrumb}
          items={[
            { label: locale === "bn" ? teacher.nameBn : teacher.nameEn, href: home },
            { label: b.title, href: `${home}/bank` },
            { label: gradeName(grade, d).label, href: `${home}/bank/${grade}` },
            { label: subject.name },
          ]}
        />
        <div className="ch-head mt-5">
          <p className="ch-course">{gradeName(grade, d).label}</p>
          <h1>{subject.name}</h1>
          <p className="mt-2 text-[16.5px] text-ink-2">{b.chaptersLead}</p>
        </div>

        {subject.chapters.length === 0 ? (
          <p className="card mt-6 p-6 text-ink-2">{b.empty}</p>
        ) : (
          <ul className="card ch-rows mt-6">
            {node.chapters.map(({ chapter, counts, total }, i) => {
              const path = `${subjectPath}/${chapter.number}`;
              return (
                <li key={chapter.id} className={total > 0 ? "ch-row" : "ch-row muted"}>
                  <span className="min-w-0">
                    <span className="ch-row-label">{chapterLabel(chapter, i, d, locale)}</span>
                    <Link href={path} className="ch-row-title">
                      {chapter.title}
                    </Link>
                  </span>
                  <span className="ch-row-side">
                    {total > 0 ? (
                      <>
                        <SectionChips counts={counts} d={d} locale={locale} href={(tab) => `${path}?tab=${tab}`} />
                        <span className="ch-row-total">{b.questions(formatNumber(total, locale))}</span>
                      </>
                    ) : (
                      <span className="badge">{b.soon}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
