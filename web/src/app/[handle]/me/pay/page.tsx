import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { periodName } from "@/components/receipt";
import { formatTaka, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { CLAIM_METHODS, MAX_PERIODS } from "@/lib/payments";
import { getCurrentStudent } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { gatewayOpen } from "@/server/gateway";
import { listDues } from "@/server/payments";
import { getSite } from "../../data";
import { GatewayPayForm, PayForm } from "../../student-forms";

export const instant = false;

export const metadata: Metadata = { robots: { index: false } };

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<{ e?: string; bkash?: string }> };

/**
 * The signed-in student pays: straight through bKash when the teacher has set it up (it confirms
 * itself), or by sending money to the teacher's numbers and reporting the transaction id.
 */
export default async function PayPage({ params, searchParams }: Props) {
  const site = await getSite((await params).handle.toLowerCase());
  if (!site) notFound();
  const teacher = site.teacher;
  const student = await getCurrentStudent(teacher.id);
  if (!student) redirect(`/${teacher.handle}/login`);
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);
  const t = d.site.student;
  const p = d.dashboard.payments;
  const home = `/${teacher.handle}`;
  const db = await getDb();

  // The student's own places that have something to pay for, now or ahead.
  const [dues, gateway] = await Promise.all([listDues(db, teacher.id, { studentId: student.id, all: true }), gatewayOpen(db, teacher.id)]);
  const places = dues.filter((place) => place.payable.length > 0);
  const { e: asked, bkash } = await searchParams;
  const place = places.find((x) => x.enrollmentId === asked) ?? places[0];
  const info = teacher.paymentInfo;
  const methods = CLAIM_METHODS.filter((method) => info[method]).map((method) => ({ value: method, label: p.methods[method] }));
  const options = place?.payable.map((period) => {
    const due = place.periods.includes(period);
    return { value: period, label: periodName(period, d, locale), tag: due ? p.form.due : p.form.ahead, due };
  });
  const taka = place ? Array.from({ length: MAX_PERIODS + 1 }, (_, count) => formatTaka(count * place.fee, locale)) : [];

  return (
    <main className="section">
      <div className="wrap flex max-w-[720px] flex-col gap-6">
        <Link href={`${home}/me`} className="link text-[15px]">
          <ArrowLeft aria-hidden="true" />
          {t.backToMe}
        </Link>
        <header>
          <h1 className="text-[clamp(26px,4vw,36px)]">{t.payTitle}</h1>
          <p className="mt-2 text-ink-2">{gateway ? t.payLeadBkash : t.payLead}</p>
        </header>
        {(bkash === "cancelled" || bkash === "failed") && (
          <p className="form-alert" role="alert">
            {bkash === "cancelled" ? t.bkashCancelled : t.bkashFailed}
          </p>
        )}

        {!gateway && methods.length === 0 ? (
          <p className="card p-6 text-ink-2">{t.noPayInfo}</p>
        ) : !place || !options ? (
          <p className="card p-6 text-ink-2">{t.nothingToPay}</p>
        ) : (
          <>
            <div>
              <h2 className="text-xl">{place.courseTitle}</h2>
              <p className="text-[14.5px] text-muted">{formatTaka(place.fee, locale)}</p>
              {places.length > 1 && (
                <nav className="mt-3 flex flex-wrap gap-2" aria-label={t.payCourse}>
                  {places.map((x) => (
                    <Link key={x.enrollmentId} href={`${home}/me/pay?e=${x.enrollmentId}`} className="chip" aria-current={x.enrollmentId === place.enrollmentId ? "true" : undefined}>
                      {x.courseTitle}
                    </Link>
                  ))}
                </nav>
              )}
            </div>

            {gateway && (
              <section className="card flex flex-col gap-4 p-5 sm:p-6" aria-labelledby="pay-bkash">
                <div>
                  <h2 id="pay-bkash" className="text-xl">
                    {t.bkashTitle}
                  </h2>
                  <p className="mt-1 text-[15px] text-ink-2">{t.bkashLead}</p>
                </div>
                <GatewayPayForm
                  key={`bkash-${place.enrollmentId}`}
                  handle={teacher.handle}
                  enrollmentId={place.enrollmentId}
                  fee={place.fee}
                  options={options}
                  taka={taka}
                  t={{ months: t.payMonths, total: t.total, submit: t.bkashPay, working: t.bkashGoing }}
                />
              </section>
            )}

            {methods.length > 0 && (
              <>
                <section className="card p-5 sm:p-6" aria-labelledby="send-to">
                  <h2 id="send-to" className="text-xl">
                    {gateway ? t.orSendTo : t.sendTo}
                  </h2>
                  <dl className="mt-3 flex flex-col">
                    {methods.map((method) => (
                      <div key={method.value} className="flex flex-wrap justify-between gap-x-6 gap-y-1 border-t border-line py-3 text-[16px] first:border-t-0">
                        <dt className="text-ink-2">{method.label}</dt>
                        <dd className="font-num text-[18px] font-bold break-all text-ink">{info[method.value]}</dd>
                      </div>
                    ))}
                  </dl>
                  {info.instructions && <p className="mt-3 rounded-md bg-surface-2 p-3 text-[15px] whitespace-pre-line text-ink-2">{info.instructions}</p>}
                </section>

                <section className="card flex flex-col gap-5 p-5 sm:p-6" aria-labelledby="pay-form">
                  <h2 id="pay-form" className="text-xl">
                    {t.reportSent}
                  </h2>
                  <PayForm
                    // A fresh form for each course.
                    key={place.enrollmentId}
                    handle={teacher.handle}
                    enrollmentId={place.enrollmentId}
                    fee={place.fee}
                    options={options}
                    taka={taka}
                    methods={methods}
                    t={{
                      months: t.payMonths,
                      total: t.total,
                      method: t.payMethod,
                      txn: t.txn,
                      txnHint: t.txnHint,
                      sender: t.sender,
                      optional: d.common.optional,
                      submit: t.submitPay,
                      working: t.working,
                    }}
                  />
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
