import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { ChevronRight, Phone } from "lucide-react";
import { CourseIconGlyph } from "@/components/course-icon";
import { Paragraphs } from "@/components/paragraphs";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getCurrentTeacher } from "@/server/auth/current";
import { getCourseByNumber } from "@/server/courses";
import { getDb } from "@/server/db";
import { getSite } from "../../data";
import { AccessBadge, SectionHead, Timeline } from "../../site-ui";

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
  if (!found || !found.course.published) return { robots: { index: false } };
  const { teacher, course } = found;
  return {
    title: { absolute: `${course.title} — ${teacher.nameBn}` },
    description: course.description.slice(0, 200) || course.session || undefined,
    alternates: { canonical: `/${teacher.handle}/courses/${course.number}` },
  };
}

export default async function CoursePage({ params }: { params: Params }) {
  const { handle, number } = await params;
  const found = await getPageCourse(handle, number);
  if (!found) notFound();
  const { teacher, course } = found;
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);
  const home = `/${teacher.handle}`;
  const hasContact = Object.values(teacher.site.contact ?? {}).some(Boolean);

  return (
    <main>
      {!course.published && (
        <p className="bg-accent-soft px-4 py-2 text-center text-sm font-semibold text-accent-ink" role="status">
          {d.site.course.draftBanner}
        </p>
      )}
      <section className="hero">
        <div className="wrap py-10 sm:py-14">
          <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted" aria-label={d.site.nav.courses}>
            <Link href={home}>{locale === "bn" ? teacher.nameBn : teacher.nameEn}</Link>
            <ChevronRight className="size-3.5" aria-hidden="true" />
            <Link href={`${home}#courses`}>{d.site.course.allCourses}</Link>
          </nav>
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className={`course-cover cv-${course.cover} !h-28 !w-28 shrink-0 items-center !justify-center rounded-lg`}>
              <CourseIconGlyph name={course.icon} />
            </div>
            <div className="min-w-0">
              {course.level && <p className="eyebrow">{course.level}</p>}
              <h1 className="mt-1 text-[clamp(30px,4.2vw,48px)] leading-tight">{course.title}</h1>
              {course.session && <p className="mt-2 text-lg text-ink-2">{course.session}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <AccessBadge course={course} d={d} locale={locale} />
                {hasContact && (
                  <a href={`${home}#contact`} className="btn btn-primary btn-sm">
                    <Phone aria-hidden="true" />
                    {d.site.course.join}
                  </a>
                )}
              </div>
            </div>
          </div>
          {course.description && (
            <Paragraphs text={course.description} className="mt-8 max-w-[46em] text-[17px] leading-[1.85] text-ink-2" />
          )}
        </div>
      </section>

      <section className="section" aria-labelledby="outline-title">
        <div className="wrap max-w-[900px]">
          <SectionHead id="outline-title" eyebrow={d.site.planEyebrow} title={d.site.course.outline} />
          {course.chapters.length > 0 ? (
            <div className="card">
              <Timeline chapters={course.chapters} d={d} locale={locale} />
            </div>
          ) : (
            <p className="card p-6 text-ink-2">{d.site.course.noChapters}</p>
          )}
        </div>
      </section>
    </main>
  );
}
