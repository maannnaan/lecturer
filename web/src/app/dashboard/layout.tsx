import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  ChevronDown,
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
import "katex/dist/katex.min.css";
import { PendingButton } from "@/components/form";
import { LangSwitch } from "@/components/lang-switch";
import { Logo, initialOf } from "@/components/logo";
import { type Dictionary, formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { countPendingEnrollments } from "@/server/enrollments";
import { logoutAction } from "./actions";
import { MobileMenu } from "./mobile-menu";
import { NavLink } from "./nav-link";

// Everything here belongs to the signed-in teacher, so it renders per request.
export const instant = false;

/**
 * The dashboard's sections, shared by the sidebar (wide screens) and the menu sheet (phones):
 * what works today first, then what arrives in later phases, folded away under one line.
 */
function DashNav({ d, pending }: { d: Dictionary; pending: string | null }) {
  const t = d.dashboard;
  const soon = (Icon: LucideIcon, label: string) => (
    <span className="side-link" aria-disabled="true">
      <Icon aria-hidden="true" />
      {label}
    </span>
  );
  return (
    <>
      <NavLink href="/dashboard" exact className="side-link">
        <LayoutDashboard aria-hidden="true" />
        {t.nav.overview}
      </NavLink>
      <NavLink href="/dashboard/courses" className="side-link">
        <BookOpen aria-hidden="true" />
        {t.nav.courses}
      </NavLink>
      <NavLink href="/dashboard/bank" className="side-link">
        <Library aria-hidden="true" />
        {t.nav.bank}
      </NavLink>
      <NavLink href="/dashboard/website" className="side-link">
        <Globe aria-hidden="true" />
        {t.nav.website}
      </NavLink>
      <NavLink href="/dashboard/notices" className="side-link">
        <Megaphone aria-hidden="true" />
        {t.nav.notices}
      </NavLink>
      <p className="side-label">{t.students.title}</p>
      <NavLink href="/dashboard/requests" className="side-link">
        <UserPlus aria-hidden="true" />
        {t.nav.requests}
        {pending && <span className="side-count">{pending}</span>}
      </NavLink>
      <NavLink href="/dashboard/students" className="side-link">
        <Users aria-hidden="true" />
        {t.nav.students}
      </NavLink>
      <NavLink href="/dashboard/batches" className="side-link">
        <Layers aria-hidden="true" />
        {t.nav.batches}
      </NavLink>
      <details className="side-soon">
        <summary>
          {t.comingSoon}
          <ChevronDown aria-hidden="true" />
        </summary>
        {soon(Radio, t.nav.live)}
        {soon(Printer, t.nav.papers)}
        {soon(Wallet, t.nav.payments)}
        {soon(ScanLine, t.nav.scanner)}
      </details>
    </>
  );
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard;
  const name = locale === "bn" ? teacher.nameBn : teacher.nameEn;
  // Requests waiting for the teacher, shown beside the menu's link.
  const waiting = await countPendingEnrollments(await getDb(), teacher.id);
  const pending = waiting > 0 ? formatNumber(waiting, locale) : null;
  const siteLink = (
    <Link href={`/${teacher.handle}`} className="side-site">
      <span className="min-w-0">
        <b>{t.mySite}</b>lecturer.bd/{teacher.handle}
      </span>
      <ExternalLink className="ml-auto size-4" aria-hidden="true" />
    </Link>
  );

  // The dashboard wears the platform's own look; the teacher's theme is for their public website.
  return (
    <div data-style="app" className="theme-scope" lang={locale}>
      <div className="dash">
        <aside className="dash-side" aria-label={d.common.menu}>
          <Link href="/dashboard" className="px-2.5 pb-2 pt-1">
            <Logo />
          </Link>
          {siteLink}
          <DashNav d={d} pending={pending} />

          <div className="side-account">
            <div className="side-who">
              <span className="avatar" aria-hidden="true">
                {initialOf(teacher.nameBn)}
              </span>
              <span className="min-w-0">
                <b>{name}</b>
                <span>{teacher.phone}</span>
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 px-2">
              <LangSwitch locale={locale} label={d.common.language} />
              <form action={logoutAction}>
                <PendingButton className="side-link cursor-pointer !min-h-9 !px-2.5">
                  <LogOut aria-hidden="true" />
                  {d.common.logout}
                </PendingButton>
              </form>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="dash-mobile-top">
            <MobileMenu label={d.common.menu}>
              {siteLink}
              <DashNav d={d} pending={pending} />
            </MobileMenu>
            <Logo />
            <div className="ml-auto flex items-center gap-2">
              <LangSwitch locale={locale} label={d.common.language} />
              <form action={logoutAction}>
                <PendingButton className="grid size-10 place-items-center" aria-label={d.common.logout}>
                  <LogOut className="size-5" aria-hidden="true" />
                </PendingButton>
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
          {t.overview.courses}
        </NavLink>
        <NavLink href="/dashboard/bank">
          <Library aria-hidden="true" />
          {t.mobileNav.questions}
        </NavLink>
        <NavLink href="/dashboard/website">
          <Globe aria-hidden="true" />
          {t.nav.website}
        </NavLink>
        <NavLink href="/dashboard/notices">
          <Megaphone aria-hidden="true" />
          {t.nav.notices}
        </NavLink>
      </nav>
    </div>
  );
}
