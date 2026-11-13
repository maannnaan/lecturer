import Link from "next/link";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { PlatformHeader } from "@/components/platform-chrome";
import type { Dictionary, Locale } from "@/i18n";

/**
 * The frame around sign-up and sign-in forms: the platform's header, then one card. On wide
 * screens the card has a green panel beside the form saying what a teacher gets.
 */
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
    <div lang={locale} className="min-h-dvh">
      <PlatformHeader locale={locale} d={d} hideAuth />
      <main className="wrap flex justify-center py-8 sm:py-14">
        <div className="card grid w-full max-w-[1000px] overflow-hidden shadow-float lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <aside className="flex flex-col justify-between gap-8 bg-primary p-9 text-on-primary max-lg:hidden">
            <div>
              <p className="text-[14px] font-semibold opacity-80">{d.landing.kicker}</p>
              <p className="mt-2 font-head text-[30px] leading-[1.25] font-bold">{d.landing.title}</p>
              <p className="mt-3 text-[15.5px] opacity-90">{d.landing.footerLine}</p>
            </div>
            <ul className="flex flex-col gap-3 text-[15.5px] font-semibold">
              {d.landing.trust.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/20">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </aside>
          <div className="min-w-0 p-6 sm:p-9">
            <h1 className="text-3xl">{title}</h1>
            <p className="mt-2 text-ink-2">{lead}</p>
            <div className="mt-7">{children}</div>
            {footer && <div className="mt-6 border-t border-line pt-5 text-[15px] text-ink-2">{footer}</div>}
          </div>
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
