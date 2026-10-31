"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

/** What a dashboard form action answers: per-field messages, what was typed, or a success flag. */
export type FormState = {
  ok?: boolean;
  errors: Record<string, string>;
  /** What was submitted, so a refused form comes back as the teacher typed it. */
  values?: Record<string, string>;
  formError?: string;
};

export const emptyForm: FormState = { errors: {} };

/** The "saved" line or the form-wide error, announced to screen readers. */
export function FormMessages({ state, saved }: { state: FormState; saved: string }) {
  if (state.formError)
    return (
      <p className="form-alert" role="alert">
        {state.formError}
      </p>
    );
  if (state.ok)
    return (
      <p className="form-ok" role="status">
        {saved}
      </p>
    );
  return null;
}

function describedBy(id: string, hint?: string, error?: string) {
  return [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
}

function FieldFrame({
  id,
  label,
  labelNote,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  labelNote?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
        {labelNote && <span className="optional"> ({labelNote})</span>}
      </label>
      {children}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
      {hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  error,
  labelNote,
  id = name,
  rows = 5,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  labelNote?: string;
}) {
  return (
    <FieldFrame id={id} label={label} labelNote={labelNote} hint={hint} error={error}>
      <textarea
        id={id}
        name={name}
        rows={rows}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      />
    </FieldFrame>
  );
}

export function SelectField({
  name,
  label,
  options,
  error,
  id = name,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  error?: string;
}) {
  return (
    <FieldFrame id={id} label={label} error={error}>
      <select id={id} name={name} className="input" aria-invalid={error ? true : undefined} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}

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
