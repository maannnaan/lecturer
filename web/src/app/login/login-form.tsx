"use client";

import { useActionState } from "react";
import { Field, SubmitButton } from "@/components/form";
import type { Dictionary } from "@/i18n";
import { type LoginState, loginTeacherAction } from "./actions";

export function LoginForm({ t }: { t: Dictionary["login"] }) {
  const [state, action] = useActionState(loginTeacherAction, { identifier: "" } satisfies LoginState);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error && (
        <p className="form-alert" role="alert">
          {state.error}
        </p>
      )}
      <Field
        name="identifier"
        label={t.identifier}
        defaultValue={state.identifier}
        autoComplete="username"
        autoCapitalize="none"
        required
      />
      <Field name="password" label={t.password} type="password" autoComplete="current-password" required />
      <SubmitButton pendingLabel={t.submitting}>{t.submit}</SubmitButton>
    </form>
  );
}
