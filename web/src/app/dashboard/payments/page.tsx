import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Plus, Settings, Wallet } from "lucide-react";
import { PendingButton } from "@/components/form";
import { QbPrintButton } from "@/components/qbank/auto-print";
import { paymentFor, periodName } from "@/components/receipt";
import { formatDate, formatMonth, formatNumber, formatTaka, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { dhakaMonth } from "@/lib/students";
import { requireTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { collectedByMonth, countPendingPayments, listDues, listPayments } from "@/server/payments";
import { cancelPaymentAction, verifyPaymentAction } from "./actions";

export const instant = false;

export const metadata: Metadata = { title: "পেমেন্ট ও বকেয়া" };

const TABS = ["verify", "all", "dues"] as const;
type Tab = (typeof TABS)[number];
const STATUS_BADGE = { pending: "badge badge-warn", verified: "badge badge-ok", rejected: "badge badge-bad", failed: "badge badge-bad" } as const;

/**
 * Money, in three views: the payments students say they sent, waiting to be checked; every
 * payment; and who owes what by this month.
 */
export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.payments;
  const db = await getDb();
  const asked = (await searchParams).tab;
  const waiting = await countPendingPayments(db, teacher.id);
  // Claims to check come first when there are any; otherwise the dues.
  const tab: Tab = (TABS as readonly string[]).includes(asked ?? "") ? (asked as Tab) : waiting > 0 ? "verify" : "dues";
  const now = dhakaMonth();
  const n = (value: number) => formatNumber(value, locale);

  const [claims, all, dues, collected] = await Promise.all([
    tab === "verify" ? listPayments(db, teacher.id, { status: "pending" }) : [],
    tab === "all" ? listPayments(db, teacher.id) : [],
    tab === "dues" ? listDues(db, teacher.id) : [],
    collectedByMonth(db, teacher.id, [now]),
  ]);

  return (
    <main className="dash-content">
      <header className="page-head" data-print-hide>
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-lead">{t.lead}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/payments/settings" className="btn btn-ghost btn-sm">
            <Settings aria-hidden="true" />
            {t.settings}
          </Link>
          <Link href="/dashboard/payments/new" className="btn btn-primary btn-sm">
            <Plus aria-hidden="true" />
            {t.record}
          </Link>
        </div>
      </header>

      <nav className="tabs" aria-label={t.title} data-print-hide>
        {TABS.map((key) => (
          <Link key={key} href={`/dashboard/payments?tab=${key}`} aria-current={key === tab ? "page" : undefined} className="tab">
            {t.tabs[key]}
            {key === "verify" && waiting > 0 && <span className="tab-count">{n(waiting)}</span>}
          </Link>
        ))}
      </nav>

      {tab === "verify" &&
        (claims.length === 0 ? (
          <div className="empty">
            <span className="empty-icon" aria-hidden="true">
              <BadgeCheck />
            </span>
            <p className="empty-text">{t.verifyEmpty}</p>
          </div>
        ) : (
          <>
            <p className="text-[15px] text-ink-2">{t.verifyHint}</p>
            <ul className="flex flex-col gap-4">
              {claims.map((claim) => (
                <li key={claim.id} className="card flex flex-col gap-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-ink">
                        <Link href={`/dashboard/students/${claim.studentId}`}>{claim.studentName}</Link>
                      </p>
                      <p className="text-[15px] text-ink-2">{paymentFor(claim, d, locale)}</p>
                      <p className="text-sm text-muted">{formatDate(claim.createdAt, locale)}</p>
                    </div>
                    <b className="font-num text-[26px] text-ink">{formatTaka(claim.amount, locale)}</b>
                  </div>
                  <dl className="grid gap-x-6 gap-y-1 rounded-md bg-surface-2 p-3 text-[15px] sm:grid-cols-3">
                    <div>
                      <dt className="text-[13px] text-muted">{t.form.method}</dt>
                      <dd className="font-semibold text-ink">{t.methods[claim.method]}</dd>
                    </div>
                    <div>
                      <dt className="text-[13px] text-muted">{t.txn}</dt>
                      <dd className="font-semibold break-all text-ink">{claim.txnId}</dd>
                    </div>
                    <div>
                      <dt className="text-[13px] text-muted">{t.sender}</dt>
                      <dd className="font-semibold text-ink">{claim.senderNumber || "—"}</dd>
                    </div>
                  </dl>
                  {/* A bKash payment comes here only when bKash's answer couldn't be had. */}
                  {claim.method === "bkash_gateway" && (
                    <p className="form-alert">
                      {t.gateway.unconfirmed}
                      {claim.note && ` (${claim.note})`}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <form action={verifyPaymentAction}>
                      <input type="hidden" name="paymentId" value={claim.id} />
                      <PendingButton className="btn btn-primary btn-sm">
                        <BadgeCheck aria-hidden="true" />
                        {t.verify}
                      </PendingButton>
                    </form>
                    <form action={cancelPaymentAction} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <input type="hidden" name="paymentId" value={claim.id} />
                      <input name="note" className="input !h-10 min-w-0 flex-1 text-[15px]" placeholder={t.rejectNote} aria-label={t.rejectNote} maxLength={200} />
                      <PendingButton className="btn btn-danger btn-sm">{t.reject}</PendingButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ))}

      {tab === "all" && (
        <>
          <p className="text-[15px] font-semibold text-ink-2">{t.collected(formatMonth(now, locale), formatTaka(collected.get(now) ?? 0, locale))}</p>
          {all.length === 0 ? (
            <div className="empty">
              <span className="empty-icon" aria-hidden="true">
                <Wallet />
              </span>
              <p className="empty-text">{t.allEmpty}</p>
            </div>
          ) : (
            <ul className="card divide-y divide-line">
              {all.map((payment) => (
                <li key={payment.id}>
                  <Link href={`/dashboard/payments/${payment.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <b className="block font-semibold text-ink">{payment.studentName}</b>
                      <span className="block text-[14px] text-ink-2">{paymentFor(payment, d, locale)}</span>
                      <span className="block text-[13.5px] text-muted">
                        {[formatDate(payment.paidAt, locale), t.methods[payment.method], payment.receiptNo !== null && t.receiptNo(n(payment.receiptNo))]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {payment.status !== "verified" && <span className={STATUS_BADGE[payment.status]}>{t.statuses[payment.status]}</span>}
                    <b className={`font-num text-[19px] ${payment.status === "rejected" || payment.status === "failed" ? "text-muted line-through" : "text-ink"}`}>
                      {formatTaka(payment.amount, locale)}
                    </b>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "dues" &&
        (dues.length === 0 ? (
          <div className="empty">
            <span className="empty-icon" aria-hidden="true">
              <BadgeCheck />
            </span>
            <p className="empty-text">{t.duesEmpty}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[16px] font-semibold text-ink">
                {t.duesTotal(formatTaka(dues.reduce((sum, due) => sum + due.amount, 0), locale), n(new Set(dues.map((due) => due.studentId)).size))}
              </p>
              <span data-print-hide>
                <QbPrintButton label={t.print} className="btn btn-ghost btn-sm" />
              </span>
            </div>
            <ul className="card divide-y divide-line">
              {dues.map((due) => (
                <li key={due.enrollmentId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                  <span className="min-w-0 flex-1">
                    <b className="block font-semibold text-ink">
                      <Link href={`/dashboard/students/${due.studentId}`}>{due.studentName}</Link>
                    </b>
                    <span className="block text-[14px] text-ink-2">
                      {[due.courseTitle, due.batchName, due.roll && `${d.dashboard.requests.roll} ${n(Number(due.roll))}`, due.studentPhone].filter(Boolean).join(" · ")}
                    </span>
                    <span className="block text-[13.5px] text-muted">{due.periods.map((period) => periodName(period, d, locale, true)).join(", ")}</span>
                  </span>
                  <b className="font-num text-[19px] text-bad">{formatTaka(due.amount, locale)}</b>
                  <Link href={`/dashboard/payments/new?e=${due.enrollmentId}`} className="btn btn-soft btn-xs" data-print-hide>
                    {t.record}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ))}
    </main>
  );
}
