import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { PaymentInfoForm } from "../payment-forms";

export const instant = false;

export const metadata: Metadata = { title: "পেমেন্টের নম্বর" };

/** Where the teacher's students send money: shown on each student's payment page. */
export default async function PaymentSettingsPage() {
  const teacher = await requireTeacher();
  const d = getDictionary(await getLocale());
  const t = d.dashboard.payments;
  return (
    <main className="dash-content max-w-[860px]">
      <Link href="/dashboard/payments" className="link text-[15px]">
        <ArrowLeft aria-hidden="true" />
        {t.back}
      </Link>
      <header>
        <h1 className="page-title">{t.info.title}</h1>
        <p className="page-lead">{t.info.lead}</p>
      </header>
      <PaymentInfoForm saved={teacher.paymentInfo} t={t.info} c={d.common} />
    </main>
  );
}
