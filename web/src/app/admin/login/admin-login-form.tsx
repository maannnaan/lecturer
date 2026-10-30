"use client";

import { useActionState } from "react";
import { Field, SubmitButton } from "@/components/form";
import type { Dictionary } from "@/i18n";
import { type AdminLoginState, adminLoginAction } from "./actions";

// Only the labels it shows: a dictionary section can hold functions, which can't cross to the client.
type Labels = Pick<Dictionary["admin"], "email" | "password" | "submit">;

export function AdminLoginForm({ t, pending }: { t: Labels; pending: string }) {
  const [state, action] = useActionState(adminLoginAction, { email: "" } satisfies AdminLoginState);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error && (
        <p className="form-alert" role="alert">
          {state.error}
        </p>
      )}
      <Field name="email" label={t.email} type="email" defaultValue={state.email} autoComplete="username" required />
      <Field name="password" label={t.password} type="password" autoComplete="current-password" required />
      <SubmitButton pendingLabel={pending}>{t.submit}</SubmitButton>
    </form>
  );
}
