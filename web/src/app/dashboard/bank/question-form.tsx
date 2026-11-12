"use client";

import { useActionState, useDeferredValue, useRef, useState } from "react";
import { Field, FormMessages, PendingButton, SelectField, SubmitButton, emptyForm } from "@/components/form";
import { useKatex } from "@/components/math-preview";
import { type EditorText, RichEditor, type UploadErrors } from "@/components/rich-editor/rich-editor";
import { type MathRenderer, RichView } from "@/components/rich-view";
import type { Dictionary } from "@/i18n";
import {
  BOARDS,
  CREATIVE_PART_COUNT,
  DEFAULT_PART_MARKS,
  DIFFICULTIES,
  MAX_STATEMENTS,
  MIN_STATEMENTS,
  OPTION_COUNT,
  type QuestionType,
  isMcq,
  isProblem,
} from "@/lib/questions";
import { type RichText, richFromField, richToDoc } from "@/lib/rich-text";
import type { QuestionBody } from "@/server/db/schema";
import { createQuestionAction, deleteQuestionAction, updateQuestionAction } from "./actions";

type FormText = Dictionary["dashboard"]["bank"]["form"];
type QuestionText = Pick<
  Dictionary["questions"],
  | "types"
  | "optionKeys"
  | "partKeys"
  | "statementKeys"
  | "defaultPrompt"
  | "boards"
  | "stemLabel"
  | "explanation"
  | "answer"
  | "solution"
  | "difficulties"
>;
type Common = Pick<Dictionary["common"], "save" | "saving" | "saved" | "optional">;

/** A bank subject the question can be filed under; `group` is its class, for grouping the menu. */
export type SubjectChoice = { id: string; name: string; group: string; chapters: { id: string; label: string }[] };
export type QuestionData = {
  id: string;
  type: QuestionType;
  subjectId: string;
  chapterId: string | null;
  visibility: "public" | "private";
  body: QuestionBody;
  board: string;
  year: number | null;
  difficulty: string;
  source: string;
  videoUrl: string;
};

/**
 * The stem as the editor opens it. A question from before pictures went into the text kept one
 * picture beside its stem: it moves into the stem, at the end, and is saved there.
 */
function stemWithPicture(body: QuestionBody | undefined): RichText {
  if (!body) return "";
  if (!body.image) return body.stem;
  const doc = richToDoc(body.stem);
  return { type: "doc", content: [...doc.content, { type: "image", attrs: { src: body.image.url, mediaId: body.image.mediaId } }] };
}

