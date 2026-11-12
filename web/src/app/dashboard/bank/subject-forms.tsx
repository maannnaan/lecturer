"use client";

import { useActionState, useState } from "react";
import { Field, FormMessages, SelectField, SubmitButton, TextAreaField, emptyForm } from "@/components/form";
import type { Dictionary } from "@/i18n";
import { SUBJECT_GROUPS } from "@/lib/bank";
import type { Grade } from "@/lib/grades";
import {
  addChaptersAction,
  addTopicsAction,
  createSubjectAction,
  deleteSubjectAction,
  renameTopicAction,
  updateBankChapterAction,
  updateSubjectAction,
} from "./actions";

type Bank = Dictionary["dashboard"]["bank"];
type Common = Pick<Dictionary["common"], "save" | "saving" | "saved" | "optional" | "delete">;

/**
 * Create a bank subject (no `subject`): its class, its name, and its chapters pasted one per line
 * or taken from one of the teacher's courses. Or edit an existing subject's class and name. Each
 * class comes with the ready-made list (`key`) its name suggests, for the subject name's hints.
 */
export function SubjectForm({
  subject,
  classes,
  courses = [],
  defaultClassId = "",
  heading,
  t,
  c,
  groups,
}: {
  subject?: { id: string; classId: string; group: string; name: string };
  classes: { id: string; name: string; key: Grade }[];
  courses?: { id: string; title: string }[];
  defaultClassId?: string;
  heading?: string;
  t: Bank["subjectForm"];
  c: Common;
  groups: Dictionary["bankGroups"];
}) {
  const [state, action] = useActionState(subject ? updateSubjectAction : createSubjectAction, emptyForm);
  const initial: Record<string, string> = {
    classId: subject?.classId ?? (defaultClassId || classes[0]?.id || ""),
    group: subject?.group ?? "",
    name: subject?.name ?? "",
    chapters: "",
    copyFrom: "",
  };
  const v = (name: string) => state.values?.[name] ?? initial[name] ?? "";
  // The name suggestions follow the class picked; the select itself stays uncontrolled.
  const [classId, setClassId] = useState(v("classId"));
  const suggestions = t.suggestions[classes.find((x) => x.id === classId)?.key ?? "other"];
  const e = state.errors;

  return (
    <form action={action} className="card flex flex-col gap-5 p-5" noValidate aria-labelledby={heading ? "subject-form-title" : undefined}>
      {heading && (
        <h3 id="subject-form-title" className="panel-title">
          {heading}
        </h3>
      )}
      {subject && <input type="hidden" name="subjectId" value={subject.id} />}
      <div className="grid gap-5">
        <SelectField
          name="classId"
          label={t.grade}
          defaultValue={v("classId")}
          error={e.classId}
          onChange={(event) => setClassId(event.target.value)}
          options={classes.map((x) => ({ value: x.id, label: x.name }))}
        />
        <Field
          name="name"
          label={t.name}
          placeholder={t.namePlaceholder}
          defaultValue={v("name")}
          error={e.name}
          list="subject-suggestions"
          autoComplete="off"
          required
        />
        <datalist id="subject-suggestions">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <SelectField
          name="group"
          label={t.group}
          hint={t.groupHint}
          defaultValue={v("group")}
          options={[{ value: "", label: t.groupNone }, ...SUBJECT_GROUPS.map((g) => ({ value: g, label: groups[g] }))]}
        />
      </div>

      {!subject && (
        <>
          <TextAreaField
            name="chapters"
            label={t.chapters}
            labelNote={c.optional}
            hint={t.chaptersHint}
            placeholder={t.chaptersPlaceholder}
            rows={8}
            defaultValue={v("chapters")}
            error={e.chapters}
          />
          {courses.length > 0 && (
            <SelectField
              name="copyFrom"
              label={t.copyFrom}
              defaultValue={v("copyFrom")}
              options={[{ value: "", label: t.copyNone }, ...courses.map((course) => ({ value: course.id, label: course.title }))]}
            />
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary" pendingLabel={c.saving}>
          {subject ? c.save : t.create}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}

/** Adds one or more chapters at the end of a subject, one per line. */
export function AddChaptersForm({ subjectId, t, c }: { subjectId: string; t: Bank["chaptersEditor"]; c: Common }) {
  const [state, action] = useActionState(addChaptersAction, emptyForm);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-dashed border-line-strong p-4" noValidate>
      <input type="hidden" name="subjectId" value={subjectId} />
      <TextAreaField
        id="new-chapters"
        name="chapters"
        label={t.addLabel}
        rows={3}
        defaultValue={state.values?.chapters ?? ""}
        error={state.errors.chapters}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary btn-sm" pendingLabel={c.saving}>
          {t.add}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}

/** A chapter's label and name. `autoLabel` ("অধ্যায় ৩") is what an empty label shows. */
export function EditBankChapterForm({
  chapter,
  autoLabel,
  t,
  c,
}: {
  chapter: { id: string; number: number; label: string; title: string };
  autoLabel: string;
  t: Bank["chaptersEditor"];
  c: Common;
}) {
  const [state, action] = useActionState(updateBankChapterAction, emptyForm);
  const v = (name: "label" | "title") => state.values?.[name] ?? chapter[name];
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="chapterId" value={chapter.id} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)]">
        <Field id={`chapter-${chapter.number}-label`} name="label" label={t.label} placeholder={autoLabel} defaultValue={v("label")} error={state.errors.label} />
        <Field
          id={`chapter-${chapter.number}-title`}
          name="title"
          label={t.nameField}
          defaultValue={v("title")}
          error={state.errors.title}
          required
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary btn-sm" pendingLabel={c.saving}>
          {c.save}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}

/** Adds one or more sub-chapters at the end of a chapter, one per line. */
export function AddTopicsForm({ chapterId, t, c }: { chapterId: string; t: Bank["chaptersEditor"]; c: Common }) {
  const [state, action] = useActionState(addTopicsAction, emptyForm);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-dashed border-line-strong p-3" noValidate>
      <input type="hidden" name="chapterId" value={chapterId} />
      <TextAreaField
        id={`new-topics-${chapterId}`}
        name="topics"
        label={t.addTopicsLabel}
        hint={t.addTopicsHint}
        rows={3}
        defaultValue={state.values?.topics ?? ""}
        error={state.errors.topics}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary btn-sm" pendingLabel={c.saving}>
          {t.addTopics}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}

/** A sub-chapter's name, with its number ("৪.১") as the field's label. */
export function RenameTopicForm({ topic, number, t, c }: { topic: { id: string; title: string }; number: string; t: Bank["chaptersEditor"]; c: Common }) {
  const [state, action] = useActionState(renameTopicAction, emptyForm);
  return (
    <form action={action} className="flex min-w-0 flex-1 flex-wrap items-end gap-2" noValidate>
      <input type="hidden" name="topicId" value={topic.id} />
      <div className="min-w-0 flex-[1_1_220px]">
        <Field
          id={`topic-${topic.id}`}
          name="title"
          label={`${number} · ${t.topicName}`}
          defaultValue={state.values?.title ?? topic.title}
          error={state.errors.title}
          required
        />
      </div>
      <SubmitButton className="btn btn-ghost btn-sm" pendingLabel={c.saving}>
        {c.save}
      </SubmitButton>
      <FormMessages state={state} saved={c.saved} />
    </form>
  );
}

export function DeleteSubjectForm({
  subjectId,
  t,
  c,
}: {
  subjectId: string;
  t: { title: string; lead: string; confirm: string };
  c: Common;
}) {
  const [state, action] = useActionState(deleteSubjectAction, emptyForm);
  return (
    <form action={action} className="card flex flex-col gap-3 border-bad/30 p-5">
      <input type="hidden" name="subjectId" value={subjectId} />
      <h3 className="panel-title">{t.title}</h3>
      <p className="text-[15px] text-ink-2">{t.lead}</p>
      <label className="flex items-center gap-2 text-[15px]">
        <input type="checkbox" name="confirm" className="accent-[var(--lb-bad)]" />
        {t.confirm}
      </label>
      {state.errors.confirm && <p className="field-error">{state.errors.confirm}</p>}
      <SubmitButton className="btn btn-danger self-start" pendingLabel="…">
        {c.delete}
      </SubmitButton>
    </form>
  );
}
