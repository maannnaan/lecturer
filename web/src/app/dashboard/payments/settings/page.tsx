import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatDateTime, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { secretsReady } from "@/server/crypto";
import { getDb } from "@/server/db";
import { getGatewayView } from "@/server/gateway";
import { GatewayForm, PaymentInfoForm, RemoveGatewayForm } from "../payment-forms";

export const instant = false;

export const metadata: Metadata = { title: "পেমেন্টের নম্বর" };

/** How the teacher's students pay: the numbers they send money to, and (optionally) the teacher's own bKash gateway. */
export default async function PaymentSettingsPage() {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.payments;
  const g = t.gateway;
  const gateway = await getGatewayView(await getDb(), teacher.id);
  const ready = secretsReady();

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

      <section className="card flex flex-col gap-4 p-5" aria-labelledby="gateway-title">
        <div>
          <h2 id="gateway-title" className="panel-title">
            {g.title}
          </h2>
          <p className="panel-lead">{g.lead}</p>
        </div>
        {!ready ? (
          <p className="form-alert">{g.notReady}</p>
        ) : (
          <>
            <p className={gateway?.enabled ? "form-ok" : "text-[15px] text-ink-2"} role="status">
              {gateway?.enabled && gateway.verifiedAt ? g.connected(formatDateTime(gateway.verifiedAt, locale)) : gateway ? g.notConnected : g.off}
            </p>
            <GatewayForm
              saved={gateway ? { mode: gateway.mode, username: gateway.username, appKey: gateway.appKey } : null}
              t={{
                mode: g.mode,
                sandbox: g.sandbox,
                live: g.live,
                username: g.username,
                password: g.password,
                appKey: g.appKey,
                appSecret: g.appSecret,
                keepSaved: g.keepSaved,
                save: g.save,
                testing: g.testing,
                ok: g.ok,
              }}
            />
            <p className="field-hint">{g.limitNote}</p>
            {gateway && (
              <div className="flex flex-col items-start gap-2 border-t border-line pt-4">
                <p className="text-[15px] text-ink-2">{g.removeLead}</p>
                <RemoveGatewayForm label={g.remove} />
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
