import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { ReactNode } from "react";
import { Menu, Phone, UserRound } from "lucide-react";
import "katex/dist/katex.min.css";
import { CurrentYear } from "@/components/current-year";
import { LangSwitch } from "@/components/lang-switch";
import { Logo, initialOf } from "@/components/logo";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getCurrentStudent, getCurrentTeacher } from "@/server/auth/current";
import { getSite, getSiteBank, getSiteCourses, getSiteNotices } from "./data";
import { contactLinks } from "./site-ui";

// The handle has to be resolved before the response starts, so an unknown address can answer 404
// and an old one 308. That means rendering per request: no static shell, and no loading.tsx here
// (a loading boundary would stream a 200 first and turn both into in-page navigations).
export const instant = false;

type Props = { children: ReactNode; params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const site = await getSite((await params).handle.toLowerCase());
  if (!site || site.teacher.status !== "approved") return { robots: { index: false } };
  const t = site.teacher;
  const lead = t.site.tagline || [t.site.designation, t.subjects, t.institution].filter(Boolean).join(" · ");
  return {
    // The teacher's own name, with no platform suffix: this is their website.
    title: { absolute: t.subjects ? `${t.nameBn} — ${t.subjects}` : t.nameBn },
    description: lead || undefined,
    alternates: { canonical: `/${t.handle}` },
    openGraph: {
      siteName: t.nameBn,
      title: t.nameBn,
      description: lead || undefined,
      images: t.site.photo ? [{ url: t.site.photo.url }] : undefined,
    },
  };
}

export default async function TeacherSiteLayout({ children, params }: Props) {
  const { handle } = await params;
  // proxy.ts already answers unknown, old and mis-cased addresses with a real 404 or 308 before
  // this runs; these checks cover what it skips (paths with a dot) and races with a handle change.
  if (!/^[A-Za-z0-9_-]+$/.test(handle)) notFound();
  const wanted = handle.toLowerCase();
  if (wanted !== handle) permanentRedirect(`/${wanted}`);

  const site = await getSite(wanted);
  if (!site) notFound();
  if (!site.current) permanentRedirect(`/${site.teacher.handle}`);

  const teacher = site.teacher;
  const isOwner = (await getCurrentTeacher())?.id === teacher.id;
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);

  if (teacher.status !== "approved" && !isOwner) {
    if (teacher.status !== "suspended") notFound();
    return (
      <main lang={locale} className="wrap flex min-h-dvh flex-col items-start justify-center gap-4 py-16">
        <h1 className="text-3xl">{d.site.unavailableTitle}</h1>
        <p className="text-ink-2">{d.site.unavailableText}</p>
        <Link href="/" aria-label="Lecturer.bd">
          <Logo />
        </Link>
      </main>
    );
  }

  const [courses, notices, bank] = await Promise.all([
    getSiteCourses(teacher.id),
    getSiteNotices(teacher.id, 5),
    getSiteBank(teacher.id),
  ]);
  const home = `/${teacher.handle}`;
  const s = teacher.site;
  const hasContact = Boolean(
    Object.values(s.contact ?? {}).some(Boolean) || (s.routine?.length ?? 0) > 0,
  );
  const links = [
    { href: home, label: d.site.nav.home },
    courses.length > 0 && { href: `${home}#courses`, label: d.site.nav.courses },
    bank.length > 0 && { href: `${home}/bank`, label: d.site.nav.bank },
    courses.some((c) => c.chapters.length > 0) && { href: `${home}#plan`, label: d.site.nav.plan },
    notices.length > 0 && { href: `${home}/notices`, label: d.site.nav.notices },
    // The contact section, or the class times when that is all the teacher has given.
    hasContact && { href: `${home}#${Object.values(s.contact ?? {}).some(Boolean) ? "contact" : "times"}`, label: d.site.nav.contact },
  ].filter((l): l is { href: string; label: string } => Boolean(l));
  const name = locale === "bn" ? teacher.nameBn : teacher.nameEn;
  const { tel } = contactLinks(s.contact);
  // Students have accounts on live sites only: their own page when signed in, else the way in.
  const student = teacher.status === "approved" ? await getCurrentStudent(teacher.id) : null;
  const account =
    teacher.status === "approved" ? (student ? { href: `${home}/me`, label: d.site.student.me } : { href: `${home}/login`, label: d.site.student.login }) : null;

  return (
    <div data-style={teacher.theme} className="theme-scope flex flex-col" lang={locale}>
      {teacher.status !== "approved" && (
        <p className="bg-accent-soft px-4 py-2 text-center text-sm font-semibold text-accent-ink" role="status">
          {d.site.previewBanner}
        </p>
      )}
      <header className="site-header">
        <div className="wrap header-row">
          <Link href={home} className="flex min-w-0 items-center gap-3">
            {s.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- uploads live on our own host or Cloudinary
              <img src={s.photo.url} alt="" className="brand-photo" />
            ) : (
              <span className="brand-mark">{initialOf(teacher.nameBn)}</span>
            )}
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate font-head text-[19px] text-ink">{name}</span>
              {teacher.subjects && <span className="truncate text-[13px] text-muted">{teacher.subjects}</span>}
            </span>
          </Link>
          {links.length > 1 && (
            <nav className="site-nav" aria-label={d.common.menu}>
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="nav-link">
                  {l.label}
                </Link>
              ))}
            </nav>
          )}
          <div className="site-actions">
            {/* On wide screens the number is always in sight; phones get the bar at the foot of the page. */}
            {tel && (
              <a href={tel} className="btn btn-primary btn-sm max-[1180px]:hidden">
                <Phone aria-hidden="true" />
                {s.contact?.phone}
              </a>
            )}
            {account && (
              <Link href={account.href} className="btn btn-ghost btn-sm max-sm:hidden">
                <UserRound aria-hidden="true" />
                {account.label}
              </Link>
            )}
            <LangSwitch locale={locale} label={d.common.language} />
            {(links.length > 1 || account) && (
              <details className="site-menu">
                <summary aria-label={d.common.menu}>
                  <Menu className="size-5" aria-hidden="true" />
                </summary>
                <nav className="site-menu-list" aria-label={d.common.menu}>
                  {links.map((l) => (
                    <Link key={l.href} href={l.href}>
                      {l.label}
                    </Link>
                  ))}
                  {account && (
                    <Link href={account.href} className="!font-semibold !text-primary-text">
                      {account.label}
                    </Link>
                  )}
                </nav>
              </details>
            )}
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="site-footer">
        <div className="wrap flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-5">
            <div className="min-w-0">
              <p className="font-head text-[19px] text-ink">{name}</p>
              {teacher.subjects && <p className="text-[14.5px]">{teacher.subjects}</p>}
              {s.contact?.address && <p className="mt-1 max-w-[30em] text-[14.5px]">{s.contact.address}</p>}
            </div>
            {links.length > 1 && (
              <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[15px]" aria-label={d.common.menu}>
                {links.map((l) => (
                  <Link key={l.href} href={l.href} className="hover:text-ink">
                    {l.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <span>
              © <CurrentYear /> {name}
            </span>
            <Link href="/" className="text-[13px] text-muted">
              {d.common.builtWith}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
