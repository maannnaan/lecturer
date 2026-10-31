import Link from "next/link";
import { ArrowRight, Check, Pin } from "lucide-react";
import type { ReactNode } from "react";
import { CourseIconGlyph } from "@/components/course-icon";
import { Paragraphs } from "@/components/paragraphs";
import { chapterLabel } from "@/lib/chapter-label";
import { type Dictionary, type Locale, dayAndMonth, formatDayRange, formatNumber } from "@/i18n";
import type { Chapter, Course } from "@/server/courses";
import type { Notice } from "@/server/notices";

/** How a student gets into the course: free, by approval, or its price. */
export function AccessBadge({ course, d, locale }: { course: Course; d: Dictionary; locale: Locale }) {
  if (course.access === "free") return <span className="badge badge-ok">{d.site.free}</span>;
  if (course.access === "approval") return <span className="badge badge-primary">{d.site.approval}</span>;
  return (
    <span className="badge badge-warn">
      {d.site.price(formatNumber(course.price, locale), course.pricePeriod === "monthly")}
    </span>
  );
}

export function CourseCard({
  course,
  chapterCount,
  href,
  d,
  locale,
}: {
  course: Course;
  chapterCount: number;
  href: string;
  d: Dictionary;
  locale: Locale;
}) {
  return (
    <article className="course-card">
      <div className={`course-cover cv-${course.cover}`}>
        {course.level ? <span className="lvl">{course.level}</span> : <span />}
        <CourseIconGlyph name={course.icon} />
      </div>
      <div className="course-body">
        <h3>
          <Link href={href}>{course.title}</Link>
        </h3>
        {chapterCount > 0 && (
          <p className="text-sm text-muted">{d.site.chaptersCount(formatNumber(chapterCount, locale))}</p>
        )}
        <div className="course-foot">
          <AccessBadge course={course} d={d} locale={locale} />
          <Link href={href} className="link text-[15px]">
            {d.site.details}
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

/** The chapters of a course as a lesson-plan timeline: done, in progress, coming up. */
export function Timeline({ chapters, d, locale }: { chapters: Chapter[]; d: Dictionary; locale: Locale }) {
  const statuses = d.dashboard.courses.statuses;
  return (
    <ol className="timeline">
      {chapters.map((chapter, i) => {
        const dates = formatDayRange(chapter.startsOn, chapter.endsOn, locale);
        return (
          <li key={chapter.id} className="tl" data-status={chapter.status}>
            <span className="tl-dot">{chapter.status === "done" && <Check aria-hidden="true" />}</span>
            <div className="min-w-0">
              <p className="tl-title">
                <span className="tl-label">{chapterLabel(chapter, i, d, locale)}</span>
                {chapter.title}
              </p>
              {dates && <p className="tl-date">{dates}</p>}
            </div>
            <span className="badge tl-state">{statuses[chapter.status]}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function SectionHead({
  eyebrow,
  title,
  action,
  id,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="section-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id}>{title}</h2>
      </div>
      {action}
    </div>
  );
}

/** Notices as calendar-page entries, pinned ones marked. */
export function NoticeList({ notices, d, locale }: { notices: Notice[]; d: Dictionary; locale: Locale }) {
  return (
    <ul className="card divide-y divide-line">
      {notices.map((notice) => {
        const { day, month } = dayAndMonth(notice.publishedAt, locale);
        return (
          <li key={notice.id} className="flex gap-4 p-5">
            <span className="date-block">
              <b>{day}</b>
              <span>{month}</span>
            </span>
            <div className="min-w-0">
              <p className="flex items-start gap-2 text-[16.5px] font-semibold leading-snug text-ink">
                {notice.pinned && <Pin className="mt-1 size-4 shrink-0 text-accent-ink" aria-label={d.dashboard.notices.pinnedBadge} />}
                {notice.title}
              </p>
              {notice.body && <Paragraphs text={notice.body} className="mt-1 text-[15px] text-ink-2" />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
