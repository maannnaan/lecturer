"use client";

import { type FormEvent, useActionState, useDeferredValue, useRef, useState, useTransition } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Field, FormMessages, SelectField, SubmitButton, TextAreaField, emptyForm } from "@/components/form";
import { MathPreviewText, useKatex } from "@/components/math-preview";
import type { Dictionary } from "@/i18n";
import {
  BOARDS,
  CREATIVE_PART_COUNT,
  DEFAULT_PART_MARKS,
  MAX_STATEMENTS,
  MIN_STATEMENTS,
  OPTION_COUNT,
  type QuestionType,
  isMcq,
  isProblem,
} from "@/lib/questions";
import { uploadImage } from "@/lib/shrink-image";
import type { QuestionBody } from "@/server/db/schema";
import { createQuestionAction, deleteQuestionAction, updateQuestionAction } from "./actions";

type FormText = Dictionary["dashboard"]["bank"]["form"];
type QuestionText = Pick<
  Dictionary["questions"],
  "types" | "optionKeys" | "partKeys" | "statementKeys" | "defaultPrompt" | "boards" | "stemLabel" | "explanation" | "answer" | "solution"
>;
type Common = Pick<Dictionary["common"], "save" | "saving" | "saved" | "optional">;
type UploadErrors = { type: string; size: string; unavailable: string };

/** A course the question can be filed under; `group` is its class, for grouping the menu. */
export type CourseChoice = { id: string; title: string; group: string; chapters: { id: string; label: string }[] };
export type QuestionData = {
  id: string;
  type: QuestionType;
  courseId: string;
  chapterId: string | null;
  visibility: "public" | "private";
  body: QuestionBody;
  board: string;
  year: number | null;
  source: string;
  videoUrl: string;
};

/** The form's fields as strings, from a saved question (or the defaults for a new one). */
function initialFields(question: QuestionData | undefined, defaults: { courseId: string; chapterId: string }) {
  const body = question?.body;
  const f: Record<string, string> = {
    courseId: question?.courseId ?? defaults.courseId,
    chapterId: question ? (question.chapterId ?? "") : defaults.chapterId,
    stem: body?.stem ?? "",
    visibility: question?.visibility ?? "public",
    board: question?.board ?? "",
    year: question?.year ? String(question.year) : "",
    source: question?.source ?? "",
    videoUrl: question?.videoUrl ?? "",
    explanation: body?.explanation ?? "",
    prompt: body?.prompt ?? "",
    modelAnswer: body?.modelAnswer ?? "",
    finalAnswer: body?.finalAnswer ?? "",
    solution: body?.solution ?? "",
    answer: body?.answer !== undefined ? String(body.answer) : "",
  };
  body?.options?.forEach((o, i) => (f[`option${i}`] = o));
  body?.statements?.forEach((s, i) => (f[`statement${i}`] = s));
  body?.parts?.forEach((p, i) => {
    f[`part${i}`] = p.text;
    f[`marks${i}`] = String(p.marks);
    f[`solution${i}`] = p.solution;
  });
  return f;
}

