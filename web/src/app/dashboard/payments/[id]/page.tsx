import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PendingButton } from "@/components/form";
import { QbPrintButton } from "@/components/qbank/auto-print";
import { Receipt } from "@/components/receipt";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { getPayment } from "@/server/payments";
import { cancelPaymentAction } from "../actions";

export const instant = false;

export const metadata: Metadata = { title: "রসিদ" };

/** One payment as its receipt, to print; and, for a mistake, cancelling it. */
export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const payment = await getPayment(await getDb(), teacher.id, id);
  if (!payment) notFound();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.payments;

  return (
    <main className="dash-content">
      <div className="mx-auto flex w-full max-w-[640px] flex-wrap items-center justify-between gap-3" data-print-hide>
        <Link href="/dashboard/payments?tab=all" className="link text-[15px]">
          <ArrowLeft aria-hidden="true" />
          {t.back}
        </Link>
        {payment.status === "verified" && <QbPrintButton label={t.print} className="btn btn-primary btn-sm" />}
      </div>
      <h1 className="sr-only">{t.receipt}</h1>
      <Receipt
        payment={payment}
        teacherName={locale === "bn" ? teacher.nameBn : teacher.nameEn}
        teacherLine={[teacher.subjects, teacher.site.contact?.address].filter(Boolean).join(" · ")}
        d={d}
        locale={locale}
      />
      {(payment.status === "verified" || payment.status === "pending") && (
        <form action={cancelPaymentAction} className="mx-auto flex w-full max-w-[640px] flex-wrap items-center gap-2" data-print-hide>
          <input type="hidden" name="paymentId" value={payment.id} />
          <input type="hidden" name="then" value="list" />
          <input name="note" className="input !h-10 min-w-0 flex-1 text-[15px]" placeholder={t.rejectNote} aria-label={t.rejectNote} maxLength={200} />
          <PendingButton className="btn btn-danger btn-sm">{t.cancel}</PendingButton>
        </form>
      )}
    </main>
  );
}
