"use client";

import { type ReactNode, useActionState } from "react";
import { type FormState, SubmitButton, emptyForm } from "@/components/form";

// Choosing bank questions for an exam or a paper: a chapter's questions to tick and add, or a
// number of them at random. The action is the exam's or the paper's own; `hidden` carries what it
// needs (whose questions these are, and the chapter and tab to pick at random from).

export type QuestionPickerText = {
  pickHint: string;
  add: string;
  /** Instead of the tags, for a question that is already in. */
  already: string;
  /** With no questions to show. */
  none: string;
  randomCount: string;
  addRandom: string;
  saving: string;
};

export function QuestionPicker({
  action,
  hidden,
  items,
  t,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
  /** The questions; `stem` already drawn on the server. */
  items: { id: string; stem: ReactNode; tags: string; added: boolean }[];
  t: QuestionPickerText;
}) {
  const [state, run] = useActionState(action, emptyForm);
  const free = items.filter((item) => !item.added).length;
  const fields = Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />);
  return (
    <div className="flex flex-col gap-4">
      {state.formError && (
        <p className="form-alert" role="alert">
          {state.formError}
        </p>
      )}
      {state.ok && state.values?.added && (
        <p className="form-ok" role="status">
          {state.values.added}
        </p>
      )}
      {items.length === 0 ? (
        <p className="text-[15px] text-muted">{t.none}</p>
      ) : (
        <>
          <form action={run} className="flex flex-col gap-3">
            {fields}
            <p className="field-hint">{t.pickHint}</p>
            <ul className="flex max-h-[480px] flex-col gap-2 overflow-y-auto rounded-md border border-line p-2">
              {items.map((item) => (
                <li key={item.id}>
                  <label className={`flex items-start gap-3 rounded-md p-2.5 ${item.added ? "opacity-60" : "cursor-pointer hover:bg-surface-2"}`}>
                    <input type="checkbox" name="questionId" value={item.id} disabled={item.added} className="mt-1.5 accent-[var(--lb-primary)]" />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-3 text-[15px] text-ink">{item.stem}</span>
                      <span className="mt-0.5 block text-[13px] text-muted">{item.added ? t.already : item.tags}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <SubmitButton className="btn btn-primary btn-sm self-start" pendingLabel={t.saving}>
              {t.add}
            </SubmitButton>
          </form>
          {free > 0 && (
            <form action={run} className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
              {fields}
              <input type="hidden" name="mode" value="random" />
              <div className="field w-28">
                <label className="field-label" htmlFor="random-count">
                  {t.randomCount}
                </label>
                <input id="random-count" name="count" className="input" inputMode="numeric" defaultValue={String(Math.min(10, free))} />
              </div>
              <SubmitButton className="btn btn-ghost btn-sm" pendingLabel={t.saving}>
                {t.addRandom}
              </SubmitButton>
            </form>
          )}
        </>
      )}
    </div>
  );
}
