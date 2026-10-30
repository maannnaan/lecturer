import Link from "next/link";
import type { ReactNode } from "react";
import { PlatformHeader } from "@/components/platform-chrome";
import type { Dictionary, Locale } from "@/i18n";

/** The frame around sign-up and sign-in forms: platform header, one centred card. */
export function AuthShell({
  locale,
  d,
  title,
  lead,
  children,
  footer,
}: {
  locale: Locale;
  d: Dictionary;
  title: string;
  lead: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div lang={locale} className="min-h-dvh" style={{ background: "var(--lb-hero-bg)" }}>
      <PlatformHeader locale={locale} d={d} hideAuth />
      <main className="wrap flex justify-center py-10 sm:py-16">
        <div className="card w-full max-w-[620px] p-6 shadow-float sm:p-9">
          <h1 className="text-3xl">{title}</h1>
          <p className="mt-2 text-ink-2">{lead}</p>
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 border-t border-line pt-5 text-[15px] text-ink-2">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

export function AuthSwitch({ question, href, label }: { question: string; href: string; label: string }) {
  return (
    <p>
      {question}{" "}
      <Link href={href} className="link">
        {label}
      </Link>
    </p>
  );
}
