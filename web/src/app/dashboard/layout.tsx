import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  ExternalLink,
  Globe,
  House,
  Layers,
  LayoutDashboard,
  Library,
  LogOut,
  Megaphone,
  Printer,
  Radio,
  ScanLine,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { LangSwitch } from "@/components/lang-switch";
import { Logo, initialOf } from "@/components/logo";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { logoutAction } from "./actions";
import { NavLink } from "./nav-link";

// Everything here belongs to the signed-in teacher, so it renders per request.
export const instant = false;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard;
  const name = locale === "bn" ? teacher.nameBn : teacher.nameEn;

  // Sections that arrive in later phases are listed, but not yet links.
  const soon = (Icon: LucideIcon, label: string) => (
    <span className="side-link" aria-disabled="true">
      <Icon aria-hidden="true" />
      {label}
      <span className="soon">{d.common.soon}</span>
    </span>
  );

  return (
    <div data-style={teacher.theme} className="theme-scope" lang={locale}>
      <div className="dash">
        <aside className="dash-side" aria-label={d.common.menu}>
          <Link href="/dashboard" className="px-2.5 pb-2 pt-1">
            <Logo />
          </Link>
          <Link href={`/${teacher.handle}`} className="side-site">
            <span className="min-w-0">
              <b>{t.mySite}</b>lecturer.bd/{teacher.handle}
            </span>
            <ExternalLink className="ml-auto size-4" aria-hidden="true" />
          </Link>

          <NavLink href="/dashboard" exact className="side-link">
            <LayoutDashboard aria-hidden="true" />
            {t.nav.overview}
          </NavLink>
          <p className="side-label">{t.groups.teaching}</p>
          <NavLink href="/dashboard/courses" className="side-link">
            <BookOpen aria-hidden="true" />
            {t.nav.courses}
          </NavLink>
          {soon(Library, t.nav.bank)}
          <NavLink href="/dashboard/website" className="side-link">
            <Globe aria-hidden="true" />
            {t.nav.website}
          </NavLink>
          <NavLink href="/dashboard/notices" className="side-link">
            <Megaphone aria-hidden="true" />
            {t.nav.notices}
          </NavLink>
          <p className="side-label">{t.groups.students}</p>
          {soon(Users, t.nav.students)}
          {soon(Layers, t.nav.batches)}
          {soon(UserPlus, t.nav.requests)}
          <p className="side-label">{t.groups.exams}</p>
          {soon(Radio, t.nav.live)}
          {soon(Printer, t.nav.papers)}
          <p className="side-label">{t.groups.accounts}</p>
          {soon(Wallet, t.nav.payments)}
          {soon(ScanLine, t.nav.scanner)}

          <form action={logoutAction} className="mt-auto pt-3">
            <button type="submit" className="side-link w-full cursor-pointer">
              <LogOut aria-hidden="true" />
              {d.common.logout}
            </button>
          </form>
        </aside>

        <div className="min-w-0">
          <header className="dash-topbar">
            <h1 className="min-w-0 truncate text-[21px]">{t.welcome(name)}</h1>
            <div className="ml-auto flex items-center gap-3">
              <LangSwitch locale={locale} label={d.common.language} />
              <span className="avatar" aria-hidden="true">
                {initialOf(teacher.nameBn)}
              </span>
            </div>
          </header>
          <header className="dash-mobile-top">
            <Logo />
            <div className="ml-auto flex items-center gap-2">
              <LangSwitch locale={locale} label={d.common.language} />
              <form action={logoutAction}>
                <button type="submit" className="grid size-10 place-items-center" aria-label={d.common.logout}>
                  <LogOut className="size-5" aria-hidden="true" />
                </button>
              </form>
            </div>
          </header>
          {children}
        </div>
      </div>

      <nav className="bottom-nav" aria-label={d.common.menu}>
        <NavLink href="/dashboard" exact>
          <House aria-hidden="true" />
          {t.mobileNav.home}
        </NavLink>
        <NavLink href="/dashboard/courses">
          <BookOpen aria-hidden="true" />
          {t.nav.courses}
        </NavLink>
        <NavLink href="/dashboard/website">
          <Globe aria-hidden="true" />
          {t.nav.website}
        </NavLink>
        <NavLink href="/dashboard/notices">
          <Megaphone aria-hidden="true" />
          {t.nav.notices}
        </NavLink>
        <span aria-disabled="true">
          <Users aria-hidden="true" />
          {t.mobileNav.students}
        </span>
      </nav>
    </div>
  );
}
