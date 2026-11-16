import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { QbPrintButton } from "@/components/qbank/auto-print";
import { Receipt } from "@/components/receipt";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getCurrentStudent } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { getPayment } from "@/server/payments";
import { getSite } from "../../../data";

export const instant = false;

export const metadata: Metadata = { robots: { index: false } };

/** A verified payment's receipt, for the student who made it (anyone else's simply isn't found). */
export default async function StudentReceiptPage({ params }: { params: Promise<{ handle: string; id: string }> }) {
  const { handle, id } = await params;
  const site = await getSite(handle.toLowerCase());
  if (!site) notFound();
  const teacher = site.teacher;
  const student = await getCurrentStudent(teacher.id);
  if (!student) redirect(`/${teacher.handle}/login`);
  const payment = await getPayment(await getDb(), teacher.id, id, student.id);
  if (!payment || payment.status !== "verified") notFound();
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);

  return (
    <main className="section">
      <div className="wrap flex max-w-[720px] flex-col gap-5">
        <div className="mx-auto flex w-full max-w-[640px] flex-wrap items-center justify-between gap-3" data-print-hide>
          <Link href={`/${teacher.handle}/me`} className="link text-[15px]">
            <ArrowLeft aria-hidden="true" />
            {d.site.student.backToMe}
          </Link>
          <QbPrintButton label={d.dashboard.payments.print} className="btn btn-primary btn-sm" />
        </div>
        <h1 className="sr-only">{d.site.student.receipt}</h1>
        <Receipt
          payment={payment}
          teacherName={locale === "bn" ? teacher.nameBn : teacher.nameEn}
          teacherLine={[teacher.subjects, teacher.site.contact?.address].filter(Boolean).join(" · ")}
          d={d}
          locale={locale}
        />
      </div>
    </main>
  );
}
