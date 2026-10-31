"use client";

import { useActionState } from "react";
import { Field, SubmitButton } from "@/components/form";
import type { Dictionary } from "@/i18n";
import { type RegisterState, registerTeacherAction } from "./actions";

const initial: RegisterState = { values: {}, errors: {} };

export function RegisterForm({ t, optional }: { t: Dictionary["register"]; optional: string }) {
  const [state, action] = useActionState(registerTeacherAction, initial);
  const { values, errors } = state;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.formError && (
        <p className="form-alert" role="alert">
          {state.formError}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          name="nameBn"
          label={t.nameBn}
          placeholder={t.nameBnPlaceholder}
          defaultValue={values.nameBn}
          error={errors.nameBn}
          autoComplete="name"
          lang="bn"
          required
        />
        <Field
          name="nameEn"
          label={t.nameEn}
          placeholder={t.nameEnPlaceholder}
          defaultValue={values.nameEn}
          error={errors.nameEn}
          lang="en"
          required
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          name="phone"
          label={t.phone}
          placeholder="01XXXXXXXXX"
          defaultValue={values.phone}
          error={errors.phone}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
        />
        <Field
          name="email"
          label={t.email}
          labelNote={optional}
          defaultValue={values.email}
          error={errors.email}
          type="email"
          autoComplete="email"
        />
      </div>
      <Field
        name="handle"
        label={t.handle}
        prefix="lecturer.bd/"
        hint={t.handleHint}
        defaultValue={values.handle}
        error={errors.handle}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
      />
      <Field
        name="subjects"
        label={t.subjects}
        labelNote={optional}
        placeholder={t.subjectsPlaceholder}
        defaultValue={values.subjects}
        error={errors.subjects}
      />
      <Field
        name="institution"
        label={t.institution}
        labelNote={optional}
        placeholder={t.institutionPlaceholder}
        defaultValue={values.institution}
        error={errors.institution}
        autoComplete="organization"
      />
      <Field
        name="password"
        label={t.password}
        hint={t.passwordHint}
        error={errors.password}
        type="password"
        autoComplete="new-password"
        required
      />
      <SubmitButton pendingLabel={t.submitting}>{t.submit}</SubmitButton>
    </form>
  );
}
