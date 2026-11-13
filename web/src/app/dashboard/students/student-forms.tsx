"use client";

import { useActionState, useState } from "react";
import { Field, FormMessages, SelectField, SubmitButton, TextAreaField, emptyForm } from "@/components/form";
import {
  createBatchAction,
  createStudentAction,
  deleteStudentAction,
  enrollAction,
  placeAction,
  setStudentPasswordAction,
  updateBatchAction,
  updateStudentAction,
} from "./actions";

// The dashboard's forms for students, admissions and batches. Their text arrives as plain strings
// (the dictionaries hold functions too, which can't be handed to the browser).

type Common = { save: string; saving: string; saved: string; optional: string };

export type StudentFormText = {
  name: string;
  phone: string;
  guardianName: string;
  guardianPhone: string;
  institution: string;
  classLevel: string;
  address: string;
  note: string;
  noteHint: string;
  create: string;
};
export type StudentValues = {
  id: string;
  name: string;
  phone: string;
  guardianName: string;
  guardianPhone: string;
  institution: string;
  classLevel: string;
  address: string;
  note: string;
};

/** Add a student (no `student`), or change what is known about one. */
export function StudentForm({ student, t, c }: { student?: StudentValues; t: StudentFormText; c: Common }) {
  const [state, action] = useActionState(student ? updateStudentAction : createStudentAction, emptyForm);
  const v = (name: keyof Omit<StudentValues, "id">) => state.values?.[name] ?? student?.[name] ?? "";
  const e = state.errors;
  return (
    <form action={action} className="card flex flex-col gap-5 p-5" noValidate>
      {student && <input type="hidden" name="studentId" value={student.id} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="name" label={t.name} defaultValue={v("name")} error={e.name} required />
        <Field name="phone" label={t.phone} defaultValue={v("phone")} error={e.phone} inputMode="tel" placeholder="01XXXXXXXXX" required />
        <Field name="institution" label={t.institution} labelNote={c.optional} defaultValue={v("institution")} error={e.institution} />
        <Field name="classLevel" label={t.classLevel} labelNote={c.optional} defaultValue={v("classLevel")} error={e.classLevel} />
        <Field name="guardianName" label={t.guardianName} labelNote={c.optional} defaultValue={v("guardianName")} error={e.guardianName} />
        <Field
          name="guardianPhone"
          label={t.guardianPhone}
          labelNote={c.optional}
          defaultValue={v("guardianPhone")}
          error={e.guardianPhone}
          inputMode="tel"
          placeholder="01XXXXXXXXX"
        />
      </div>
      <Field name="address" label={t.address} labelNote={c.optional} defaultValue={v("address")} error={e.address} />
      <TextAreaField name="note" label={t.note} labelNote={c.optional} hint={t.noteHint} rows={2} defaultValue={v("note")} error={e.note} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary" pendingLabel={c.saving}>
          {student ? c.save : t.create}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}

/** Gives the student a login password, or a new one. */
export function StudentPasswordForm({ studentId, t, c }: { studentId: string; t: { newPassword: string; passwordHint: string; setPassword: string }; c: Common }) {
  const [state, action] = useActionState(setStudentPasswordAction, emptyForm);
  // A fresh, empty field after each password given.
  const [given, setGiven] = useState({ state, count: 0 });
  if (state !== given.state) setGiven({ state, count: given.count + (state.ok ? 1 : 0) });
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="studentId" value={studentId} />
      <Field key={given.count} id={`password-${studentId}`} name="password" label={t.newPassword} hint={t.passwordHint} error={state.errors.password} autoComplete="off" required />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-ghost btn-sm" pendingLabel={c.saving}>
          {t.setPassword}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}

export type PlacementText = { batch: string; noBatch: string; roll: string; rollHint: string; fee: string; feeHint: string };

/** The batch, roll and fee fields shared by admitting a student and enrolling one. */
function PlacementFields({
  id,
  batches,
  values,
  errors,
  t,
}: {
  id: string;
  batches: { id: string; label: string; group?: string }[];
  values: { batchId: string; roll: string; fee: string };
  errors: Record<string, string>;
  t: PlacementText;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,0.9fr)]">
      {batches.length > 0 ? (
        <SelectField
          id={`${id}-batch`}
          name="batchId"
          label={t.batch}
          defaultValue={values.batchId}
          error={errors.batchId}
          options={[{ value: "", label: t.noBatch }, ...batches.map((b) => ({ value: b.id, label: b.label, group: b.group }))]}
        />
      ) : (
        <input type="hidden" name="batchId" value="" />
      )}
      <Field id={`${id}-roll`} name="roll" label={t.roll} hint={t.rollHint} defaultValue={values.roll} error={errors.roll} inputMode="numeric" />
      <Field id={`${id}-fee`} name="fee" label={t.fee} hint={t.feeHint} defaultValue={values.fee} error={errors.fee} inputMode="numeric" />
    </div>
  );
}

/**
 * Lets a student who asked into the course (`submit`: "ভর্তি করুন"), or changes the place of one
 * already in it (`submit`: "সংরক্ষণ করুন").
 */
