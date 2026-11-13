import Link from "next/link";
import { ArrowRight, Check, Phone, Pin } from "lucide-react";
import type { ReactNode } from "react";
import { WhatsappMark } from "@/components/brand-icons";
import { CourseIconGlyph } from "@/components/course-icon";
import { SiteText } from "@/components/site-text";
import { chapterLabel } from "@/lib/chapter-label";
import { gradeName, gradeOf } from "@/lib/grades";
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
        {gradeOf(course) !== "other" ? <span className="lvl">{gradeName(course.grade, d).label}</span> : <span />}
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

/** The addresses that reach the teacher in one tap: a call, and a WhatsApp chat. */
export function contactLinks(contact: { phone?: string; whatsapp?: string } | undefined) {
  return {
    tel: contact?.phone ? `tel:${contact.phone}` : null,
    whatsapp: contact?.whatsapp ? `https://wa.me/88${contact.whatsapp}` : null,
  };
}

/**
 * On a phone, the way to reach the teacher stays at the foot of the screen: students and guardians
 * mostly come by phone, and the contact section is a long way down. Hidden on wider screens (the
 * header has the number there) and when the teacher has given neither a phone nor WhatsApp.
 */
export function CallBar({ contact, d }: { contact: { phone?: string; whatsapp?: string } | undefined; d: Dictionary }) {
  const { tel, whatsapp } = contactLinks(contact);
  if (!tel && !whatsapp) return null;
  return (
    <nav className="callbar" aria-label={d.site.quickContact}>
      {tel && (
        <a href={tel} className="btn btn-primary">
          <Phone aria-hidden="true" />
          {d.site.call}
        </a>
      )}
      {whatsapp && (
        <a href={whatsapp} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">
          <WhatsappMark className="size-[18px] text-[#128c7e]" />
          {d.site.whatsapp}
        </a>
      )}
    </nav>
  );
}

/**
 * The chapters of a course as a lesson-plan timeline: done, in progress, coming up. `offset` is
 * how many chapters come before the ones given, so a window of the plan keeps its numbering.
 */
export function Timeline({ chapters, d, locale, offset = 0 }: { chapters: Chapter[]; d: Dictionary; locale: Locale; offset?: number }) {
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
                <span className="tl-label">{chapterLabel(chapter, i + offset, d, locale)}</span>
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
              {(notice.body || notice.bodyRich) && <SiteText rich={notice.bodyRich} plain={notice.body} className="mt-1 text-[15px] text-ink-2" />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
