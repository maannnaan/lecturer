"use client";

import { useActionState, useState } from "react";
import { CourseIconGlyph } from "@/components/course-icon";
import { Field, FormMessages, type FormState, SubmitButton, TextAreaField, emptyForm } from "@/components/form";
import type { Dictionary } from "@/i18n";
import { CHAPTER_STATUSES, COURSE_ACCESS, COURSE_ICONS, PRICE_PERIODS } from "@/lib/courses";
import type { Chapter, Course } from "@/server/courses";
import {
  addChapterAction,
  createCourseAction,
  deleteCourseAction,
  updateChapterAction,
  updateCourseAction,
} from "./actions";

type Courses = Dictionary["dashboard"]["courses"];
type Common = Pick<Dictionary["common"], "save" | "saving" | "saved" | "optional" | "delete">;
type ChapterLabels = Omit<Courses["chapters"], "defaultLabel">;

const valueOf = (state: FormState, name: string, saved: string | number | null | undefined) =>
  state.values?.[name] ?? (saved == null ? "" : String(saved));

/** Create a course (no `course`) or edit one. */
export function CourseForm({
  course,
  heading,
  t,
  c,
}: {
  course?: Course;
  heading?: string;
  t: Courses["form"];
  c: Common;
}) {
  const [state, action] = useActionState(course ? updateCourseAction : createCourseAction, emptyForm);
  const v = (name: keyof Course) => valueOf(state, name, course?.[name] as string | number | undefined);
  const [access, setAccess] = useState(v("access") || "approval");
  const icon = v("icon") || "book-open";
  const cover = v("cover") || "1";
  const published = state.values ? state.values.published === "on" : (course?.published ?? false);
  const e = state.errors;

  return (
    <form
      action={action}
      className="card flex flex-col gap-5 p-5"
      noValidate
      aria-labelledby={heading ? "course-form-title" : undefined}
    >
      {heading && (
        <h3 id="course-form-title" className="panel-title">
          {heading}
        </h3>
      )}
      {course && <input type="hidden" name="courseId" value={course.id} />}
      <Field name="title" label={t.title} placeholder={t.titlePlaceholder} defaultValue={v("title")} error={e.title} required />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="level" label={t.level} placeholder={t.levelPlaceholder} defaultValue={v("level")} error={e.level} />
        <Field name="session" label={t.session} placeholder={t.sessionPlaceholder} defaultValue={v("session")} error={e.session} />
      </div>
      <TextAreaField
        name="description"
        label={t.description}
        labelNote={c.optional}
        rows={4}
        defaultValue={v("description")}
        error={e.description}
      />

      <fieldset>
        <legend className="field-label mb-2">{t.icon}</legend>
        <div className="flex flex-wrap gap-2">
          {COURSE_ICONS.map((name) => (
            <label key={name} className="choice !p-2.5" title={name}>
              <input type="radio" name="icon" value={name} defaultChecked={icon === name} className="sr-only" />
              <CourseIconGlyph name={name} className="size-6 text-primary-text" />
              <span className="sr-only">{name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="field-label mb-2">{t.cover}</legend>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((n) => (
            <label key={n} className="choice !p-2">
              <input type="radio" name="cover" value={n} defaultChecked={cover === String(n)} className="sr-only" />
              <span className="block h-10 w-16 rounded-md" style={{ background: `var(--lb-cover-${n})` }} />
              <span className="sr-only">{n}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="field-label mb-2">{t.access}</legend>
        {COURSE_ACCESS.map((option) => (
          <label key={option} className="choice">
            <input
              type="radio"
              name="access"
              value={option}
              defaultChecked={access === option}
              onChange={() => setAccess(option)}
            />
            <span>{t.accessOptions[option]}</span>
          </label>
        ))}
        <p className="field-hint">{t.accessNote}</p>
      </fieldset>

      {access === "paid" && (
        <div className="flex flex-col gap-5">
          <div className="sm:max-w-60">
            <Field name="price" label={t.price} inputMode="numeric" defaultValue={v("price") === "0" ? "" : v("price")} error={e.price} />
          </div>
          <fieldset>
            <legend className="field-label mb-2">{t.pricePeriod}</legend>
            <div className="flex flex-wrap gap-2">
              {PRICE_PERIODS.map((p) => (
                <label key={p} className="choice">
                  <input type="radio" name="pricePeriod" value={p} defaultChecked={(v("pricePeriod") || "monthly") === p} />
                  <span>{t.periods[p]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      <label className="choice">
        <input type="checkbox" name="published" defaultChecked={published} />
        <span>
          <b className="block font-semibold text-ink">{t.published}</b>
          <span className="text-sm text-muted">{t.publishedHint}</span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary" pendingLabel={c.saving}>
          {course ? c.save : t.create}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}

export function DeleteCourseForm({ courseId, t, c }: { courseId: string; t: Courses["remove"]; c: Common }) {
  const [state, action] = useActionState(deleteCourseAction, emptyForm);
  return (
    <form action={action} className="card flex flex-col gap-3 border-bad/30 p-5">
      <input type="hidden" name="courseId" value={courseId} />
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

/**
 * A chapter's fields. `autoLabel` is what the chapter is called if the label is left empty
 * ("অধ্যায় ৩"), shown as the label's placeholder.
 */
function ChapterFields({
  state,
  chapter,
  t,
  statuses,
  idPrefix,
  autoLabel,
}: {
  state: FormState;
  chapter?: Chapter;
  t: ChapterLabels;
  statuses: Courses["statuses"];
  idPrefix: string;
  autoLabel: string;
}) {
  const v = (name: keyof Chapter) => valueOf(state, name, chapter?.[name] as string | null | undefined);
  const status = v("status") || "upcoming";
  const e = state.errors;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)]">
        <Field id={`${idPrefix}-label`} name="label" label={t.label} placeholder={autoLabel} defaultValue={v("label")} error={e.label} />
        <Field
          id={`${idPrefix}-title`}
          name="title"
          label={t.nameField}
          placeholder={t.titlePlaceholder}
          defaultValue={v("title")}
          error={e.title}
          required
        />
      </div>
      <fieldset>
        <legend className="field-label mb-2">{t.status}</legend>
        <div className="flex flex-wrap gap-2">
          {CHAPTER_STATUSES.map((s) => (
            <label key={s} className="choice !py-2">
              <input type="radio" name="status" value={s} defaultChecked={status === s} />
              <span>{statuses[s]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${idPrefix}-starts`} name="startsOn" label={t.startsOn} type="date" defaultValue={v("startsOn")} error={e.startsOn} />
        <Field id={`${idPrefix}-ends`} name="endsOn" label={t.endsOn} type="date" defaultValue={v("endsOn")} error={e.endsOn} />
      </div>
    </>
  );
}

export function AddChapterForm({
  courseId,
  autoLabel,
  t,
  statuses,
  c,
}: {
  courseId: string;
  autoLabel: string;
  t: ChapterLabels;
  statuses: Courses["statuses"];
  c: Common;
}) {
  const [state, action] = useActionState(addChapterAction, emptyForm);
  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-dashed border-line-strong p-4" noValidate>
      <input type="hidden" name="courseId" value={courseId} />
      <ChapterFields state={state} t={t} statuses={statuses} idPrefix="new-chapter" autoLabel={autoLabel} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary btn-sm" pendingLabel={c.saving}>
          {t.add}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}

export function EditChapterForm({
  chapter,
  autoLabel,
  t,
  statuses,
  c,
}: {
  chapter: Chapter;
  autoLabel: string;
  t: ChapterLabels;
  statuses: Courses["statuses"];
  c: Common;
}) {
  const [state, action] = useActionState(updateChapterAction, emptyForm);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="chapterId" value={chapter.id} />
      <ChapterFields
        state={state}
        chapter={chapter}
        t={t}
        statuses={statuses}
        idPrefix={`chapter-${chapter.number}`}
        autoLabel={autoLabel}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary btn-sm" pendingLabel={c.saving}>
          {c.save}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}
