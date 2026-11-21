"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { formatDateTime, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { formInput } from "@/lib/form-input";
import { parseGateway, parsePayment, parsePaymentInfo } from "@/lib/payments";
import { requireTeacher } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { getGatewayView, removeGateway, saveGateway } from "@/server/gateway";
import { cancelPayment, recordPayment, setPaymentInfo, verifyPayment } from "@/server/payments";
import { errorTexts, refused } from "../form-state";

/**
 * The teacher's bKash merchant account: saved, then tried with bKash at once. The password and
 * app secret never go back to the browser, not even when the form is refused.
 */
export async function saveGatewayAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const typed = { ...input, password: "", appSecret: "" };
  const db = await getDb();
  const saved = await getGatewayView(db, teacher.id);
  const { gateway, errors } = parseGateway(input, saved !== null);
  const refusal = await refused(errors, typed);
  if (refusal) return refusal;

  const result = await saveGateway(db, teacher.id, gateway);
  refresh();
  if (result.ok) return { ok: true, errors: {} };
  const locale = await getLocale();
  const t = getDictionary(locale).dashboard.payments.gateway;
  const message = {
    secrets: t.notReady,
    missing: t.retype,
    rate: t.rate(result.retryAt ? formatDateTime(result.retryAt, locale) : ""),
    bkash: t.refused(result.message ?? ""),
  }[result.reason];
  return { errors: {}, formError: message, values: Object.fromEntries(Object.entries(typed).map(([k, v]) => [k, v ?? ""])) };
}

/** Takes the teacher's bKash account away: students go back to sending money and reporting it. */
export async function removeGatewayAction() {
  const teacher = await requireTeacher();
  await removeGateway(await getDb(), teacher.id);
  refresh();
}

// Payments. Each action re-reads the session and passes the teacher's own id down: the data layer
// then refuses a student, enrolment or payment that isn't theirs.

/** The teacher writes down a payment they have in hand; it is verified as saved, and its receipt opens. */
export async function recordPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { payment, errors } = parsePayment(input);
  if (payment.enrollmentId && payment.periods.length === 0 && !errors.months) errors.months = "pickMonths";
  const refusal = await refused(errors, input);
  if (refusal) return refusal;

  const result = await recordPayment(await getDb(), teacher.id, String(input.studentId ?? ""), payment);
  if (!result.ok) {
    if (result.reason === "periodsTaken") return (await refused({ months: "periodsTaken" }, input))!;
    if (result.reason === "periods") return (await refused({ months: "pickMonths" }, input))!;
    if (result.reason === "txnTaken") return (await refused({ txnId: "txnTaken" }, input))!;
    return { errors: {}, formError: (await errorTexts()).generic, values: Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v ?? ""])) };
  }
  redirect(`/dashboard/payments/${result.payment.id}`);
}

/** The teacher has matched a student's claim against their own phone. */
export async function verifyPaymentAction(formData: FormData) {
  const teacher = await requireTeacher();
  await verifyPayment(await getDb(), teacher.id, String(formData.get("paymentId") ?? ""));
  refresh();
}

/** Turns a claim down, or cancels a payment written down by mistake; the months are owed again. */
export async function cancelPaymentAction(formData: FormData) {
  const teacher = await requireTeacher();
  await cancelPayment(await getDb(), teacher.id, String(formData.get("paymentId") ?? ""), String(formData.get("note") ?? "").trim());
  if (formData.get("then") === "list") redirect("/dashboard/payments?tab=all");
  refresh();
}

/** Where students send money. */
export async function savePaymentInfoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const teacher = await requireTeacher();
  const input = formInput(formData);
  const { info, errors } = parsePaymentInfo(input);
  const refusal = await refused(errors, input);
  if (refusal) return refusal;
  await setPaymentInfo(await getDb(), teacher.id, info);
  refresh();
  return { ok: true, errors: {} };
}
