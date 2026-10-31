import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Ban, BadgeCheck, CircleAlert, Hourglass } from "lucide-react";
import { type Dictionary, type Locale, formatDate, formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { type Teacher, trialDaysLeft } from "@/server/teachers";
import { ThemePicker } from "./theme-picker";

export const instant = false;

export const metadata: Metadata = { title: "ড্যাশবোর্ড" };

export default async function DashboardHome() {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);

  return (
    <main className="dash-content">
      <h2 className="text-2xl lg:hidden">{d.dashboard.welcome(locale === "bn" ? teacher.nameBn : teacher.nameEn)}</h2>
      <StatusPanel teacher={teacher} d={d} locale={locale} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <ThemePicker teacher={teacher} t={d.dashboard.theme} />
        <div className="flex flex-col gap-6">
          <AccountCard teacher={teacher} d={d} locale={locale} />
          <section className="card p-5">
            <h3 className="panel-title">{d.dashboard.next.title}</h3>
            <ul className="mt-3 flex flex-col gap-2">
              {d.dashboard.next.items.map((item) => (
                <li key={item} className="flex items-start justify-between gap-3 text-[15px] text-ink-2">
                  <span>{item}</span>
                  <span className="badge shrink-0">{d.common.soon}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted">{d.dashboard.next.note}</p>
          </section>
        </div>
      </div>
    </main>
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
        <h3 className="mb-1 text-lg">{title}</h3>
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
    <section className="card p-5">
      <h3 className="panel-title">{a.title}</h3>
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
