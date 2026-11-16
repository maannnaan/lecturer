import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import { periodName } from "@/components/receipt";
import { formatNumber, formatTaka, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { MAX_PERIODS } from "@/lib/payments";
import { requireTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { listDues } from "@/server/payments";
import { RecordPaymentForm } from "../payment-forms";

export const instant = false;

export const metadata: Metadata = { title: "পেমেন্ট নিন" };

/**
 * The teacher writes down a payment: first whose and for which course (`?e=<enrolment>`, as the
 * dues list and a student's page link here), then the months and the amount.
 */
export default async function NewPaymentPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.payments;
  const f = t.form;
  const places = await listDues(await getDb(), teacher.id, { all: true });
  const { e: asked } = await searchParams;
  const place = places.find((p) => p.enrollmentId === asked);
  const n = (value: number) => formatNumber(value, locale);

  return (
    <main className="dash-content max-w-[860px]">
      <Link href="/dashboard/payments" className="link text-[15px]">
        <ArrowLeft aria-hidden="true" />
        {t.back}
      </Link>
      <header>
        <h1 className="page-title">{f.title}</h1>
        <p className="page-lead">{f.lead}</p>
      </header>

      {places.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">
            <Wallet />
          </span>
          <p className="empty-text">{f.noStudents}</p>
          <Link href="/dashboard/students" className="btn btn-primary">
            {d.dashboard.nav.students}
          </Link>
        </div>
      ) : (
        <>
          <form className="card flex flex-wrap items-end gap-3 p-4">
            <div className="field min-w-0 flex-1">
              <label className="field-label" htmlFor="e">
                {f.student}
              </label>
              <select id="e" name="e" className="input" defaultValue={place?.enrollmentId ?? ""} required>
                <option value="" disabled>
                  {f.pick}
                </option>
                {places.map((p) => (
                  <option key={p.enrollmentId} value={p.enrollmentId}>
                    {[p.studentName, p.courseTitle, p.roll && `${d.dashboard.requests.roll} ${n(Number(p.roll))}`].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-ghost">
              {f.go}
            </button>
          </form>

          {place &&
            (place.payable.length === 0 ? (
              <p className="card p-5 text-ink-2">{f.nothingToPay}</p>
            ) : (
              <RecordPaymentForm
                // A fresh form for each student and course.
                key={place.enrollmentId}
                studentId={place.studentId}
                enrollmentId={place.enrollmentId}
                fee={place.fee}
                options={place.payable.map((period) => {
                  const due = place.periods.includes(period);
                  return { value: period, label: periodName(period, d, locale), tag: due ? f.due : f.ahead, due };
                })}
                taka={Array.from({ length: MAX_PERIODS + 1 }, (_, count) => formatTaka(count * place.fee, locale))}
                t={{
                  months: f.months,
                  amount: f.amount,
                  amountHint: f.amountHint,
                  method: f.method,
                  methods: t.methods,
                  txn: f.txnOptional,
                  sender: t.sender,
                  paidOn: f.paidOn,
                  paidOnHint: f.paidOnHint,
                  note: f.note,
                  save: f.save,
                }}
                c={d.common}
              />
            ))}
        </>
      )}
    </main>
  );
}
