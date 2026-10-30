import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LangSwitch } from "@/components/lang-switch";
import { Logo } from "@/components/logo";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireAdmin } from "@/server/auth/current";
import { adminLogoutAction } from "./actions";

export const instant = false;

export const metadata: Metadata = { robots: { index: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  const locale = await getLocale();
  const d = getDictionary(locale);
  return (
    <div lang={locale} className="min-h-dvh">
      <header className="site-header">
        <div className="wrap header-row">
          <Link href="/admin" className="flex items-center gap-3">
            <Logo />
            <span className="badge badge-primary">{d.admin.panel}</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted max-md:hidden">{d.admin.signedInAs(admin.name)}</span>
            <LangSwitch locale={locale} label={d.common.language} />
            <form action={adminLogoutAction}>
              <button type="submit" className="btn btn-ghost btn-sm">
                {d.common.logout}
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
