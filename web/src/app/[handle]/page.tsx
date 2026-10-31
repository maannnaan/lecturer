import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties, ReactElement } from "react";
import { ArrowRight, Award, BadgeCheck, Building2, Clock, Mail, MapPin, Phone, Sparkles } from "lucide-react";
import { FacebookMark, WhatsappMark, YoutubeMark } from "@/components/brand-icons";
import { initialOf } from "@/components/logo";
import { Paragraphs } from "@/components/paragraphs";
import { type Dictionary, type Locale, formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import type { CourseWithChapters } from "@/server/courses";
import type { Teacher } from "@/server/teachers";
import { getSite, getSiteCourses, getSiteNotices } from "./data";
import { CourseCard, NoticeList, SectionHead, Timeline } from "./site-ui";

export const instant = false;

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<{ plan?: string }> };

/** The course whose lesson plan the timeline shows: the one asked for, else the one in progress. */
function planCourse(courses: CourseWithChapters[], asked?: string): CourseWithChapters | undefined {
  const withChapters = courses.filter((c) => c.chapters.length > 0);
  return (
    withChapters.find((c) => String(c.number) === asked) ??
    withChapters.find((c) => c.chapters.some((ch) => ch.status === "ongoing")) ??
    withChapters[0]
  );
}

export default async function TeacherHomePage({ params, searchParams }: Props) {
  const site = await getSite((await params).handle.toLowerCase());
  if (!site) notFound();
  const teacher = site.teacher;
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);
  const [courses, notices, { plan: asked }] = await Promise.all([
    getSiteCourses(teacher.id),
    getSiteNotices(teacher.id, 5),
    searchParams,
  ]);
  const s = teacher.site;
  const home = `/${teacher.handle}`;
  const plan = planCourse(courses, asked);
  const contact = s.contact ?? {};
  const hasContact = Object.values(contact).some(Boolean) || (s.routine?.length ?? 0) > 0;
  const nothingYet = courses.length === 0 && notices.length === 0 && !s.about && !hasContact;

  return (
    <main>
      <Hero teacher={teacher} d={d} locale={locale} hasCourses={courses.length > 0} hasContact={hasContact} />

      {courses.length > 0 && (
        <section className="section" id="courses" aria-labelledby="courses-title">
          <div className="wrap">
            <SectionHead id="courses-title" eyebrow={d.site.coursesEyebrow} title={d.site.coursesTitle} />
            <div className="course-grid">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  chapterCount={course.chapters.length}
                  href={`${home}/courses/${course.number}`}
                  d={d}
                  locale={locale}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {plan && <PlanSection courses={courses} plan={plan} home={home} d={d} locale={locale} />}

      {notices.length > 0 && (
        <section className="section" aria-labelledby="notices-title">
          <div className="wrap max-w-[860px]">
            <SectionHead
              id="notices-title"
              eyebrow={d.site.noticesEyebrow}
              title={d.site.noticesTitle}
              action={
                <Link href={`${home}/notices`} className="link">
                  {d.site.allNotices}
                  <ArrowRight aria-hidden="true" />
                </Link>
              }
            />
            <NoticeList notices={notices} d={d} locale={locale} />
          </div>
        </section>
      )}

      {s.about && (
        <section className="section section-alt" aria-labelledby="about-title">
          <div className="wrap max-w-[860px]">
            <SectionHead id="about-title" eyebrow={d.site.aboutEyebrow} title={locale === "bn" ? teacher.nameBn : teacher.nameEn} />
            <Paragraphs text={s.about} className="text-[17px] leading-[1.9] text-ink-2" />
          </div>
        </section>
      )}

      {hasContact && <ContactSection teacher={teacher} d={d} />}

      {nothingYet && (
        <section className="wrap py-14">
          <div className="card flex gap-4 p-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-text">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl">{d.site.comingTitle}</h2>
              <p className="mt-1 text-ink-2">{d.site.comingText}</p>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function Hero({
  teacher,
  d,
  locale,
  hasCourses,
  hasContact,
}: {
  teacher: Teacher;
  d: Dictionary;
  locale: Locale;
  hasCourses: boolean;
  hasContact: boolean;
}) {
  const s = teacher.site;
  const stats = s.stats ?? [];
  const facts = [
    s.location && { icon: MapPin, text: s.location },
    teacher.institution && { icon: Building2, text: teacher.institution },
    s.admission && { icon: BadgeCheck, text: s.admission },
  ].filter((f): f is { icon: typeof MapPin; text: string } => Boolean(f));

  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <div>
          {s.designation && <p className="eyebrow">{s.designation}</p>}
          <h1>{locale === "bn" ? teacher.nameBn : teacher.nameEn}</h1>
          {teacher.subjects && <p className="hero-role">{teacher.subjects}</p>}
          {s.tagline && <p className="hero-lead">{s.tagline}</p>}
          {(hasCourses || hasContact) && (
            <div className="hero-actions">
              {hasCourses && (
                <a href="#courses" className="btn btn-primary">
                  {d.site.viewCourses}
                  <ArrowRight aria-hidden="true" />
                </a>
              )}
              {hasContact && (
                <a href="#contact" className="btn btn-ghost">
                  <Phone aria-hidden="true" />
                  {d.site.contactMe}
                </a>
              )}
            </div>
          )}
          {facts.length > 0 && (
            <ul className="hero-facts">
              {facts.map(({ icon: Icon, text }) => (
                <li key={text}>
                  <Icon aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="hero-figure">
          <span className="deco deco-1" aria-hidden="true" />
          <span className="deco deco-2" aria-hidden="true" />
          <div className="portrait">
            {s.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- uploads live on our own host or Cloudinary
              <img src={s.photo.url} alt={teacher.nameBn} />
            ) : (
              <span className="portrait-mono" aria-hidden="true">
                {initialOf(teacher.nameBn)}
              </span>
            )}
          </div>
          {s.highlight && (
            <div className="float-card fc-highlight">
              <span className="fc-icon">
                <Award aria-hidden="true" />
              </span>
              <span>
                <b>{s.highlight.value}</b>
                {s.highlight.label}
              </span>
            </div>
          )}
        </div>
      </div>

      {stats.length > 0 && (
        <div className="wrap">
          <div className="stats" style={{ "--stat-count": stats.length } as CSSProperties}>
            {stats.map((stat) => (
              <div key={stat.label} className="stat">
                <b>{stat.value}</b>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function PlanSection({
  courses,
  plan,
  home,
  d,
  locale,
}: {
  courses: CourseWithChapters[];
  plan: CourseWithChapters;
  home: string;
  d: Dictionary;
  locale: Locale;
}) {
  const withChapters = courses.filter((c) => c.chapters.length > 0);
  const done = plan.chapters.filter((ch) => ch.status === "done").length;
  const now = plan.chapters.find((ch) => ch.status === "ongoing");
  return (
    <section className="section section-alt" id="plan" aria-labelledby="plan-title">
      <div className="wrap">
        <SectionHead id="plan-title" eyebrow={d.site.planEyebrow} title={d.site.planTitle} />
        <div className="grid items-start gap-6 lg:grid-cols-[330px_minmax(0,1fr)]">
          <div className="card p-6">
            <h3 className="text-xl">{plan.title}</h3>
            {plan.session && <p className="mt-1 text-[14.5px] text-muted">{plan.session}</p>}
            {withChapters.length > 1 && (
              <nav className="mt-4 flex flex-wrap gap-2" aria-label={d.site.planEyebrow}>
                {withChapters.map((c) => (
                  <Link
                    key={c.id}
                    href={`${home}?plan=${c.number}#plan`}
                    className="chip"
                    aria-current={c.id === plan.id ? "true" : undefined}
                    scroll={false}
                  >
                    {c.title}
                  </Link>
                ))}
              </nav>
            )}
            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-2 flex justify-between text-[14.5px] text-ink-2">
                <span>{d.site.syllabusDone}</span>
                <b className="text-ink">
                  {d.site.chaptersDone(formatNumber(done, locale), formatNumber(plan.chapters.length, locale))}
                </b>
              </p>
              <div className="progress" role="presentation">
                <i style={{ width: `${Math.round((done / plan.chapters.length) * 100)}%` }} />
              </div>
            </div>
            {now && (
              <p className="mt-4 rounded-md bg-surface-2 p-3 text-[14.5px] text-ink-2">
                <b className="text-ink">{d.site.nowTeaching}</b> {now.title}
              </p>
            )}
          </div>
          <div className="card min-w-0">
            <Timeline chapters={plan.chapters} d={d} locale={locale} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactSection({ teacher, d }: { teacher: Teacher; d: Dictionary }) {
  const c = teacher.site.contact ?? {};
  const routine = teacher.site.routine ?? [];
  const rows = [
    c.phone && { icon: <Phone className="size-5" aria-hidden="true" />, title: c.phone, sub: c.hours, href: `tel:${c.phone}` },
    c.whatsapp && {
      icon: <WhatsappMark className="size-5" />,
      title: d.site.whatsapp,
      sub: c.whatsapp,
      href: `https://wa.me/88${c.whatsapp}`,
    },
    c.email && { icon: <Mail className="size-5" aria-hidden="true" />, title: c.email, sub: "", href: `mailto:${c.email}` },
    c.address && { icon: <MapPin className="size-5" aria-hidden="true" />, title: c.address, sub: "", href: "" },
    c.facebook && { icon: <FacebookMark className="size-5" />, title: d.site.facebook, sub: "", href: c.facebook },
    c.youtube && { icon: <YoutubeMark className="size-5" />, title: d.site.youtube, sub: "", href: c.youtube },
    !c.phone && c.hours && { icon: <Clock className="size-5" aria-hidden="true" />, title: c.hours, sub: "", href: "" },
  ].filter((r): r is { icon: ReactElement; title: string; sub: string | undefined; href: string } => Boolean(r));

  return (
    <section className="section" id="contact" aria-labelledby="contact-title">
      <div className="wrap">
        <SectionHead id="contact-title" eyebrow={d.site.contactEyebrow} title={d.site.contactTitle} />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          {rows.length > 0 && (
            <ul className="card divide-y divide-line px-5">
              {rows.map((row) => {
                const body = (
                  <>
                    <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-text">
                      {row.icon}
                    </span>
                    <span className="min-w-0">
                      <b className="block break-words font-semibold text-ink">{row.title}</b>
                      {row.sub && <span className="text-sm text-muted">{row.sub}</span>}
                    </span>
                  </>
                );
                return (
                  <li key={row.title + row.href}>
                    {row.href ? (
                      <a href={row.href} className="flex items-center gap-4 py-4" target={row.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                        {body}
                      </a>
                    ) : (
                      <div className="flex items-center gap-4 py-4">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {routine.length > 0 && (
            <div className="card min-w-0 overflow-hidden">
              <table className="routine">
                <caption className="sr-only">{d.site.routineTitle}</caption>
                <thead>
                  <tr>
                    <th scope="col">{d.dashboard.website.routine.batch}</th>
                    <th scope="col">{d.dashboard.website.routine.days}</th>
                    <th scope="col">{d.dashboard.website.routine.time}</th>
                  </tr>
                </thead>
                <tbody>
                  {routine.map((row, i) => (
                    <tr key={i}>
                      <td>{row.batch}</td>
                      <td>
                        {row.days}
                        {row.time && <span className="t-sm">{row.time}</span>}
                      </td>
                      <td>{row.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
