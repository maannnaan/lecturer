import { type Dictionary, type Locale, formatDate, formatMonth, formatNumber, formatTaka } from "@/i18n";
import { ONCE } from "@/lib/dues";
import type { PaymentRow } from "@/server/payments";

/** A period as people read it: "নভেম্বর ২০২৬", or "পুরো কোর্সের ফি" for a course paid in one go. */
export function periodName(period: string, d: Dictionary, locale: Locale, short = false): string {
  return period === ONCE ? d.dashboard.payments.once : formatMonth(period, locale, short);
}

/** What a payment was for, in a line: its course and the periods it covers, or "other". */
export function paymentFor(payment: Pick<PaymentRow, "courseTitle" | "periods">, d: Dictionary, locale: Locale): string {
  const periods = payment.periods.map((period) => periodName(period, d, locale)).join(", ");
  return [payment.courseTitle, periods].filter(Boolean).join(" · ") || d.dashboard.payments.other;
}

/**
 * A verified payment's receipt, to read or print: who received it, from whom, for what, how much.
 * The same sheet for the teacher's copy and the student's.
 */
export function Receipt({ payment, teacherName, teacherLine, d, locale }: { payment: PaymentRow; teacherName: string; teacherLine: string; d: Dictionary; locale: Locale }) {
  const t = d.dashboard.payments;
  const r = t.receiptPage;
  const rows: [string, string][] = [
    [r.from, `${payment.studentName} · ${payment.studentPhone}`],
    [r.for, paymentFor(payment, d, locale)],
    [r.method, [t.methods[payment.method], payment.txnId && `${t.txn}: ${payment.txnId}`].filter(Boolean).join(" · ")],
    [r.date, formatDate(payment.paidAt, locale)],
  ];
  return (
    <article data-print-sheet className="card mx-auto w-full max-w-[640px] p-7 print:max-w-none print:border-0 print:p-0 sm:p-9">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-4">
        <div className="min-w-0">
          <p className="font-head text-[22px] leading-tight font-bold text-ink">{teacherName}</p>
          {teacherLine && <p className="text-[14.5px] text-ink-2">{teacherLine}</p>}
        </div>
        <div className="text-right">
          <p className="text-[13px] font-semibold tracking-[0.04em] text-muted uppercase">{r.title}</p>
          {payment.receiptNo !== null && <p className="font-num text-[19px] font-bold text-ink">{t.receiptNo(formatNumber(payment.receiptNo, locale))}</p>}
        </div>
      </header>
      <dl className="mt-2 flex flex-col">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-6 border-b border-line py-3 text-[15.5px]">
            <dt className="text-muted">{label}</dt>
            <dd className="min-w-0 text-right font-medium break-words text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex items-baseline justify-between gap-6 rounded-md bg-surface-2 px-5 py-4">
        <span className="text-[15.5px] text-ink-2">{r.amount}</span>
        <b className="font-num text-[28px] text-ink">{formatTaka(payment.amount, locale)}</b>
      </div>
      {payment.status !== "verified" && <p className="form-alert mt-4">{t.statuses[payment.status]}{payment.note && `: ${payment.note}`}</p>}
      <p className="mt-12 ml-auto w-48 border-t border-line-strong pt-2 text-center text-[13.5px] text-muted">{r.signature}</p>
    </article>
  );
}
