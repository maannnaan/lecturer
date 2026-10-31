import Link from "next/link";
import { ArrowRight, BookOpen, Globe, Printer, Radio, Users, Wallet } from "lucide-react";
import { PlatformFooter, PlatformHeader } from "@/components/platform-chrome";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { THEMES, THEME_SWATCHES } from "@/lib/themes";

// Rendered per request in the visitor's language (a cookie), so it opts out of the static shell.
export const instant = false;

const FEATURE_ICONS = [Globe, BookOpen, Radio, Printer, Users, Wallet];

export default async function LandingPage() {
  const locale = await getLocale();
  const d = getDictionary(locale);

  return (
    <div lang={locale}>
      <PlatformHeader locale={locale} d={d} />
      <main>
        <section className="border-b border-line" style={{ background: "var(--lb-hero-bg)" }}>
          <div className="wrap grid items-center gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
            <div>
              <p className="eyebrow">{d.landing.kicker}</p>
              <h1 className="mt-3 text-[clamp(36px,5vw,58px)] leading-[1.15]">{d.landing.title}</h1>
              <p className="mt-5 max-w-[34em] text-lg leading-relaxed text-ink-2">{d.landing.lead}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/register" className="btn btn-primary">
                  {d.landing.cta}
                  <ArrowRight aria-hidden="true" />
                </Link>
                <span className="text-[15px] text-muted">
                  {d.landing.haveAccount}{" "}
                  <Link href="/login" className="link">
                    {d.common.login}
                  </Link>
                </span>
              </div>
            </div>

            {/* The three themes a teacher can choose from, each drawn in its own look. */}
            <div className="grid gap-3" aria-hidden="true">
              {THEMES.map((theme, i) => (
                <div
                  key={theme}
                  data-style={theme}
                  className="card flex items-center gap-4 bg-surface p-4"
                  style={{ marginLeft: `${i * 18}px`, background: THEME_SWATCHES[theme][0] }}
                >
                  <span className="brand-mark">{["ক", "খ", "গ"][i]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-head text-xl text-ink">{d.dashboard.theme.names[theme]}</span>
                    <span className="mt-1 flex gap-1.5">
                      {THEME_SWATCHES[theme].map((c) => (
                        <i key={c} className="block size-4 rounded-full border border-line" style={{ background: c }} />
                      ))}
                    </span>
                  </span>
                  <span className="btn btn-primary btn-xs">lecturer.bd</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 lg:py-20">
          <div className="wrap">
            <h2 className="text-[clamp(26px,3vw,34px)]">{d.landing.featuresTitle}</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {d.landing.features.map((f, i) => {
                const Icon = FEATURE_ICONS[i];
                return (
                  <li key={f.title} className="card flex flex-col gap-2 p-5">
                    <span className="grid size-10 place-items-center rounded-md bg-primary-soft text-primary-text">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-1 text-lg">{f.title}</h3>
                    <p className="text-[15px] text-ink-2">{f.text}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="border-t border-line bg-bg-2 py-16 lg:py-20">
          <div className="wrap">
            <h2 className="text-[clamp(26px,3vw,34px)]">{d.landing.stepsTitle}</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {d.landing.steps.map((s, i) => (
                <li key={s.title} className="card flex gap-4 p-5">
                  <span className="font-num text-3xl leading-none text-accent-ink">{formatNumber(i + 1, locale)}</span>
                  <span>
                    <h3 className="text-lg">{s.title}</h3>
                    <p className="mt-1 text-[15px] text-ink-2">{s.text}</p>
                  </span>
                </li>
              ))}
            </ol>
            <Link href="/register" className="btn btn-primary mt-8">
              {d.landing.cta}
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <PlatformFooter />
    </div>
  );
}
