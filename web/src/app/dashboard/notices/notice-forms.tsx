"use client";

import { useActionState } from "react";
import { Field, FormMessages, type FormState, SubmitButton, TextAreaField, emptyForm } from "@/components/form";
import type { Dictionary } from "@/i18n";
import type { Notice } from "@/server/notices";
import { createNoticeAction, updateNoticeAction } from "./actions";

type Labels = Dictionary["dashboard"]["notices"];
type Common = Pick<Dictionary["common"], "save" | "saving" | "saved">;

function NoticeFields({ state, notice, t, idPrefix }: { state: FormState; notice?: Notice; t: Labels; idPrefix: string }) {
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
      <TextAreaField
        id={`${idPrefix}-body`}
        name="body"
        label={t.body}
        rows={4}
        defaultValue={state.values?.body ?? notice?.body ?? ""}
        error={state.errors.body}
      />
      <label className="flex items-center gap-2 text-[15px]">
        <input type="checkbox" name="pinned" defaultChecked={pinned} className="accent-[var(--lb-primary)]" />
        {t.pinned}
      </label>
    </>
  );
}

export function NewNoticeForm({ t, c }: { t: Labels; c: Common }) {
  const [state, action] = useActionState(createNoticeAction, emptyForm);
  return (
    <form action={action} className="card flex flex-col gap-4 p-5" noValidate aria-labelledby="notice-form-title">
      <h3 id="notice-form-title" className="panel-title">
        {t.new}
      </h3>
      <NoticeFields state={state} t={t} idPrefix="new-notice" />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary" pendingLabel={c.saving}>
          {t.publish}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}

export function EditNoticeForm({ notice, t, c }: { notice: Notice; t: Labels; c: Common }) {
  const [state, action] = useActionState(updateNoticeAction, emptyForm);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="noticeId" value={notice.id} />
      <NoticeFields state={state} notice={notice} t={t} idPrefix={`notice-${notice.id.slice(0, 8)}`} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary btn-sm" pendingLabel={c.saving}>
          {c.save}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}
