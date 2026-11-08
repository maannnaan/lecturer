import Link from "next/link";
import { CurrentYear } from "@/components/current-year";
import { LangSwitch } from "@/components/lang-switch";
import { Logo } from "@/components/logo";
import type { Dictionary, Locale } from "@/i18n";

type NavItem = { href: string; label: string };

/** Header for Lecturer.bd's own pages (not a teacher's website). */
export function PlatformHeader({
  locale,
  d,
  hideAuth = false,
  nav,
}: {
  locale: Locale;
  d: Dictionary;
  hideAuth?: boolean;
  /** In-page links (the landing page's sections), shown on wide screens only. */
  nav?: NavItem[];
}) {
  return (
    <header className="site-header">
      <div className="wrap header-row">
        <Link href="/" aria-label="Lecturer.bd">
          <Logo />
        </Link>
        {nav && (
          <nav className="ml-6 flex items-center gap-0.5 max-lg:hidden" aria-label={d.common.menu}>
            {nav.map((item) => (
              <a key={item.href} href={item.href} className="nav-link">
                {item.label}
              </a>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2.5">
          <LangSwitch locale={locale} label={d.common.language} />
          {!hideAuth && (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm max-sm:hidden">
                {d.common.login}
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                {d.common.register}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PlatformFooter({ d }: { d?: Dictionary }) {
  return (
    <footer className="site-footer">
      <div className="wrap flex flex-wrap items-center justify-between gap-4">
        <span>
          © <CurrentYear /> Lecturer.bd
        </span>
        {d ? (
          <nav className="flex flex-wrap items-center gap-5" aria-label="Lecturer.bd">
            <Link href="/login" className="hover:text-ink">
              {d.common.login}
            </Link>
            <Link href="/register" className="hover:text-ink">
              {d.common.register}
            </Link>
          </nav>
        ) : (
          <span className="text-muted">lecturer.bd</span>
        )}
      </div>
    </footer>
  );
}
