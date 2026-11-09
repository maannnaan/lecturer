import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { Crumbs, SectionChips } from "@/components/bank-ui";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { buildBankTree } from "@/lib/bank-tree";
import { chapterLabel } from "@/lib/chapter-label";
import { gradeName, gradeOf, subjectOf } from "@/lib/grades";
import { getCurrentTeacher } from "@/server/auth/current";
import { getCourseByNumber } from "@/server/courses";
import { getDb } from "@/server/db";
import { bankCounts } from "@/server/questions";
import { getSite } from "../../../data";

export const instant = false;

type Params = Promise<{ handle: string; number: string }>;

/** The course behind this address; its owner also sees it while it's still a draft. */
const getPageCourse = cache(async (handle: string, number: string) => {
  await connection();
  const site = await getSite(handle.toLowerCase());
  if (!site || !/^\d{1,6}$/.test(number)) return null;
  const isOwner = (await getCurrentTeacher())?.id === site.teacher.id;
  const course = await getCourseByNumber(await getDb(), site.teacher.id, Number(number), isOwner);
  return course ? { teacher: site.teacher, course } : null;
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { handle, number } = await params;
  const found = await getPageCourse(handle, number);
  if (!found || !found.course.published || found.teacher.status !== "approved") return { robots: { index: false } };
  const { teacher, course } = found;
  const d = getDictionary(await getLocale(teacher.locale));
  return {
    title: { absolute: `${subjectOf(course)} · ${d.site.bank.title} — ${teacher.nameBn}` },
    alternates: { canonical: `/${teacher.handle}/courses/${course.number}/chapters` },
  };
}

/** The website's question bank, third level: a subject's chapters and what each has to practise. */
export default async function CourseChaptersPage({ params }: { params: Params }) {
  const { handle, number } = await params;
  const found = await getPageCourse(handle, number);
  if (!found) notFound();
  const { teacher, course } = found;
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);
  const b = d.site.bank;
  const counts = await bankCounts(await getDb(), teacher.id, { publicOnly: true });
  const node = buildBankTree([course], counts)[0].courses[0];
  const grade = gradeOf(course);
  const subject = subjectOf(course);
  const home = `/${teacher.handle}`;
  const coursePath = `${home}/courses/${course.number}`;
  const subtitle = [subject !== course.title && course.title, course.session].filter(Boolean).join(" · ");

  return (
    <main>
      {!course.published && (
        <p className="bg-accent-soft px-4 py-2 text-center text-sm font-semibold text-accent-ink" role="status">
          {d.site.course.draftBanner}
        </p>
      )}
      <div className="wrap pb-20">
        <Crumbs
          label={d.common.breadcrumb}
          items={[
            { label: locale === "bn" ? teacher.nameBn : teacher.nameEn, href: home },
            { label: b.title, href: `${home}/bank` },
            { label: gradeName(grade, d).label, href: `${home}/bank/${grade}` },
            { label: subject },
          ]}
        />
        <div className="ch-head mt-5">
          <p className="ch-course">
            <Link href={coursePath}>{subtitle || course.title}</Link>
          </p>
          <h1>{subject}</h1>
          <p className="mt-2 text-[16.5px] text-ink-2">{b.chaptersLead}</p>
        </div>

        {course.chapters.length === 0 ? (
          <p className="card mt-6 p-6 text-ink-2">{d.site.course.noChapters}</p>
        ) : (
          <ul className="card ch-rows mt-6">
            {node.chapters.map(({ chapter, counts: sections, total }, i) => {
              const path = `${coursePath}/chapters/${chapter.number}`;
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
                        <SectionChips counts={sections} d={d} locale={locale} href={(tab) => `${path}?tab=${tab}`} />
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
