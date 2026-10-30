"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  /** Text shown after the label, e.g. "(optional)". */
  labelNote?: string;
  /** Fixed text in front of the input, e.g. "lecturer.bd/". */
  prefix?: string;
};

/** A labelled input with its hint and its error, wired together for screen readers. */
export function Field({ name, label, hint, error, labelNote, prefix, id = name, ...input }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = (
    <input
      id={id}
      name={name}
      className="input"
      aria-invalid={error ? true : undefined}
      aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
      {...input}
    />
  );
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {labelNote && <span className="optional"> ({labelNote})</span>}
      </label>
      {prefix ? (
        <div className="input-group" aria-invalid={error ? true : undefined}>
          <span className="prefix" aria-hidden="true">
            {prefix}
          </span>
          {control}
        </div>
      ) : (
        control
      )}
      {error && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
      {hint && (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** A submit button that shows `pendingLabel` and locks itself while its form is being sent. */
export function SubmitButton({
  children,
  pendingLabel,
  className = "btn btn-primary btn-block",
}: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
