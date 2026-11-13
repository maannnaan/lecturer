import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Ban, BadgeCheck, BookOpen, Check, CircleAlert, FilePlus2, Globe, Hourglass, Library, Megaphone, Plus } from "lucide-react";
import { type Dictionary, type Locale, formatDate, formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { richPlain } from "@/lib/rich-text";
import { requireTeacher } from "@/server/auth/current";
import { listBankClasses } from "@/server/bank";
import { listCourses } from "@/server/courses";
import { getDb } from "@/server/db";
import { listNotices } from "@/server/notices";
import { countByType } from "@/server/questions";
import { type Teacher, trialDaysLeft } from "@/server/teachers";

export const instant = false;

export const metadata: Metadata = { title: "ড্যাশবোর্ড" };

/**
 * The dashboard's first page: how the website stands, what is left to set up, the numbers that
 * matter and the tasks a teacher starts most often.
 */
export default async function DashboardHome() {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const o = d.dashboard.overview;
  const db = await getDb();
  const [courses, classes, byType, notices] = await Promise.all([
    listCourses(db, teacher.id),
    listBankClasses(db, teacher.id),
    countByType(db, teacher.id),
    listNotices(db, teacher.id),
  ]);
  const questions = Object.values(byType).reduce((sum, n) => sum + (n ?? 0), 0);
  const site = teacher.site;

  const steps = [
    { key: "photo", done: Boolean(site.photo), href: "/dashboard/website" },
    { key: "about", done: richPlain(site.aboutRich ?? site.about).trim() !== "", href: "/dashboard/website" },
    { key: "course", done: courses.length > 0, href: "/dashboard/courses/new" },
    { key: "bank", done: classes.length > 0, href: "/dashboard/bank/class/new" },
    { key: "notice", done: notices.length > 0, href: "/dashboard/notices" },
  ] as const;
  const done = steps.filter((step) => step.done).length;

  return (
    <main className="dash-content">
      <header>
        <h1 className="page-title">{d.dashboard.welcome(locale === "bn" ? teacher.nameBn : teacher.nameEn)}</h1>
        <p className="page-lead">{o.lead}</p>
      </header>

      <StatusPanel teacher={teacher} d={d} locale={locale} />

      <section aria-labelledby="numbers-title">
        <h2 id="numbers-title" className="sr-only">
          {o.numbers}
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Stat href="/dashboard/courses" icon={<BookOpen aria-hidden="true" />} value={formatNumber(courses.length, locale)} label={o.courses} />
          <Stat href="/dashboard/bank" icon={<Library aria-hidden="true" />} value={formatNumber(questions, locale)} label={o.questions} />
          <Stat href="/dashboard/notices" icon={<Megaphone aria-hidden="true" />} value={formatNumber(notices.length, locale)} label={o.notices} />
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          {done < steps.length && (
            <section className="card p-5" aria-labelledby="setup-title">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="setup-title" className="panel-title">
                  {o.setupTitle}
                </h2>
                <span className="text-sm font-semibold text-muted">{o.setupProgress(formatNumber(done, locale), formatNumber(steps.length, locale))}</span>
              </div>
              <div className="progress mt-3" aria-hidden="true">
                <i style={{ width: `${(done / steps.length) * 100}%` }} />
              </div>
              <ol className="steps mt-2">
                {steps.map((step) => {
                  const text = o.steps[step.key];
                  return (
                    <li key={step.key} className="step" data-done={step.done}>
                      <span className="step-mark" aria-hidden="true">
                        {step.done && <Check />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="step-title">{text.title}</p>
                        {!step.done && <p className="step-text">{text.text}</p>}
                      </div>
                      {!step.done && (
                        <Link href={step.href} className="btn btn-soft btn-xs shrink-0">
                          {text.cta}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          <section className="card p-5" aria-labelledby="quick-title">
            <h2 id="quick-title" className="panel-title">
              {o.quickTitle}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link href="/dashboard/bank/new" className="quick">
                <FilePlus2 aria-hidden="true" />
                {o.quick.question}
              </Link>
              <Link href="/dashboard/courses/new" className="quick">
                <Plus aria-hidden="true" />
                {o.quick.course}
              </Link>
              <Link href="/dashboard/notices" className="quick">
                <Megaphone aria-hidden="true" />
                {o.quick.notice}
              </Link>
              <Link href="/dashboard/website" className="quick">
                <Globe aria-hidden="true" />
                {o.quick.website}
              </Link>
            </div>
          </section>
        </div>

        <AccountCard teacher={teacher} d={d} locale={locale} />
      </div>
    </main>
  );
}

function Stat({ href, icon, value, label }: { href: string; icon: ReactNode; value: string; label: string }) {
  return (
    <Link href={href} className="stat-card">
      <span className="stat-icon">{icon}</span>
      <span className="min-w-0">
        <b>{value}</b>
        <span className="stat-label">{label}</span>
      </span>
    </Link>
  );
}

function StatusPanel({ teacher, d, locale }: { teacher: Teacher; d: Dictionary; locale: Locale }) {
  const s = d.dashboard.status;
  const address = `lecturer.bd/${teacher.handle}`;
  const visit = (
    <Link href={`/${teacher.handle}`} className="link">
      {s.visit}
      <ArrowRight aria-hidden="true" />
    </Link>
  );

  if (teacher.status === "approved") {
    const daysLeft = trialDaysLeft(teacher.trialEndsAt);
    return (
      <Panel tone="ok" icon={<BadgeCheck aria-hidden="true" />} title={s.approvedTitle}>
        <p>{s.approvedText(address)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {visit}
          {daysLeft !== null && (
            <span className={daysLeft > 0 ? "badge badge-warn" : "badge badge-bad"}>
              {daysLeft > 0 ? s.trial(formatNumber(daysLeft, locale)) : s.trialOver}
            </span>
          )}
        </div>
      </Panel>
    );
  }
  if (teacher.status === "pending") {
    return (
      <Panel tone="warn" icon={<Hourglass aria-hidden="true" />} title={s.pendingTitle}>
        <p>{s.pendingText(address)}</p>
        <div className="mt-3">{visit}</div>
      </Panel>
    );
  }
  const suspended = teacher.status === "suspended";
  return (
    <Panel
      tone="bad"
      icon={suspended ? <Ban aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
      title={suspended ? s.suspendedTitle : s.rejectedTitle}
    >
      {suspended && <p>{s.suspendedText}</p>}
      {teacher.statusNote && (
        <p>
          <b>{s.reason}</b> {teacher.statusNote}
        </p>
      )}
      <p className="text-muted">{s.contact}</p>
    </Panel>
  );
}

function Panel({
  tone,
  icon,
  title,
  children,
}: {
  tone: "ok" | "warn" | "bad";
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const toneClass = { ok: "bg-ok-soft text-ok", warn: "bg-accent-soft text-accent-ink", bad: "bg-bad-soft text-bad" }[tone];
  return (
    <section className="card flex gap-4 p-5" role="status">
      <span className={`grid size-11 shrink-0 place-items-center rounded-md [&>svg]:size-5 ${toneClass}`}>{icon}</span>
      <div className="min-w-0 text-[15px] text-ink-2">
        <h2 className="mb-1 text-lg">{title}</h2>
        {children}
      </div>
    </section>
  );
}

function AccountCard({ teacher, d, locale }: { teacher: Teacher; d: Dictionary; locale: Locale }) {
  const a = d.dashboard.account;
  const rows: [string, string][] = [
    [a.address, `lecturer.bd/${teacher.handle}`],
    [a.phone, teacher.phone],
    ...(teacher.email ? [[a.email, teacher.email] as [string, string]] : []),
    ...(teacher.subjects ? [[a.subjects, teacher.subjects] as [string, string]] : []),
    ...(teacher.institution ? [[a.institution, teacher.institution] as [string, string]] : []),
    [a.joined, formatDate(teacher.createdAt, locale)],
  ];
  return (
    <section className="card p-5" aria-labelledby="account-title">
      <h2 id="account-title" className="panel-title">
        {a.title}
      </h2>
      <dl className="mt-3 flex flex-col">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 border-t border-line py-2.5 text-[15px] first:border-t-0">
            <dt className="text-muted">{label}</dt>
            <dd className="min-w-0 text-right font-medium break-words text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
