"use client";

import { useActionState } from "react";
import { Field, FormMessages, SelectField, SubmitButton, TextAreaField, emptyForm } from "@/components/form";
import { type PeriodOption, PeriodFields } from "@/components/period-fields";
import { applyAction, changePasswordAction, claimPaymentAction, joinAction, loginStudentAction, startGatewayPaymentAction } from "./student-actions";

// The forms of a student's account on a teacher's site. Their text arrives as plain strings: the
// dictionaries hold functions too, which can't be handed to the browser.

export type JoinText = {
  name: string;
  phone: string;
  password: string;
  passwordHint: string;
  institution: string;
  classLevel: string;
  classPlaceholder: string;
  guardianName: string;
  guardianPhone: string;
  join: string;
  working: string;
  optional: string;
};

/** Sign-up: who the student is, and a password. `next` is where to land afterwards. */
export function JoinForm({ handle, next, t }: { handle: string; next?: string; t: JoinText }) {
  const [state, action] = useActionState(joinAction, emptyForm);
  const v = (name: string) => state.values?.[name] ?? "";
  const e = state.errors;
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="handle" value={handle} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field name="name" label={t.name} defaultValue={v("name")} error={e.name} autoComplete="name" required />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="phone" label={t.phone} defaultValue={v("phone")} error={e.phone} inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" required />
        <Field name="password" type="password" label={t.password} hint={t.passwordHint} error={e.password} autoComplete="new-password" required />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="institution" label={t.institution} labelNote={t.optional} defaultValue={v("institution")} error={e.institution} />
        <Field name="classLevel" label={t.classLevel} labelNote={t.optional} placeholder={t.classPlaceholder} defaultValue={v("classLevel")} error={e.classLevel} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="guardianName" label={t.guardianName} labelNote={t.optional} defaultValue={v("guardianName")} error={e.guardianName} />
        <Field
          name="guardianPhone"
          label={t.guardianPhone}
          labelNote={t.optional}
          defaultValue={v("guardianPhone")}
          error={e.guardianPhone}
          inputMode="tel"
          placeholder="01XXXXXXXXX"
        />
      </div>
      <FormMessages state={state} saved="" />
      <SubmitButton pendingLabel={t.working}>{t.join}</SubmitButton>
    </form>
  );
}

export type LoginText = { phone: string; password: string; loginButton: string; working: string };

export function StudentLoginForm({ handle, next, t }: { handle: string; next?: string; t: LoginText }) {
  const [state, action] = useActionState(loginStudentAction, emptyForm);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="handle" value={handle} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field name="phone" label={t.phone} defaultValue={state.values?.phone ?? ""} inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" required />
      <Field name="password" type="password" label={t.password} autoComplete="current-password" required />
      <FormMessages state={state} saved="" />
      <SubmitButton pendingLabel={t.working}>{t.loginButton}</SubmitButton>
    </form>
  );
}

export type ApplyText = { apply: string; working: string; pickBatch: string; anyBatch: string; noteLabel: string; optional: string; applied: string };

/** "I want to join": the batch to join (when the course has open ones) and a word for the teacher. */
export function ApplyForm({
  handle,
  courseId,
  batches,
  withNote,
  t,
}: {
  handle: string;
  courseId: string;
  batches: { id: string; label: string }[];
  /** A free course lets the student straight in, so there is nobody to write to. */
  withNote: boolean;
  t: ApplyText;
}) {
  const [state, action] = useActionState(applyAction, emptyForm);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="handle" value={handle} />
      <input type="hidden" name="courseId" value={courseId} />
      {batches.length > 0 && (
        <SelectField
          name="batchId"
          label={t.pickBatch}
          defaultValue=""
          options={[{ value: "", label: t.anyBatch }, ...batches.map((batch) => ({ value: batch.id, label: batch.label }))]}
        />
      )}
      {withNote && <TextAreaField name="note" label={t.noteLabel} labelNote={t.optional} rows={2} maxLength={500} />}
      <FormMessages state={state} saved={t.applied} />
      <SubmitButton className="btn btn-primary self-start" pendingLabel={t.working}>
        {t.apply}
      </SubmitButton>
    </form>
  );
}

export type PayText = { months: string; total: string; method: string; txn: string; txnHint: string; sender: string; optional: string; submit: string; working: string };

/**
 * A student reports money they sent: which months, by which way, and its transaction id. The total
 * shown is only for them to read; the server works the amount out itself.
 */
export function PayForm({
  handle,
  enrollmentId,
  options,
  fee,
  taka,
  methods,
  t,
}: {
  handle: string;
  enrollmentId: string;
  options: PeriodOption[];
  fee: number;
  taka: string[];
  /** The ways the teacher takes money, each with its name. */
  methods: { value: string; label: string }[];
  t: PayText;
}) {
  const [state, action] = useActionState(claimPaymentAction, emptyForm);
  const v = (name: string) => state.values?.[name] ?? "";
  const e = state.errors;
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="handle" value={handle} />
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <PeriodFields options={options} fee={fee} legend={t.months} error={e.months} amountLabel={t.total} editable={false} taka={taka} />
      <SelectField name="method" label={t.method} defaultValue={v("method") || methods[0]?.value || ""} error={e.method} options={methods} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="txnId" label={t.txn} hint={t.txnHint} defaultValue={v("txnId")} error={e.txnId} autoCapitalize="characters" autoComplete="off" required />
        <Field name="senderNumber" label={t.sender} labelNote={t.optional} defaultValue={v("senderNumber")} error={e.senderNumber} inputMode="tel" placeholder="01XXXXXXXXX" />
      </div>
      <FormMessages state={state} saved="" />
      <SubmitButton pendingLabel={t.working}>{t.submit}</SubmitButton>
    </form>
  );
}

export type GatewayPayText = { months: string; total: string; submit: string; working: string };

/**
 * A student pays through bKash: they tick the months, then go to bKash's own page to pay. Nothing
 * to type and nothing for the teacher to check; it confirms itself when they come back.
 */
export function GatewayPayForm({
  handle,
  enrollmentId,
  options,
  fee,
  taka,
  t,
}: {
  handle: string;
  enrollmentId: string;
  options: PeriodOption[];
  fee: number;
  taka: string[];
  t: GatewayPayText;
}) {
  const [state, action] = useActionState(startGatewayPaymentAction, emptyForm);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="handle" value={handle} />
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <PeriodFields options={options} fee={fee} legend={t.months} error={state.errors.months} amountLabel={t.total} editable={false} taka={taka} />
      <FormMessages state={state} saved="" />
      <SubmitButton className="btn btn-bkash self-start" pendingLabel={t.working}>
        {t.submit}
      </SubmitButton>
    </form>
  );
}

export type PasswordText ={ currentPassword: string; newPassword: string; passwordHint: string; changePassword: string; working: string; saved: string };

export function ChangePasswordForm({ handle, t }: { handle: string; t: PasswordText }) {
  const [state, action] = useActionState(changePasswordAction, emptyForm);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="handle" value={handle} />
      <Field name="currentPassword" type="password" label={t.currentPassword} error={state.errors.currentPassword} autoComplete="current-password" required />
      <Field name="newPassword" type="password" label={t.newPassword} hint={t.passwordHint} error={state.errors.newPassword} autoComplete="new-password" required />
      <FormMessages state={state} saved={t.saved} />
      <SubmitButton className="btn btn-ghost self-start" pendingLabel={t.working}>
        {t.changePassword}
      </SubmitButton>
    </form>
  );
}
