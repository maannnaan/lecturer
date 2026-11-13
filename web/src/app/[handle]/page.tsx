import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties, ReactElement } from "react";
import { ArrowRight, Award, BadgeCheck, Building2, Clock, Library, Mail, MapPin, Phone, Sparkles } from "lucide-react";
import { FacebookMark, WhatsappMark, YoutubeMark } from "@/components/brand-icons";
import { initialOf } from "@/components/logo";
import { SiteText } from "@/components/site-text";
import { type Dictionary, type Locale, formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import type { CourseWithChapters } from "@/server/courses";
import type { Teacher } from "@/server/teachers";
import { getSite, getSiteBank, getSiteCourses, getSiteNotices } from "./data";
import { CallBar, CourseCard, NoticeList, SectionHead, Timeline, contactLinks } from "./site-ui";

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

/**
 * A teacher's home page, in the order a visiting student or guardian asks their questions: who is
 * this and is admission open (hero), what is taught and for how much (courses), when (class
 * times), why this teacher (about), can I try something (the question bank), where is the batch
 * now (lesson plan), what's new (notices), how do I reach them (contact). On a phone the way to
 * call or message stays at the foot of the screen throughout.
 */
export default async function TeacherHomePage({ params, searchParams }: Props) {
  const site = await getSite((await params).handle.toLowerCase());
  if (!site) notFound();
  const teacher = site.teacher;
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);
  const [courses, notices, bank, { plan: asked }] = await Promise.all([
    getSiteCourses(teacher.id),
    getSiteNotices(teacher.id, 5),
    getSiteBank(teacher.id),
    searchParams,
  ]);
  const s = teacher.site;
  const home = `/${teacher.handle}`;
  const plan = planCourse(courses, asked);
  const contact = s.contact ?? {};
  const routine = s.routine ?? [];
  const hasContact = Object.values(contact).some(Boolean) || routine.length > 0;
  const hasContactRows = Object.values(contact).some(Boolean);
  const nothingYet = courses.length === 0 && notices.length === 0 && !s.about && !s.aboutRich && !hasContact;

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

      {routine.length > 0 && (
        <section className="section section-alt" id="times" aria-labelledby="times-title">
          <div className="wrap max-w-[920px]">
            <SectionHead id="times-title" eyebrow={d.site.timesEyebrow} title={d.site.routineTitle} />
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
            {contact.address && (
              <p className="mt-4 flex items-start gap-2 text-[15.5px] text-ink-2">
                <MapPin className="mt-1 size-[18px] shrink-0 text-primary-text" aria-hidden="true" />
                {contact.address}
              </p>
            )}
          </div>
        </section>
      )}

      {(s.about || s.aboutRich) && (
        <section className="section" aria-labelledby="about-title">
          <div className="wrap max-w-[860px]">
            <SectionHead id="about-title" eyebrow={d.site.aboutEyebrow} title={locale === "bn" ? teacher.nameBn : teacher.nameEn} />
            <SiteText rich={s.aboutRich} plain={s.about ?? ""} className="text-[17px] leading-[1.9] text-ink-2" />
          </div>
        </section>
      )}

      {bank.length > 0 && (
        <section className="section section-alt" aria-labelledby="practice-title">
          <div className="wrap">
            <div className="practice">
              <div className="min-w-0">
                <p className="eyebrow">{d.site.practice.eyebrow}</p>
                <h2 id="practice-title">{d.site.practice.title}</h2>
                <p className="practice-text">{d.site.practice.text}</p>
                <ul className="practice-classes" aria-label={d.qbank.classes}>
                  {bank.map((node) => (
                    <li key={node.bankClass.id}>
                      <Link href={`${home}/bank/${node.bankClass.number}`} className="chip">
                        {node.bankClass.name}
                        <span className="text-muted">· {d.site.bank.questions(formatNumber(node.total, locale))}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="practice-side">
                <span className="practice-icon" aria-hidden="true">
                  <Library />
                </span>
                <b>{d.site.bank.questions(formatNumber(bank.reduce((sum, node) => sum + node.total, 0), locale))}</b>
                <span>{d.site.bank.subjects(formatNumber(bank.reduce((sum, node) => sum + node.subjects.length, 0), locale))}</span>
                <Link href={`${home}/bank`} className="btn btn-primary">
                  {d.site.practice.cta}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {plan && <PlanSection courses={courses} plan={plan} home={home} d={d} locale={locale} />}

      {notices.length > 0 && (
        <section className="section section-alt" aria-labelledby="notices-title">
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

      {hasContactRows && <ContactSection teacher={teacher} d={d} />}

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

      <CallBar contact={s.contact} d={d} />
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
  const { whatsapp } = contactLinks(s.contact);
  const facts = [
    s.location && { icon: MapPin, text: s.location },
    teacher.institution && { icon: Building2, text: teacher.institution },
  ].filter((f): f is { icon: typeof MapPin; text: string } => Boolean(f));

  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <div>
          {/* The news a visitor most needs, said first: admission is open. */}
          {s.admission && (
            <p className="hero-admission">
              <BadgeCheck aria-hidden="true" />
              {s.admission}
            </p>
          )}
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
              {whatsapp ? (
                <a href={whatsapp} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">
                  <WhatsappMark className="size-[18px] text-[#128c7e]" />
                  {d.site.whatsappWrite}
                </a>
              ) : (
                hasContact && (
                  <a href={s.contact && Object.values(s.contact).some(Boolean) ? "#contact" : "#times"} className="btn btn-ghost">
                    <Phone aria-hidden="true" />
                    {d.site.contactMe}
                  </a>
                )
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

/** How many chapters a lesson plan shows before the rest folds under "see all". */
const PLAN_WINDOW = 4;

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
  const chapters = plan.chapters;
  const done = chapters.filter((ch) => ch.status === "done").length;
  const nowAt = chapters.findIndex((ch) => ch.status === "ongoing");
  const now = chapters[nowAt];
  const next = chapters.find((ch, i) => i > nowAt && ch.status === "upcoming");
  // A long plan shows the chapters around where the batch is now; the whole of it is one tap away.
  const long = chapters.length > PLAN_WINDOW + 2;
  const at = nowAt >= 0 ? nowAt : Math.min(done, chapters.length - 1);
  const start = Math.max(0, Math.min(at - 1, chapters.length - PLAN_WINDOW));

  return (
    <section className="section" id="plan" aria-labelledby="plan-title">
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
                <b className="text-ink">{d.site.chaptersDone(formatNumber(done, locale), formatNumber(chapters.length, locale))}</b>
              </p>
              <div className="progress" role="presentation">
                <i style={{ width: `${Math.round((done / chapters.length) * 100)}%` }} />
              </div>
            </div>
            {now && (
              <p className="mt-4 rounded-md bg-surface-2 p-3 text-[14.5px] text-ink-2">
                <b className="text-ink">{d.site.nowTeaching}</b> {now.title}
                {next && (
                  <span className="mt-1 block">
                    <b className="text-ink">{d.site.planNext}</b> {next.title}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="card min-w-0">
            {long ? (
              <>
                <div className="plan-short">
                  <Timeline chapters={chapters.slice(start, start + PLAN_WINDOW)} offset={start} d={d} locale={locale} />
                </div>
                <details className="plan-all">
                  <summary>{d.site.planAll(formatNumber(chapters.length, locale))}</summary>
                  <Timeline chapters={chapters} d={d} locale={locale} />
                </details>
              </>
            ) : (
              <Timeline chapters={chapters} d={d} locale={locale} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactSection({ teacher, d }: { teacher: Teacher; d: Dictionary }) {
  const c = teacher.site.contact ?? {};
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
        <ul className="contact-grid">
          {rows.map((row) => {
            const body = (
              <>
                <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-text">{row.icon}</span>
                <span className="min-w-0">
                  <b className="block break-words font-semibold text-ink">{row.title}</b>
                  {row.sub && <span className="text-sm text-muted">{row.sub}</span>}
                </span>
              </>
            );
            return (
              <li key={row.title + row.href}>
                {row.href ? (
                  <a href={row.href} className="contact-tile" target={row.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                    {body}
                  </a>
                ) : (
                  <div className="contact-tile">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
