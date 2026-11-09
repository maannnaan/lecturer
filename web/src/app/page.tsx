import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  Globe,
  Languages,
  Library,
  Megaphone,
  Palette,
  Printer,
  Radio,
  Users,
  Wallet,
} from "lucide-react";
import { ClaimForm } from "@/components/landing/claim-form";
import { Faq } from "@/components/landing/faq";
import { SiteMockup } from "@/components/landing/site-mockup";
import { PlatformFooter, PlatformHeader } from "@/components/platform-chrome";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { THEMES } from "@/lib/themes";

// Rendered per request in the visitor's language (a cookie), so it opts out of the static shell.
export const instant = false;

// In the same order as landing.ready and landing.soon in the dictionaries.
const READY_ICONS = [Globe, BookOpen, Library, Megaphone, Palette, Languages];
const SOON_ICONS = [Radio, Printer, Users, Wallet];

export default async function LandingPage() {
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.landing;

  const nav = [
    { href: "#features", label: t.nav.features },
    { href: "#themes", label: t.nav.themes },
    { href: "#steps", label: t.nav.steps },
    { href: "#faq", label: t.nav.faq },
  ];

  return (
    <div lang={locale}>
      <PlatformHeader locale={locale} d={d} nav={nav} />
      <main>
        {/* Hero: what you get, the address box, and a drawing of a teacher's site */}
        <section className="lp-hero">
          <div className="wrap lp-hero-grid">
            <div>
              <p className="eyebrow">{t.kicker}</p>
              <h1 className="lp-title">{t.title}</h1>
              <p className="lp-lead">{t.lead}</p>
              <div className="mt-8">
                <ClaimForm t={t.claim} id="claim-hero" />
              </div>
              <ul className="lp-trust">
                {t.trust.map((item) => (
                  <li key={item}>
                    <Check aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[15px] text-muted">
                {t.haveAccount}{" "}
                <Link href="/login" className="link">
                  {d.common.login}
                </Link>
              </p>
            </div>
            <div className="lp-hero-figure">
              <SiteMockup theme="ink" m={t.mock} />
            </div>
          </div>
        </section>

        {/* Features: what works today, then what's on the way */}
        <section id="features" className="section lp-anchor">
          <div className="wrap">
            <div className="section-head">
              <h2>{t.featuresTitle}</h2>
            </div>

            <h3 className="lp-group-title">{t.readyTitle}</h3>
            <ul className="lp-features">
              {t.ready.map((f, i) => {
                const Icon = READY_ICONS[i] ?? Globe;
                return (
                  <li key={f.title} className="card lp-feature">
                    <span className="lp-feature-icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <h4>{f.title}</h4>
                    <p>{f.text}</p>
                  </li>
                );
              })}
            </ul>

            <h3 className="lp-group-title mt-12">{t.soonTitle}</h3>
            <ul className="lp-features">
              {t.soon.map((f, i) => {
                const Icon = SOON_ICONS[i] ?? Radio;
                return (
                  <li key={f.title} className="lp-feature lp-feature-soon">
                    <span className="flex items-center justify-between gap-3">
                      <span className="lp-feature-icon">
                        <Icon aria-hidden="true" />
                      </span>
                      <span className="badge badge-warn">{d.common.soon}</span>
                    </span>
                    <h4>{f.title}</h4>
                    <p>{f.text}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* The three themes, each drawn in its own look */}
        <section id="themes" className="section section-alt lp-anchor">
          <div className="wrap">
            <div className="section-head">
              <div>
                <h2>{t.themesTitle}</h2>
                <p className="lp-section-lead">{t.themesLead}</p>
              </div>
            </div>
            <ul className="lp-themes">
              {THEMES.map((theme) => (
                <li key={theme} className="lp-theme">
                  <SiteMockup theme={theme} m={t.mock} compact />
                  <span className="lp-theme-name">{d.dashboard.theme.names[theme]}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How to start */}
        <section id="steps" className="section lp-anchor">
          <div className="wrap">
            <div className="section-head">
              <h2>{t.stepsTitle}</h2>
            </div>
            <ol className="lp-steps">
              {t.steps.map((s, i) => (
                <li key={s.title} className="lp-step">
                  <span className="lp-step-num">{formatNumber(i + 1, locale)}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Questions */}
        <section id="faq" className="section section-alt lp-anchor">
          <div className="wrap lp-faq-grid">
            <div className="section-head">
              <h2>{t.faqTitle}</h2>
            </div>
            <Faq items={t.faq} />
          </div>
        </section>

        {/* Last call */}
        <section className="lp-cta">
          <div className="wrap lp-cta-inner">
            <div>
              <h2>{t.ctaTitle}</h2>
              <p>{t.ctaText}</p>
            </div>
            <div className="flex flex-col gap-3">
              <ClaimForm t={t.claim} id="claim-cta" onDark />
              <Link href="/register" className="lp-cta-link">
                {t.cta}
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <PlatformFooter d={d} />
    </div>
  );
}
