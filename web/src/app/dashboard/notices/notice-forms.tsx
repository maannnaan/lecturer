"use client";

import { useActionState, useState } from "react";
import { Field, FormMessages, type FormState, SubmitButton, emptyForm } from "@/components/form";
import { type EditorText, RichEditor, type UploadErrors } from "@/components/rich-editor/rich-editor";
import type { Dictionary } from "@/i18n";
import type { Notice } from "@/server/notices";
import { createNoticeAction, updateNoticeAction } from "./actions";

type Labels = Dictionary["dashboard"]["notices"];
type Common = Pick<Dictionary["common"], "save" | "saving" | "saved">;
/** What every notice form needs for its body's editor. */
export type NoticeEditor = { editor: EditorText; uploadErrors: UploadErrors };

function NoticeFields({
  state,
  notice,
  t,
  idPrefix,
  rich,
}: {
  state: FormState;
  notice?: Notice;
  t: Labels;
  idPrefix: string;
  rich: NoticeEditor;
}) {
  const pinned = state.values ? state.values.pinned === "on" : (notice?.pinned ?? false);
  return (
    <>
      <Field
        id={`${idPrefix}-title`}
        name="title"
        label={t.titleField}
        placeholder={t.titlePlaceholder}
        defaultValue={state.values?.title ?? notice?.title ?? ""}
        error={state.errors.title}
        required
      />
      <RichEditor
        id={`${idPrefix}-body`}
        name="body"
        label={t.body}
        rows={3}
        dollars={false}
        defaultValue={state.values?.body ?? notice?.bodyRich ?? notice?.body ?? ""}
        error={state.errors.body}
        t={rich.editor}
        uploadErrors={rich.uploadErrors}
      />
      <label className="flex items-center gap-2 text-[15px]">
        <input type="checkbox" name="pinned" defaultChecked={pinned} className="accent-[var(--lb-primary)]" />
        {t.pinned}
      </label>
    </>
  );
}

export function NewNoticeForm({ t, c, rich }: { t: Labels; c: Common; rich: NoticeEditor }) {
  const [state, action] = useActionState(createNoticeAction, emptyForm);
  // Each published notice leaves a fresh, empty form behind, its body's editor included.
  const [published, setPublished] = useState({ state, count: 0 });
  if (state !== published.state) setPublished({ state, count: published.count + (state.ok ? 1 : 0) });
  return (
    <form action={action} className="card flex flex-col gap-4 p-5" noValidate aria-labelledby="notice-form-title">
      <h2 id="notice-form-title" className="panel-title">
        {t.new}
      </h2>
      <NoticeFields key={published.count} state={state} t={t} idPrefix="new-notice" rich={rich} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary" pendingLabel={c.saving}>
          {t.publish}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}

export function EditNoticeForm({ notice, t, c, rich }: { notice: Notice; t: Labels; c: Common; rich: NoticeEditor }) {
  const [state, action] = useActionState(updateNoticeAction, emptyForm);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="noticeId" value={notice.id} />
      <NoticeFields state={state} notice={notice} t={t} idPrefix={`notice-${notice.id.slice(0, 8)}`} rich={rich} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary btn-sm" pendingLabel={c.saving}>
          {c.save}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}