/** The form's fields, from a saved question (or the defaults for a new one). Text fields are rich text. */
function initialFields(question: QuestionData | undefined, defaults: { subjectId: string; chapterId: string }) {
  const body = question?.body;
  const f: Record<string, RichText> = {
    subjectId: question?.subjectId ?? defaults.subjectId,
    chapterId: question ? (question.chapterId ?? "") : defaults.chapterId,
    stem: stemWithPicture(body),
    visibility: question?.visibility ?? "public",
    board: question?.board ?? "",
    year: question?.year ? String(question.year) : "",
    difficulty: question?.difficulty ?? "",
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

/** The form's values as posted, for the preview: every field, rich ones as JSON or plain text. */
function readForm(form: HTMLFormElement | null): Record<string, string> {
  const values: Record<string, string> = {};
  if (!form) return values;
  for (const [key, value] of new FormData(form).entries()) if (typeof value === "string") values[key] = value;
  return values;
}

export function QuestionForm({
  question,
  type,
  subjects,
  defaults,
  t,
  q,
  c,
  editor,
  uploadErrors,
}: {
  question?: QuestionData;
  type: QuestionType;
  subjects: SubjectChoice[];
  defaults: { subjectId: string; chapterId: string };
  t: FormText;
  q: QuestionText;
  c: Common;
  editor: EditorText;
  uploadErrors: UploadErrors;
}) {
  const [state, action] = useActionState(question ? updateQuestionAction : createQuestionAction, emptyForm);
  const initial = initialFields(question, defaults);
  /** A field's value: what a refused form posted, else what's saved. */
  const v = (name: string): RichText => state.values?.[name] ?? initial[name] ?? "";
  const s = (name: string): string => {
    const value = v(name);
    return typeof value === "string" ? value : "";
  };
  const e = state.errors;

  const [subjectId, setSubjectId] = useState(s("subjectId") || subjects[0]?.id || "");
  const chapters = subjects.find((subject) => subject.id === subjectId)?.chapters ?? [];

  // What the preview shows: the form's current values, read after every edit.
  const form = useRef<HTMLFormElement>(null);
  const [snapshot, setSnapshot] = useState<Record<string, string> | null>(null);
  const preview = useDeferredValue(snapshot);
  const refresh = () => setSnapshot(readForm(form.current));

  const mcq = isMcq(type);
  const stemLabel = type === "creative" ? t.stemCreative : t.stem;
  const rich = { t: editor, uploadErrors, onChange: refresh };

  return (
    <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <form ref={form} action={action} onChange={refresh} className="card flex min-w-0 flex-col gap-5 p-5" noValidate>
        <input type="hidden" name="type" value={type} />
        {question && <input type="hidden" name="questionId" value={question.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            name="subjectId"
            label={t.subject}
            defaultValue={s("subjectId") || subjects[0]?.id || ""}
            onChange={(event) => setSubjectId(event.target.value)}
            options={subjects.map((subject) => ({ value: subject.id, label: subject.name, group: subject.group }))}
            error={e.subjectId}
          />
          <SelectField
            key={subjectId}
            name="chapterId"
            label={t.chapter}
            defaultValue={subjectId === s("subjectId") ? s("chapterId") : ""}
            options={[{ value: "", label: t.noChapter }, ...chapters.map((ch) => ({ value: ch.id, label: ch.label }))]}
            error={e.chapterId}
          />
        </div>

        <RichEditor name="stem" label={stemLabel} rows={type === "creative" ? 5 : 3} defaultValue={v("stem")} error={e.stem} hint={t.mathHint} {...rich} />

        {type === "mcq_multi" && (
          <fieldset className="flex flex-col gap-3">
            <legend className="field-label mb-1">{t.statements}</legend>
            {Array.from({ length: MAX_STATEMENTS }, (_, i) => (
              <RichEditor
                key={i}
                name={`statement${i}`}
                label={`${t.statement} ${q.statementKeys[i]}`}
                labelNote={i >= MIN_STATEMENTS ? c.optional : undefined}
                mode="inline"
                rows={1}
                defaultValue={v(`statement${i}`)}
                error={e[`statement${i}`]}
                {...rich}
              />
            ))}
            <p className="field-hint">{t.statementsHint}</p>
            <Field name="prompt" label={t.prompt} placeholder={q.defaultPrompt} defaultValue={s("prompt")} error={e.prompt} />
          </fieldset>
        )}

        {mcq && (
          <fieldset className="flex flex-col gap-3" aria-describedby={e.answer ? "answer-error" : undefined}>
            <legend className="field-label mb-1">{t.options}</legend>
            {Array.from({ length: OPTION_COUNT }, (_, i) => (
              <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                <label className="choice mt-[30px] !px-3 !py-2.5" title={`${t.correct}: ${q.optionKeys[i]}`}>
                  <input type="radio" name="answer" value={i} defaultChecked={s("answer") === String(i)} aria-label={`${t.correct}: ${q.optionKeys[i]}`} />
                  <span className="font-semibold">{q.optionKeys[i]}</span>
                </label>
                <RichEditor
                  name={`option${i}`}
                  label={`${t.option} ${q.optionKeys[i]}`}
                  mode="inline"
                  rows={1}
                  defaultValue={v(`option${i}`)}
                  error={e[`option${i}`]}
                  {...rich}
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

        {mcq && <RichEditor name="explanation" label={t.explanation} labelNote={c.optional} rows={2} defaultValue={v("explanation")} error={e.explanation} {...rich} />}

        {type === "short" && (
          <RichEditor name="modelAnswer" label={t.modelAnswer} labelNote={c.optional} rows={3} defaultValue={v("modelAnswer")} error={e.modelAnswer} {...rich} />
        )}

        {type === "creative" && (
          <fieldset className="flex flex-col gap-4">
            <legend className="field-label mb-1">{t.parts}</legend>
            {Array.from({ length: CREATIVE_PART_COUNT }, (_, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-lg border border-line p-3">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
                  <RichEditor name={`part${i}`} label={`${t.part} ${q.partKeys[i]}`} rows={1} defaultValue={v(`part${i}`)} error={e[`part${i}`]} {...rich} />
                  <Field
                    name={`marks${i}`}
                    label={`${t.marks} (${q.partKeys[i]})`}
                    inputMode="numeric"
                    placeholder={String(DEFAULT_PART_MARKS[i])}
                    defaultValue={s(`marks${i}`)}
                    error={e[`marks${i}`]}
                  />
                </div>
                <details open={Boolean(v(`solution${i}`))}>
                  <summary className="sol-btn cursor-pointer">
                    {t.partSolution} ({q.partKeys[i]})
                  </summary>
                  <div className="mt-2">
                    <RichEditor
                      name={`solution${i}`}
                      label={`${t.partSolution} ${q.partKeys[i]}`}
                      labelNote={c.optional}
                      rows={3}
                      defaultValue={v(`solution${i}`)}
                      error={e[`solution${i}`]}
                      {...rich}
                    />
                  </div>
                </details>
              </div>
            ))}
          </fieldset>
        )}

        {isProblem(type) && (
          <>
            <RichEditor
              name="finalAnswer"
              label={t.finalAnswer}
              labelNote={c.optional}
              hint={t.finalAnswerHint}
              mode="inline"
              rows={1}
              defaultValue={v("finalAnswer")}
              error={e.finalAnswer}
              {...rich}
            />
            <RichEditor name="solution" label={t.solution} labelNote={c.optional} rows={5} defaultValue={v("solution")} error={e.solution} {...rich} />
          </>
        )}

        <fieldset className="flex flex-col gap-4 border-t border-line pt-4">
          <legend className="sr-only">{t.details}</legend>
          <p className="field-label">{t.details}</p>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <SelectField
              name="board"
              label={t.board}
              defaultValue={s("board")}
              options={[{ value: "", label: t.noBoard }, ...BOARDS.map((b) => ({ value: b, label: q.boards[b] }))]}
            />
            <Field name="year" label={t.year} inputMode="numeric" placeholder="2024" defaultValue={s("year")} error={e.year} />
          </div>
          <SelectField
            name="difficulty"
            label={t.difficulty}
            defaultValue={s("difficulty")}
            options={[{ value: "", label: t.noDifficulty }, ...DIFFICULTIES.map((k) => ({ value: k, label: q.difficulties[k] }))]}
          />
          <Field name="source" label={t.source} labelNote={c.optional} placeholder={t.sourcePlaceholder} defaultValue={s("source")} error={e.source} />
          <Field
            name="videoUrl"
            label={t.videoUrl}
            labelNote={c.optional}
            inputMode="url"
            placeholder="https://youtu.be/…"
            defaultValue={s("videoUrl")}
            error={e.videoUrl}
          />
          <div className="flex flex-col gap-2" role="radiogroup" aria-label={t.visibility}>
            <span className="field-label">{t.visibility}</span>
            {(["public", "private"] as const).map((option) => (
              <label key={option} className="choice">
                <input type="radio" name="visibility" value={option} defaultChecked={(s("visibility") || "public") === option} />
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
            <PendingButton name="next" value="another" className="btn btn-ghost">
              {t.saveAndNext}
            </PendingButton>
          )}
          <FormMessages state={state} saved={c.saved} />
        </div>
      </form>

      <section className="min-w-0 2xl:sticky 2xl:top-24" aria-label={t.preview}>
        <p className="mb-2 text-[13px] font-semibold text-muted">{t.preview}</p>
        <QuestionPreview type={type} read={(name) => (preview ? richFromField(preview[name]) : v(name))} q={q} />
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

/** The question as students will see it, typeset as you type; the right answer is ringed. */
function QuestionPreview({ type, read, q }: { type: QuestionType; read: (name: string) => RichText; q: QuestionText }) {
  const katex = useKatex();
  const math: MathRenderer = katex
    ? (tex, display) => katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: "ignore", output: "htmlAndMathml", trust: false })
    : null;
  const plain = (name: string) => {
    const value = read(name);
    return typeof value === "string" ? value : "";
  };
  const view = (name: string, inline = false) => <RichView value={read(name)} math={math} inline={inline} />;
  const answer = plain("answer") === "" ? -1 : Number(plain("answer"));

  return (
    <article className="q-card">
      <div className="q-top">
        <span className="tag">{q.types[type]}</span>
        {plain("board") && (
          <span className="tag board">
            {q.boards[plain("board") as keyof QuestionText["boards"]]} {plain("year")}
          </span>
        )}
      </div>
      {type === "creative" ? (
        <div className="stem stem-plain">
          <div className="q-text">
            <span className="stem-label">{q.stemLabel}</span>
            {view("stem")}
          </div>
        </div>
      ) : (
        <div className="q-text">{view("stem")}</div>
      )}

      {type === "mcq_multi" && (
        <>
          <ol className="stmts">
            {Array.from({ length: MAX_STATEMENTS }, (_, i) => `statement${i}`)
              .filter((name) => read(name))
              .map((name, i) => (
                <li key={name}>
                  <span>{q.statementKeys[i]}.</span>
                  {view(name, true)}
                </li>
              ))}
          </ol>
          <p className="q-text">{plain("prompt") || q.defaultPrompt}</p>
        </>
      )}

      {isMcq(type) && (
        <>
          <div className="options">
            {Array.from({ length: OPTION_COUNT }, (_, i) => (
              <div key={i} className={i === answer ? "opt correct" : "opt"}>
                <span className="k">{q.optionKeys[i]}</span>
                {view(`option${i}`, true)}
              </div>
            ))}
          </div>
          {read("explanation") && (
            <div className="explain">
              <b>{q.explanation}</b> {view("explanation")}
            </div>
          )}
        </>
      )}

      {type === "short" && read("modelAnswer") && (
        <div className="explain">
          <b>{q.answer}</b> {view("modelAnswer")}
        </div>
      )}

      {type === "creative" && (
        <div className="parts">
          {Array.from({ length: CREATIVE_PART_COUNT }, (_, i) => (
            <div key={i} className="part">
              <span className="pk">{q.partKeys[i]}.</span>
              <div className="min-w-0">
                {view(`part${i}`)}
                {read(`solution${i}`) && (
                  <div className="explain mt-2">
                    <b>{q.solution}</b> {view(`solution${i}`)}
                  </div>
                )}
              </div>
              <span className="marks">{plain(`marks${i}`) || DEFAULT_PART_MARKS[i]}</span>
            </div>
          ))}
        </div>
      )}

      {isProblem(type) && read("finalAnswer") && (
        <div className="explain">
          <b>{q.answer}</b> {view("finalAnswer", true)}
        </div>
      )}

      {isProblem(type) && read("solution") && (
        <div className="explain">
          <b>{q.solution}</b> {view("solution")}
        </div>
      )}
    </article>
  );
}