export function QuestionForm({
  question,
  type,
  courses,
  defaults,
  t,
  q,
  c,
  uploadErrors,
}: {
  question?: QuestionData;
  type: QuestionType;
  courses: CourseChoice[];
  defaults: { courseId: string; chapterId: string };
  t: FormText;
  q: QuestionText;
  c: Common;
  uploadErrors: UploadErrors;
}) {
  const [state, action] = useActionState(question ? updateQuestionAction : createQuestionAction, emptyForm);
  const initial = initialFields(question, defaults);
  const v = (name: string) => state.values?.[name] ?? initial[name] ?? "";
  const e = state.errors;

  const [courseId, setCourseId] = useState(v("courseId") || courses[0]?.id || "");
  const chapters = courses.find((course) => course.id === courseId)?.chapters ?? [];
  const [image, setImage] = useState(question?.body.image ? { id: question.body.image.mediaId, url: question.body.image.url } : null);

  // What the preview shows: the form's current values, read on every edit.
  const [snapshot, setSnapshot] = useState<Record<string, string>>(initial);
  const preview = useDeferredValue(snapshot);
  const readForm = (event: FormEvent<HTMLFormElement>) => {
    const values: Record<string, string> = {};
    for (const [key, value] of new FormData(event.currentTarget).entries()) if (typeof value === "string") values[key] = value;
    setSnapshot(values);
  };

  const mcq = isMcq(type);
  const stemLabel = type === "creative" ? t.stemCreative : t.stem;

  return (
    <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <form action={action} onChange={readForm} className="card flex min-w-0 flex-col gap-5 p-5" noValidate>
        <input type="hidden" name="type" value={type} />
        {question && <input type="hidden" name="questionId" value={question.id} />}
        <input type="hidden" name="imageId" value={image?.id ?? ""} />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            name="courseId"
            label={t.course}
            defaultValue={v("courseId") || courses[0]?.id || ""}
            onChange={(event) => setCourseId(event.target.value)}
            options={courses.map((course) => ({ value: course.id, label: course.title, group: course.group }))}
            error={e.courseId}
          />
          <SelectField
            key={courseId}
            name="chapterId"
            label={t.chapter}
            defaultValue={courseId === v("courseId") ? v("chapterId") : ""}
            options={[{ value: "", label: t.noChapter }, ...chapters.map((ch) => ({ value: ch.id, label: ch.label }))]}
            error={e.chapterId}
          />
        </div>

        <TextAreaField
          name="stem"
          label={stemLabel}
          rows={type === "creative" ? 5 : 3}
          defaultValue={v("stem")}
          error={e.stem}
          hint={t.mathHint}
          required
        />

        <ImagePicker image={image} onChange={setImage} t={t} uploadErrors={uploadErrors} error={e.imageId} />

        {type === "mcq_multi" && (
          <fieldset className="flex flex-col gap-3">
            <legend className="field-label mb-1">{t.statements}</legend>
            {Array.from({ length: MAX_STATEMENTS }, (_, i) => (
              <Field
                key={i}
                name={`statement${i}`}
                label={`${t.statement} ${q.statementKeys[i]}`}
                labelNote={i >= MIN_STATEMENTS ? c.optional : undefined}
                defaultValue={v(`statement${i}`)}
                error={e[`statement${i}`]}
              />
            ))}
            <p className="field-hint">{t.statementsHint}</p>
            <Field name="prompt" label={t.prompt} placeholder={q.defaultPrompt} defaultValue={v("prompt")} error={e.prompt} />
          </fieldset>
        )}

        {mcq && (
          <fieldset className="flex flex-col gap-3" aria-describedby={e.answer ? "answer-error" : undefined}>
            <legend className="field-label mb-1">{t.options}</legend>
            {Array.from({ length: OPTION_COUNT }, (_, i) => (
              <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                <label className="choice mt-[3px] !px-3 !py-2.5" title={`${t.correct}: ${q.optionKeys[i]}`}>
                  <input type="radio" name="answer" value={i} defaultChecked={v("answer") === String(i)} aria-label={`${t.correct}: ${q.optionKeys[i]}`} />
                  <span className="font-semibold">{q.optionKeys[i]}</span>
                </label>
                <Field
                  name={`option${i}`}
                  label={`${t.option} ${q.optionKeys[i]}`}
                  defaultValue={v(`option${i}`)}
                  error={e[`option${i}`]}
                  required
                />
              </div>
            ))}
            {e.answer && (
              <p className="field-error" id="answer-error">
                {e.answer}
              </p>
            )}
          </fieldset>
        )}

        {mcq && (
          <TextAreaField name="explanation" label={t.explanation} labelNote={c.optional} rows={3} defaultValue={v("explanation")} error={e.explanation} />
        )}

        {type === "short" && (
          <TextAreaField name="modelAnswer" label={t.modelAnswer} labelNote={c.optional} rows={4} defaultValue={v("modelAnswer")} error={e.modelAnswer} />
        )}

        {type === "creative" && (
          <fieldset className="flex flex-col gap-4">
            <legend className="field-label mb-1">{t.parts}</legend>
            {Array.from({ length: CREATIVE_PART_COUNT }, (_, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-lg border border-line p-3">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
                  <TextAreaField
                    name={`part${i}`}
                    label={`${t.part} ${q.partKeys[i]}`}
                    rows={2}
                    defaultValue={v(`part${i}`)}
                    error={e[`part${i}`]}
                    required
                  />
                  <Field
                    name={`marks${i}`}
                    label={`${t.marks} (${q.partKeys[i]})`}
                    inputMode="numeric"
                    placeholder={String(DEFAULT_PART_MARKS[i])}
                    defaultValue={v(`marks${i}`)}
                    error={e[`marks${i}`]}
                  />
                </div>
                <details open={Boolean(v(`solution${i}`))}>
                  <summary className="sol-btn cursor-pointer">
                    {t.partSolution} ({q.partKeys[i]})
                  </summary>
                  <div className="mt-2">
                    <TextAreaField
                      name={`solution${i}`}
                      label={`${t.partSolution} ${q.partKeys[i]}`}
                      labelNote={c.optional}
                      rows={4}
                      defaultValue={v(`solution${i}`)}
                      error={e[`solution${i}`]}
                    />
                  </div>
                </details>
              </div>
            ))}
          </fieldset>
        )}

        {isProblem(type) && (
          <>
            <Field
              name="finalAnswer"
              label={t.finalAnswer}
              labelNote={c.optional}
              hint={t.finalAnswerHint}
              defaultValue={v("finalAnswer")}
              error={e.finalAnswer}
            />
            <TextAreaField name="solution" label={t.solution} labelNote={c.optional} rows={6} defaultValue={v("solution")} error={e.solution} />
          </>
        )}

        <fieldset className="flex flex-col gap-4 border-t border-line pt-4">
          <legend className="sr-only">{t.details}</legend>
          <p className="field-label">{t.details}</p>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <SelectField
              name="board"
              label={t.board}
              defaultValue={v("board")}
              options={[{ value: "", label: t.noBoard }, ...BOARDS.map((b) => ({ value: b, label: q.boards[b] }))]}
            />
            <Field name="year" label={t.year} inputMode="numeric" placeholder="2024" defaultValue={v("year")} error={e.year} />
          </div>
          <Field name="source" label={t.source} labelNote={c.optional} placeholder={t.sourcePlaceholder} defaultValue={v("source")} error={e.source} />
          <Field
            name="videoUrl"
            label={t.videoUrl}
            labelNote={c.optional}
            inputMode="url"
            placeholder="https://youtu.be/…"
            defaultValue={v("videoUrl")}
            error={e.videoUrl}
          />
          <div className="flex flex-col gap-2" role="radiogroup" aria-label={t.visibility}>
            <span className="field-label">{t.visibility}</span>
            {(["public", "private"] as const).map((option) => (
              <label key={option} className="choice">
                <input type="radio" name="visibility" value={option} defaultChecked={(v("visibility") || "public") === option} />
                <span>{t.visibilityOptions[option]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton className="btn btn-primary" pendingLabel={c.saving}>
            {question ? c.save : t.create}
          </SubmitButton>
          {!question && (
            <button type="submit" name="next" value="another" className="btn btn-ghost">
              {t.saveAndNext}
            </button>
          )}
          <FormMessages state={state} saved={c.saved} />
        </div>
      </form>

      <section className="min-w-0 2xl:sticky 2xl:top-24" aria-label={t.preview}>
        <p className="mb-2 text-[13px] font-semibold text-muted">{t.preview}</p>
        <QuestionPreview type={type} values={preview} imageUrl={image?.url ?? null} q={q} />
      </section>
    </div>
  );
}

export function DeleteQuestionForm({
  questionId,
  t,
  label,
}: {
  questionId: string;
  t: Dictionary["dashboard"]["bank"]["remove"];
  label: string;
}) {
  const [state, action] = useActionState(deleteQuestionAction, emptyForm);
  return (
    <form action={action} className="card flex flex-col gap-3 border-bad/30 p-5">
      <input type="hidden" name="questionId" value={questionId} />
      <h3 className="panel-title">{t.title}</h3>
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

function ImagePicker({
  image,
  onChange,
  t,
  uploadErrors,
  error,
}: {
  image: { id: string; url: string } | null;
  onChange: (image: { id: string; url: string } | null) => void;
  t: FormText;
  uploadErrors: UploadErrors;
  error?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function upload(file: File) {
    setBusy(true);
    setFailed(null);
    const result = await uploadImage(file);
    if ("error" in result) {
      setFailed(uploadErrors[result.error as keyof UploadErrors] ?? t.uploadFailed);
    } else {
      onChange(result);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="field">
      <span className="field-label">{t.image}</span>
      <div className="flex flex-wrap items-center gap-3">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element -- the teacher's own upload
          <img src={image.url} alt="" className="max-h-28 rounded-md border border-line bg-white object-contain" />
        )}
        <input
          ref={input}
          id="question-image"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) startTransition(() => upload(file));
          }}
        />
        <label htmlFor="question-image" className="btn btn-ghost btn-sm cursor-pointer" aria-disabled={busy}>
          <ImagePlus aria-hidden="true" />
          {busy ? t.uploading : image ? t.imageChange : t.imageChoose}
        </label>
        {image && !busy && (
          <button type="button" className="btn btn-danger btn-xs" onClick={() => onChange(null)}>
            <Trash2 aria-hidden="true" />
            {t.imageRemove}
          </button>
        )}
      </div>
      {(failed || error) && (
        <p className="field-error" role="alert">
          {failed ?? error}
        </p>
      )}
    </div>
  );
}

/** The question as students will see it, typeset as you type; the right answer is ringed. */
function QuestionPreview({
  type,
  values,
  imageUrl,
  q,
}: {
  type: QuestionType;
  values: Record<string, string>;
  imageUrl: string | null;
  q: QuestionText;
}) {
  const katex = useKatex();
  const text = (name: string) => values[name] ?? "";
  const answer = values.answer === undefined || values.answer === "" ? -1 : Number(values.answer);
  const figure = imageUrl && (
    // eslint-disable-next-line @next/next/no-img-element -- the teacher's own upload
    <img src={imageUrl} alt="" className="q-figure" />
  );

  return (
    <article className="q-card">
      <div className="q-top">
        <span className="tag">{q.types[type]}</span>
        {text("board") && (
          <span className="tag board">
            {q.boards[text("board") as keyof QuestionText["boards"]]} {text("year")}
          </span>
        )}
      </div>
      {type === "creative" ? (
        <div className="stem">
          <p className="q-text">
            <span className="stem-label">{q.stemLabel}</span>
            <MathPreviewText text={text("stem")} katex={katex} />
          </p>
          {figure}
        </div>
      ) : (
        <>
          <p className="q-text">
            <MathPreviewText text={text("stem")} katex={katex} />
          </p>
          {figure}
        </>
      )}

      {type === "mcq_multi" && (
        <>
          <ol className="stmts">
            {Array.from({ length: MAX_STATEMENTS }, (_, i) => text(`statement${i}`))
              .filter(Boolean)
              .map((s, i) => (
                <li key={i}>
                  <span>{q.statementKeys[i]}.</span>
                  <MathPreviewText text={s} katex={katex} />
                </li>
              ))}
          </ol>
          <p className="q-text">{text("prompt") || q.defaultPrompt}</p>
        </>
      )}

      {isMcq(type) && (
        <>
          <div className="options">
            {Array.from({ length: OPTION_COUNT }, (_, i) => (
              <div key={i} className={i === answer ? "opt correct" : "opt"}>
                <span className="k">{q.optionKeys[i]}</span>
                <MathPreviewText text={text(`option${i}`)} katex={katex} />
              </div>
            ))}
          </div>
          {text("explanation") && (
            <div className="explain">
              <b>{q.explanation}</b> <MathPreviewText text={text("explanation")} katex={katex} />
            </div>
          )}
        </>
      )}

      {type === "short" && text("modelAnswer") && (
        <div className="explain">
          <b>{q.answer}</b> <MathPreviewText text={text("modelAnswer")} katex={katex} />
        </div>
      )}

      {type === "creative" && (
        <div className="parts">
          {Array.from({ length: CREATIVE_PART_COUNT }, (_, i) => (
            <div key={i} className="part">
              <span className="pk">{q.partKeys[i]}.</span>
              <span className="min-w-0">
                <MathPreviewText text={text(`part${i}`)} katex={katex} />
                {text(`solution${i}`) && (
                  <span className="explain mt-2 block">
                    <b>{q.solution}</b> <MathPreviewText text={text(`solution${i}`)} katex={katex} />
                  </span>
                )}
              </span>
              <span className="marks">{text(`marks${i}`) || DEFAULT_PART_MARKS[i]}</span>
            </div>
          ))}
        </div>
      )}

      {isProblem(type) && text("finalAnswer") && (
        <div className="explain">
          <b>{q.answer}</b> <MathPreviewText text={text("finalAnswer")} katex={katex} />
        </div>
      )}

      {isProblem(type) && text("solution") && (
        <div className="explain">
          <b>{q.solution}</b> <MathPreviewText text={text("solution")} katex={katex} />
        </div>
      )}
    </article>
  );
}
