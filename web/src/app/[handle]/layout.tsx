import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { CurrentYear } from "@/components/current-year";
import { LangSwitch } from "@/components/lang-switch";
import { Logo, initialOf } from "@/components/logo";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getCurrentTeacher } from "@/server/auth/current";
import { getSite, getSiteCourses, getSiteNotices } from "./data";

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

  const [courses, notices] = await Promise.all([getSiteCourses(teacher.id), getSiteNotices(teacher.id, 5)]);
  const home = `/${teacher.handle}`;
  const s = teacher.site;
  const hasContact = Boolean(
    Object.values(s.contact ?? {}).some(Boolean) || (s.routine?.length ?? 0) > 0,
  );
  const links = [
    { href: home, label: d.site.nav.home },
    courses.length > 0 && { href: `${home}#courses`, label: d.site.nav.courses },
    courses.some((c) => c.chapters.length > 0) && { href: `${home}#plan`, label: d.site.nav.plan },
    notices.length > 0 && { href: `${home}/notices`, label: d.site.nav.notices },
    hasContact && { href: `${home}#contact`, label: d.site.nav.contact },
  ].filter((l): l is { href: string; label: string } => Boolean(l));
  const name = locale === "bn" ? teacher.nameBn : teacher.nameEn;

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
            <LangSwitch locale={locale} label={d.common.language} />
            {links.length > 1 && (
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
                </nav>
              </details>
            )}
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="site-footer">
        <div className="wrap flex flex-wrap items-center justify-between gap-3">
          <span>
            © <CurrentYear /> {name}
          </span>
          <Link href="/" className="text-[13px] text-muted">
            {d.common.builtWith}
          </Link>
        </div>
      </footer>
    </div>
  );
}
