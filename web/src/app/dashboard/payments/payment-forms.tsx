"use client";

import { useActionState } from "react";
import { Field, FormMessages, SelectField, SubmitButton, TextAreaField, emptyForm } from "@/components/form";
import { type PeriodOption, PeriodFields } from "@/components/period-fields";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payments";
import { recordPaymentAction, savePaymentInfoAction } from "./actions";

// The dashboard's payment forms. Their text arrives as plain strings (the dictionaries hold
// functions too, which can't be handed to the browser).

type Common = { save: string; saving: string; saved: string; optional: string };

export type RecordText = {
  months: string;
  amount: string;
  amountHint: string;
  method: string;
  methods: Record<PaymentMethod, string>;
  txn: string;
  sender: string;
  paidOn: string;
  paidOnHint: string;
  note: string;
  save: string;
};

/** Writes down a payment for one student's place in a course: the months, the amount, how it came. */
export function RecordPaymentForm({
  studentId,
  enrollmentId,
  options,
  fee,
  taka,
  t,
  c,
}: {
  studentId: string;
  enrollmentId: string;
  options: PeriodOption[];
  fee: number;
  taka: string[];
  t: RecordText;
  c: Common;
}) {
  const [state, action] = useActionState(recordPaymentAction, emptyForm);
  const v = (name: string) => state.values?.[name] ?? "";
  const e = state.errors;
  return (
    <form action={action} className="card flex flex-col gap-5 p-5" noValidate>
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <PeriodFields options={options} fee={fee} legend={t.months} error={e.months} amountLabel={t.amount} amountHint={t.amountHint} amountError={e.amount} editable taka={taka} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="method" label={t.method} defaultValue={v("method") || "cash"} options={PAYMENT_METHODS.map((m) => ({ value: m, label: t.methods[m] }))} />
        <Field name="paidOn" type="date" label={t.paidOn} labelNote={c.optional} hint={t.paidOnHint} defaultValue={v("paidOn")} />
        <Field name="txnId" label={t.txn} labelNote={c.optional} defaultValue={v("txnId")} error={e.txnId} autoCapitalize="characters" />
        <Field name="senderNumber" label={t.sender} labelNote={c.optional} defaultValue={v("senderNumber")} inputMode="tel" />
      </div>
      <TextAreaField name="note" label={t.note} labelNote={c.optional} rows={2} defaultValue={v("note")} error={e.note} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary" pendingLabel={c.saving}>
          {t.save}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}

export type InfoText = {
  bkash: string;
  nagad: string;
  rocket: string;
  bank: string;
  bankPlaceholder: string;
  instructions: string;
  instructionsPlaceholder: string;
};

/** Where students send money: the teacher's own numbers, and a word of instruction. */
export function PaymentInfoForm({ saved, t, c }: { saved: Partial<Record<"bkash" | "nagad" | "rocket" | "bank" | "instructions", string>>; t: InfoText; c: Common }) {
  const [state, action] = useActionState(savePaymentInfoAction, emptyForm);
  const v = (name: keyof typeof saved) => state.values?.[name] ?? saved[name] ?? "";
  const e = state.errors;
  return (
    <form action={action} className="card flex flex-col gap-5 p-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="bkash" label={t.bkash} labelNote={c.optional} defaultValue={v("bkash")} error={e.bkash} inputMode="tel" placeholder="01XXXXXXXXX" />
        <Field name="nagad" label={t.nagad} labelNote={c.optional} defaultValue={v("nagad")} error={e.nagad} inputMode="tel" placeholder="01XXXXXXXXX" />
        <Field name="rocket" label={t.rocket} labelNote={c.optional} defaultValue={v("rocket")} error={e.rocket} inputMode="tel" placeholder="01XXXXXXXXXX" />
      </div>
      <Field name="bank" label={t.bank} labelNote={c.optional} defaultValue={v("bank")} error={e.bank} placeholder={t.bankPlaceholder} />
      <TextAreaField
        name="instructions"
        label={t.instructions}
        labelNote={c.optional}
        rows={3}
        defaultValue={v("instructions")}
        error={e.instructions}
        placeholder={t.instructionsPlaceholder}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary" pendingLabel={c.saving}>
          {c.save}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}