export function PlacementForm({
  enrollmentId,
  batches,
  current,
  submit,
  t,
  c,
}: {
  enrollmentId: string;
  batches: { id: string; label: string }[];
  current: { batchId: string | null; roll: string | null; fee: number | null };
  submit: string;
  t: PlacementText;
  c: Common;
}) {
  const [state, action] = useActionState(placeAction, emptyForm);
  const values = {
    batchId: state.values?.batchId ?? current.batchId ?? "",
    roll: state.values?.roll ?? current.roll ?? "",
    fee: state.values?.fee ?? (current.fee === null ? "" : String(current.fee)),
  };
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <PlacementFields id={`place-${enrollmentId.slice(0, 8)}`} batches={batches} values={values} errors={state.errors} t={t} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary btn-sm" pendingLabel={c.saving}>
          {submit}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}

/** Puts a student into one of the teacher's courses. The batch menu follows the course picked. */
export function EnrollForm({
  studentId,
  courses,
  t,
  c,
}: {
  studentId: string;
  courses: { id: string; title: string; batches: { id: string; label: string }[] }[];
  t: PlacementText & { course: string; enroll: string };
  c: Common;
}) {
  const [state, action] = useActionState(enrollAction, emptyForm);
  const [courseId, setCourseId] = useState(state.values?.courseId ?? courses[0]?.id ?? "");
  const batches = courses.find((course) => course.id === courseId)?.batches ?? [];
  // A fresh form after each enrolment.
  const [done, setDone] = useState({ state, count: 0 });
  if (state !== done.state) setDone({ state, count: done.count + (state.ok ? 1 : 0) });
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="studentId" value={studentId} />
      <SelectField
        id="enroll-course"
        name="courseId"
        label={t.course}
        defaultValue={courseId}
        error={state.errors.courseId}
        onChange={(event) => setCourseId(event.target.value)}
        options={courses.map((course) => ({ value: course.id, label: course.title }))}
      />
      <PlacementFields
        key={`${courseId}-${done.count}`}
        id="enroll"
        batches={batches}
        values={{ batchId: state.ok ? "" : (state.values?.batchId ?? ""), roll: state.ok ? "" : (state.values?.roll ?? ""), fee: state.ok ? "" : (state.values?.fee ?? "") }}
        errors={state.errors}
        t={t}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary btn-sm" pendingLabel={c.saving}>
          {t.enroll}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}

export function DeleteStudentForm({ studentId, t, label }: { studentId: string; t: { title: string; lead: string; confirm: string }; label: string }) {
  const [state, action] = useActionState(deleteStudentAction, emptyForm);
  return (
    <form action={action} className="card flex flex-col gap-3 border-bad/30 p-5">
      <input type="hidden" name="studentId" value={studentId} />
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

export type BatchFormText = {
  course: string;
  name: string;
  namePlaceholder: string;
  schedule: string;
  schedulePlaceholder: string;
  capacity: string;
  capacityHint: string;
  open: string;
  create: string;
};

/** Open a batch in a course (no `batch`), or change one. */
export function BatchForm({
  batch,
  courses,
  t,
  c,
}: {
  batch?: { id: string; name: string; schedule: string; capacity: number | null; open: boolean };
  /** The courses a new batch can be opened in. */
  courses?: { id: string; title: string }[];
  t: BatchFormText;
  c: Common;
}) {
  const [state, action] = useActionState(batch ? updateBatchAction : createBatchAction, emptyForm);
  // A fresh form after each batch added.
  const [added, setAdded] = useState({ state, count: 0 });
  if (state !== added.state) setAdded({ state, count: added.count + (state.ok && !batch ? 1 : 0) });
  const typed = state.ok && !batch ? undefined : state.values;
  const id = batch ? `batch-${batch.id.slice(0, 8)}` : "new-batch";
  const open = typed ? typed.open === "on" : (batch?.open ?? true);
  return (
    <form key={added.count} action={action} className="flex flex-col gap-4" noValidate>
      {batch && <input type="hidden" name="batchId" value={batch.id} />}
      {courses && (
        <SelectField
          id={`${id}-course`}
          name="courseId"
          label={t.course}
          defaultValue={typed?.courseId ?? courses[0]?.id ?? ""}
          error={state.errors.courseId}
          options={courses.map((course) => ({ value: course.id, label: course.title }))}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-name`} name="name" label={t.name} placeholder={t.namePlaceholder} defaultValue={typed?.name ?? batch?.name ?? ""} error={state.errors.name} required />
        <Field
          id={`${id}-capacity`}
          name="capacity"
          label={t.capacity}
          labelNote={c.optional}
          hint={t.capacityHint}
          inputMode="numeric"
          defaultValue={typed?.capacity ?? (batch?.capacity ? String(batch.capacity) : "")}
          error={state.errors.capacity}
        />
      </div>
      <Field
        id={`${id}-schedule`}
        name="schedule"
        label={t.schedule}
        labelNote={c.optional}
        placeholder={t.schedulePlaceholder}
        defaultValue={typed?.schedule ?? batch?.schedule ?? ""}
        error={state.errors.schedule}
      />
      <label className="flex items-center gap-2 text-[15px]">
        <input type="checkbox" name="open" defaultChecked={open} className="accent-[var(--lb-primary)]" />
        {t.open}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary btn-sm" pendingLabel={c.saving}>
          {batch ? c.save : t.create}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}
