"use client";

import { useActionState, useState } from "react";
import { Field, FormMessages, SelectField, SubmitButton, TextAreaField, emptyForm } from "@/components/form";
import { createPaperAction, deletePaperAction, updatePaperAction } from "./actions";

// The dashboard's paper forms. Their text arrives as plain strings (the dictionaries hold
// functions too, which can't be handed to the browser).

type Common = { save: string; saving: string; saved: string; optional: string };

export type PaperFormText = {
  title: string;
  titlePlaceholder: string;
  course: string;
  batch: string;
  allBatches: string;
  headerTitle: string;
  institution: string;
  subject: string;
  subjectHint: string;
  className: string;
  date: string;
  datePlaceholder: string;
  duration: string;
  durationPlaceholder: string;
  fullMarks: string;
  fullMarksHint: string;
  instructions: string;
  setsTitle: string;
  setCount: string;
  setCountHint: string;
  shuffleQuestions: string;
  shuffleOptions: string;
  shuffleHint: string;
  mark: string;
  negative: string;
  negativeHint: string;
  create: string;
  locked: string;
};

export type PaperValues = {
  id: string;
  courseId: string;
  batchId: string;
  title: string;
  institution: string;
  subject: string;
  className: string;
  date: string;
  duration: string;
  fullMarks: string;
  instructions: string;
  setCount: string;
  mark: string;
  negative: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
};

type TextName = Exclude<keyof PaperValues, "id" | "shuffleQuestions" | "shuffleOptions">;

/** Create a paper (no `paper`), or change one. With `locked` (a final paper), what decides its sets can't change and is shown as it is. */
export function PaperForm({
  paper,
  defaults,
  courses,
  locked = false,
  t,
  c,
}: {
  paper?: PaperValues;
  defaults: Omit<PaperValues, "id">;
  courses: { id: string; title: string; batches: { id: string; label: string }[] }[];
  locked?: boolean;
  t: PaperFormText;
  c: Common;
}) {
  const [state, action] = useActionState(paper ? updatePaperAction : createPaperAction, emptyForm);
  const start = paper ?? defaults;
  const typed = state.values;
  const v = (name: TextName) => typed?.[name] ?? String(start[name] ?? "");
  const on = (name: "shuffleQuestions" | "shuffleOptions") => (typed ? typed[name] === "on" : start[name]);
  // The batch menu follows the course chosen; kept here so it survives the form's reset after a refusal.
  const [courseId, setCourseId] = useState(v("courseId") || courses[0]?.id || "");
  const batches = courses.find((course) => course.id === courseId)?.batches ?? [];
  const e = state.errors;

  return (
    <form action={action} className="card flex flex-col gap-5 p-5" noValidate>
      {paper && <input type="hidden" name="paperId" value={paper.id} />}
      {locked && <p className="form-alert">{t.locked}</p>}
      <Field name="title" label={t.title} placeholder={t.titlePlaceholder} defaultValue={v("title")} error={e.title} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="courseId"
          label={t.course}
          defaultValue={courseId}
          error={e.courseId}
          onChange={(event) => setCourseId(event.target.value)}
          options={courses.map((course) => ({ value: course.id, label: course.title }))}
        />
        <SelectField
          key={courseId}
          name="batchId"
          label={t.batch}
          defaultValue={courseId === (paper?.courseId ?? defaults.courseId) ? v("batchId") : ""}
          error={e.batchId}
          options={[{ value: "", label: t.allBatches }, ...batches.map((b) => ({ value: b.id, label: b.label }))]}
        />
      </div>

      <fieldset className="flex flex-col gap-4 border-t border-line pt-4">
        <legend className="panel-title pr-2">{t.headerTitle}</legend>
        <Field name="institution" label={t.institution} defaultValue={v("institution")} error={e.institution} labelNote={c.optional} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="subject" id="paper-subject" label={t.subject} hint={t.subjectHint} defaultValue={v("subject")} error={e.subject} />
          <Field name="className" label={t.className} defaultValue={v("className")} error={e.className} labelNote={c.optional} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="date" label={t.date} placeholder={t.datePlaceholder} defaultValue={v("date")} error={e.date} labelNote={c.optional} />
          <Field name="duration" label={t.duration} placeholder={t.durationPlaceholder} defaultValue={v("duration")} error={e.duration} labelNote={c.optional} />
        </div>
        <TextAreaField name="instructions" label={t.instructions} labelNote={c.optional} rows={2} defaultValue={v("instructions")} error={e.instructions} />
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-line pt-4">
        <legend className="panel-title pr-2">{t.setsTitle}</legend>
        <Field name="setCount" label={t.setCount} hint={t.setCountHint} inputMode="numeric" defaultValue={v("setCount")} error={e.setCount} readOnly={locked} required />
        <div className="flex flex-col gap-2">
          {(["shuffleQuestions", "shuffleOptions"] as const).map((name) => (
            <label key={name} className="flex items-center gap-2 text-[15px]">
              <input type="checkbox" name={name} defaultChecked={on(name)} disabled={locked} className="accent-[var(--lb-primary)]" />
              {t[name]}
            </label>
          ))}
          {/* A disabled box isn't posted: when locked, what it says goes along hidden. */}
          {locked && (["shuffleQuestions", "shuffleOptions"] as const).map((name) => on(name) && <input key={name} type="hidden" name={name} value="on" />)}
          <p className="field-hint">{t.shuffleHint}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="mark" label={t.mark} inputMode="decimal" defaultValue={v("mark")} error={e.mark} />
          <Field name="negative" label={t.negative} hint={t.negativeHint} inputMode="decimal" defaultValue={v("negative")} error={e.negative} />
        </div>
        <Field name="fullMarks" label={t.fullMarks} hint={t.fullMarksHint} defaultValue={v("fullMarks")} error={e.fullMarks} />
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary" pendingLabel={c.saving}>
          {paper ? c.save : t.create}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}

export function DeletePaperForm({ paperId, t, label }: { paperId: string; t: { title: string; lead: string; confirm: string }; label: string }) {
  const [state, action] = useActionState(deletePaperAction, emptyForm);
  return (
    <form action={action} className="card flex flex-col gap-3 border-bad/30 p-5">
      <input type="hidden" name="paperId" value={paperId} />
      <h2 className="panel-title">{t.title}</h2>
      <p className="text-[15px] text-ink-2">{t.lead}</p>
      <label className="flex items-center gap-2 text-[15px]">
        <input type="checkbox" name="confirm" className="accent-[var(--lb-bad)]" />
        {t.confirm}
      </label>
      {state.errors.confirm && <p className="field-error">{state.errors.confirm}</p>}
      <SubmitButton className="btn btn-danger self-start" pendingLabel="…">
        {label}
      </SubmitButton>
    </form>
  );
}
