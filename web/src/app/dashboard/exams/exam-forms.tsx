"use client";

import { useActionState, useState } from "react";
import { Field, FormMessages, SelectField, SubmitButton, TextAreaField, emptyForm } from "@/components/form";
import { createExamAction, deleteExamAction, updateExamAction } from "./actions";

// The dashboard's exam forms. Their text arrives as plain strings (the dictionaries hold functions
// too, which can't be handed to the browser).

type Common = { save: string; saving: string; saved: string; optional: string };

export type ExamFormText = {
  title: string;
  titlePlaceholder: string;
  course: string;
  batch: string;
  allBatches: string;
  startsAt: string;
  endsAt: string;
  windowHint: string;
  duration: string;
  mark: string;
  negative: string;
  negativeHint: string;
  shuffleQuestions: string;
  shuffleOptions: string;
  results: string;
  resultsImmediate: string;
  resultsAfterEnd: string;
  showAnswers: string;
  instructions: string;
  create: string;
  locked: string;
};

export type ExamValues = {
  id: string;
  courseId: string;
  batchId: string;
  title: string;
  instructions: string;
  startsAt: string;
  endsAt: string;
  durationMin: string;
  mark: string;
  negative: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  results: "immediate" | "after_end";
  showAnswers: boolean;
};

/** Create an exam (no `exam`), or change one. With `locked`, what decides a score can't change and is shown as it is. */
export function ExamForm({
  exam,
  defaults,
  courses,
  locked = false,
  t,
  c,
}: {
  exam?: ExamValues;
  /** A new exam's starting values: the next whole hour, half an hour long. */
  defaults: Omit<ExamValues, "id">;
  courses: { id: string; title: string; batches: { id: string; label: string }[] }[];
  locked?: boolean;
  t: ExamFormText;
  c: Common;
}) {
  const [state, action] = useActionState(exam ? updateExamAction : createExamAction, emptyForm);
  const start = exam ?? defaults;
  const typed = state.values;
  const v = (name: keyof Omit<ExamValues, "id" | "shuffleQuestions" | "shuffleOptions" | "showAnswers">) => typed?.[name] ?? String(start[name] ?? "");
  const on = (name: "shuffleQuestions" | "shuffleOptions" | "showAnswers") => (typed ? typed[name] === "on" : start[name]);
  // The batch menu follows the course chosen; kept here so it survives the form's reset after a refusal.
  const [courseId, setCourseId] = useState(v("courseId") || courses[0]?.id || "");
  const batches = courses.find((course) => course.id === courseId)?.batches ?? [];
  const e = state.errors;

  return (
    <form action={action} className="card flex flex-col gap-5 p-5" noValidate>
      {exam && <input type="hidden" name="examId" value={exam.id} />}
      {locked && <p className="form-alert">{t.locked}</p>}
      <Field name="title" label={t.title} placeholder={t.titlePlaceholder} defaultValue={v("title")} error={e.title} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="courseId"
          label={t.course}
          defaultValue={courseId}
          error={e.courseId}
          disabled={locked}
          onChange={(event) => setCourseId(event.target.value)}
          options={courses.map((course) => ({ value: course.id, label: course.title }))}
        />
        <SelectField
          key={courseId}
          name="batchId"
          label={t.batch}
          defaultValue={courseId === (exam?.courseId ?? "") ? v("batchId") : ""}
          error={e.batchId}
          disabled={locked}
          options={[{ value: "", label: t.allBatches }, ...batches.map((b) => ({ value: b.id, label: b.label }))]}
        />
      </div>
      {/* A disabled field isn't posted: when locked, its value goes along hidden. */}
      {locked && (
        <>
          <input type="hidden" name="courseId" value={exam?.courseId} />
          <input type="hidden" name="batchId" value={exam?.batchId} />
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="startsAt" type="datetime-local" label={t.startsAt} defaultValue={v("startsAt")} error={e.startsAt} required />
        <Field name="endsAt" type="datetime-local" label={t.endsAt} defaultValue={v("endsAt")} error={e.endsAt} required />
        <Field name="durationMin" label={t.duration} inputMode="numeric" defaultValue={v("durationMin")} error={e.durationMin} required />
      </div>
      <p className="field-hint -mt-2">{t.windowHint}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="mark" label={t.mark} inputMode="decimal" defaultValue={v("mark")} error={e.mark} readOnly={locked} />
        <Field name="negative" label={t.negative} hint={t.negativeHint} inputMode="decimal" defaultValue={v("negative")} error={e.negative} readOnly={locked} />
      </div>
      <div className="flex flex-col gap-2">
        {(["shuffleQuestions", "shuffleOptions"] as const).map((name) => (
          <label key={name} className="flex items-center gap-2 text-[15px]">
            <input type="checkbox" name={name} defaultChecked={on(name)} disabled={locked} className="accent-[var(--lb-primary)]" />
            {t[name]}
          </label>
        ))}
        {locked && (["shuffleQuestions", "shuffleOptions"] as const).map((name) => on(name) && <input key={name} type="hidden" name={name} value="on" />)}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="field-label mb-1">{t.results}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["immediate", t.resultsImmediate],
              ["after_end", t.resultsAfterEnd],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="choice">
              <input type="radio" name="results" value={value} defaultChecked={v("results") === value} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-[15px]">
        <input type="checkbox" name="showAnswers" defaultChecked={on("showAnswers")} className="accent-[var(--lb-primary)]" />
        {t.showAnswers}
      </label>
      <TextAreaField name="instructions" label={t.instructions} labelNote={c.optional} rows={3} defaultValue={v("instructions")} error={e.instructions} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary" pendingLabel={c.saving}>
          {exam ? c.save : t.create}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}

export function DeleteExamForm({ examId, t, label }: { examId: string; t: { title: string; lead: string; confirm: string }; label: string }) {
  const [state, action] = useActionState(deleteExamAction, emptyForm);
  return (
    <form action={action} className="card flex flex-col gap-3 border-bad/30 p-5">
      <input type="hidden" name="examId" value={examId} />
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
