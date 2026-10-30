import Link from "next/link";
import { CurrentYear } from "@/components/current-year";
import { LangSwitch } from "@/components/lang-switch";
import { Logo } from "@/components/logo";
import type { Dictionary, Locale } from "@/i18n";

/** Header for Lecturer.bd's own pages (not a teacher's website). */
export function PlatformHeader({ locale, d, hideAuth = false }: { locale: Locale; d: Dictionary; hideAuth?: boolean }) {
  return (
    <header className="site-header">
      <div className="wrap header-row">
        <Link href="/" aria-label="Lecturer.bd">
          <Logo />
        </Link>
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

export function PlatformFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap flex flex-wrap items-center justify-between gap-4">
        <span>
          © <CurrentYear /> Lecturer.bd
        </span>
        <span className="text-muted">lecturer.bd</span>
      </div>
    </footer>
  );
}
