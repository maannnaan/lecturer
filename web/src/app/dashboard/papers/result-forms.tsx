"use client";

import { useActionState, useEffect, useState } from "react";
import { Field, SelectField, SubmitButton, emptyForm } from "@/components/form";
import { parseAnswers } from "@/lib/omr";
import { saveResultAction } from "./actions";

export type ResultEntryText = {
  roll: string;
  setCode: string;
  answers: string;
  answersHint: string;
  /** "{typed} … {total}": how many answers are typed, of how many questions. */
  answersCount: string;
  written: string;
  optional: string;
  save: string;
  saving: string;
};

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/**
 * Typing in answer sheets one after another: the roll, the set and the answers. After each one
 * the form is empty again (keeping the set), the cursor is back on the roll, and a line says
 * whose sheet it was and what it scored.
 */
export function ResultEntryForm({
  paperId,
  codes,
  mcqCount,
  hasWritten,
  bangla,
  t,
}: {
  paperId: string;
  codes: { value: string; label: string }[];
  mcqCount: number;
  hasWritten: boolean;
  /** Whether numbers show in Bangla digits. */
  bangla: boolean;
  t: ResultEntryText;
}) {
  const [state, action] = useActionState(saveResultAction, emptyForm);
  const [setCode, setSetCode] = useState(codes[0]?.value ?? "");
  const [typed, setTyped] = useState(0);
  // A refused sheet comes back as it was typed; a saved one leaves the form empty for the next.
  const kept = state.ok ? undefined : state.values;
  const [answered, setAnswered] = useState(state);
  if (answered !== state) {
    setAnswered(state);
    if (state.ok) setTyped(0);
  }
  useEffect(() => {
    if (state.ok) document.getElementById("roll")?.focus();
  }, [state]);
  const digits = (value: number) => (bangla ? String(value).replace(/\d/g, (c) => BANGLA_DIGITS[Number(c)]) : String(value));
  const e = state.errors;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="paperId" value={paperId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="roll" label={t.roll} inputMode="numeric" autoComplete="off" defaultValue={kept?.roll ?? ""} error={e.roll} required />
        {mcqCount > 0 ? (
          <SelectField name="setCode" label={t.setCode} defaultValue={setCode} onChange={(event) => setSetCode(event.target.value)} error={e.setCode} options={codes} />
        ) : (
          <input type="hidden" name="setCode" value={codes[0]?.value ?? ""} />
        )}
      </div>
      {mcqCount > 0 && (
        <div className="flex flex-col gap-1">
          <Field
            name="answers"
            label={t.answers}
            hint={t.answersHint}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            defaultValue={kept?.answers ?? ""}
            error={e.answers}
            onChange={(event) => setTyped(parseAnswers(event.target.value)?.length ?? 0)}
          />
          <p className={`text-[14px] font-semibold ${typed > mcqCount ? "text-bad" : typed === mcqCount ? "text-ok" : "text-muted"}`} aria-live="polite">
            {t.answersCount.replace("{typed}", digits(typed)).replace("{total}", digits(mcqCount))}
          </p>
        </div>
      )}
      {hasWritten && <Field name="written" label={t.written} labelNote={t.optional} inputMode="decimal" defaultValue={kept?.written ?? ""} error={e.written} />}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary" pendingLabel={t.saving}>
          {t.save}
        </SubmitButton>
        {state.formError && (
          <p className="form-alert" role="alert">
            {state.formError}
          </p>
        )}
        {state.ok && state.values?.line && (
          <p className="form-ok" role="status">
            {state.values.line}
          </p>
        )}
      </div>
    </form>
  );
}
