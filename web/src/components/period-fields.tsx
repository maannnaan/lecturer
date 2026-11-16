"use client";

import { useState } from "react";

export type PeriodOption = {
  /** "2026-11", or the one period of a course paid in one go. */
  value: string;
  /** "নভেম্বর ২০২৬" */
  label: string;
  /** "বকেয়া" or "আগাম", beside the label. */
  tag?: string;
  /** Ticked to begin with: what is owed. */
  due?: boolean;
};

/**
 * The months a payment is for, as boxes to tick, and the amount they come to. The ticked months
 * are posted as `months` (joined with commas). With `editable` the amount is a field that follows
 * the ticks until the teacher types their own figure (a discount); without it, the amount is only
 * shown, and the server works it out again itself.
 */
export function PeriodFields({
  options,
  fee,
  legend,
  error,
  amountLabel,
  amountHint,
  amountError,
  editable,
  taka,
}: {
  options: PeriodOption[];
  fee: number;
  legend: string;
  error?: string;
  amountLabel: string;
  amountHint?: string;
  amountError?: string;
  editable: boolean;
  /** The amount written out for the page's language, e.g. "৳ ১,২০০" for 1200. Built on the server for every count of months. */
  taka: string[];
}) {
  const [picked, setPicked] = useState(() => options.filter((o) => o.due).map((o) => o.value));
  const [typed, setTyped] = useState<string | null>(null);
  const total = picked.length * fee;
  const toggle = (value: string) => {
    setPicked((current) => (current.includes(value) ? current.filter((v) => v !== value) : [...current, value]));
    // A new choice of months starts the amount afresh.
    setTyped(null);
  };

  return (
    <>
      <fieldset className="flex flex-col gap-2" aria-describedby={error ? "months-error" : undefined}>
        <legend className="field-label mb-1">{legend}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => (
            <label key={option.value} className="choice !items-center">
              <input type="checkbox" className="!mt-0" checked={picked.includes(option.value)} onChange={() => toggle(option.value)} />
              <span className="flex-1">{option.label}</span>
              {option.tag && <span className={option.due ? "badge badge-warn" : "badge"}>{option.tag}</span>}
            </label>
          ))}
        </div>
        {error && (
          <p className="field-error" id="months-error">
            {error}
          </p>
        )}
        <input type="hidden" name="months" value={[...picked].sort().join(",")} />
      </fieldset>

      {editable ? (
        <div className="field max-w-[260px]">
          <label className="field-label" htmlFor="amount">
            {amountLabel}
          </label>
          <input
            id="amount"
            name="amount"
            className="input"
            inputMode="numeric"
            value={typed ?? (total > 0 ? String(total) : "")}
            onChange={(event) => setTyped(event.target.value)}
            aria-invalid={amountError ? true : undefined}
            aria-describedby={[amountError && "amount-error", amountHint && "amount-hint"].filter(Boolean).join(" ") || undefined}
          />
          {amountError && (
            <p className="field-error" id="amount-error">
              {amountError}
            </p>
          )}
          {amountHint && (
            <p className="field-hint" id="amount-hint">
              {amountHint}
            </p>
          )}
        </div>
      ) : (
        <p className="flex items-baseline justify-between gap-4 rounded-md bg-surface-2 px-4 py-3 text-[15px] text-ink-2" role="status">
          {amountLabel}
          <b className="font-num text-[22px] text-ink">{taka[picked.length] ?? taka.at(-1)}</b>
        </p>
      )}
    </>
  );
}
