"use client";

import { useActionState } from "react";
import { Field, FormMessages, SubmitButton, emptyForm } from "@/components/form";
import type { Dictionary } from "@/i18n";
import { createClassAction, renameClassAction } from "./actions";

type ClassText = Dictionary["dashboard"]["bank"]["classForm"];
type Common = Pick<Dictionary["common"], "save" | "saving" | "saved">;

/** A class's name, typed by the teacher: a new class (no `bankClass`), or renaming one. */
export function ClassForm({ bankClass, t, c }: { bankClass?: { id: string; name: string }; t: ClassText; c: Common }) {
  const [state, action] = useActionState(bankClass ? renameClassAction : createClassAction, emptyForm);
  return (
    <form action={action} className="card flex flex-col gap-5 p-5" noValidate>
      {bankClass && <input type="hidden" name="classId" value={bankClass.id} />}
      <Field
        name="name"
        label={t.name}
        hint={t.nameHint}
        placeholder={t.namePlaceholder}
        defaultValue={state.values?.name ?? bankClass?.name ?? ""}
        error={state.errors.name}
        list="class-suggestions"
        autoComplete="off"
        maxLength={60}
        required
      />
      <datalist id="class-suggestions">
        {t.suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary" pendingLabel={c.saving}>
          {bankClass ? c.save : t.create}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}
