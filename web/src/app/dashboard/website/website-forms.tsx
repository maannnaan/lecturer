"use client";

import { useActionState } from "react";
import { Field, FormMessages, type FormState, SubmitButton, TextAreaField, emptyForm } from "@/components/form";
import type { Dictionary, Locale } from "@/i18n";
import { ROUTINE_SLOTS, STAT_SLOTS } from "@/lib/site";
import type { TeacherSite } from "@/server/db/schema";
import {
  changeHandleAction,
  saveContactAction,
  saveHighlightsAction,
  saveLanguageAction,
  saveProfileAction,
  saveRoutineAction,
} from "./actions";

type Website = Dictionary["dashboard"]["website"];
type Common = Pick<Dictionary["common"], "save" | "saving" | "saved" | "optional">;

/** What a field shows: what was just typed if the form came back refused, else what's saved. */
function valueOf(state: FormState, name: string, saved: string | undefined): string {
  return state.values?.[name] ?? saved ?? "";
}

function Footer({ state, c }: { state: FormState; c: Common }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SubmitButton className="btn btn-primary" pendingLabel={c.saving}>
        {c.save}
      </SubmitButton>
      <FormMessages state={state} saved={c.saved} />
    </div>
  );
}

export type ProfileValues = {
  nameBn: string;
  nameEn: string;
  subjects: string;
  institution: string;
  designation?: string;
  location?: string;
  admission?: string;
  tagline?: string;
  about?: string;
};

export function ProfileForm({ saved, t, c }: { saved: ProfileValues; t: Website["profile"]; c: Common }) {
  const [state, action] = useActionState(saveProfileAction, emptyForm);
  const v = (name: keyof ProfileValues) => valueOf(state, name, saved[name]);
  const e = state.errors;
  return (
    <form action={action} className="card flex flex-col gap-5 p-5" noValidate aria-labelledby="profile-title">
      <h3 id="profile-title" className="panel-title">
        {t.title}
      </h3>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="nameBn" label={t.nameBn} defaultValue={v("nameBn")} error={e.nameBn} lang="bn" required />
        <Field name="nameEn" label={t.nameEn} defaultValue={v("nameEn")} error={e.nameEn} lang="en" required />
        <Field name="designation" label={t.designation} placeholder={t.designationPlaceholder} defaultValue={v("designation")} error={e.designation} />
        <Field name="subjects" label={t.subjects} placeholder={t.subjectsPlaceholder} defaultValue={v("subjects")} error={e.subjects} />
        <Field name="institution" label={t.institution} placeholder={t.institutionPlaceholder} defaultValue={v("institution")} error={e.institution} />
        <Field name="location" label={t.location} placeholder={t.locationPlaceholder} defaultValue={v("location")} error={e.location} />
      </div>
      <Field name="admission" label={t.admission} labelNote={c.optional} placeholder={t.admissionPlaceholder} defaultValue={v("admission")} error={e.admission} />
      <Field name="tagline" label={t.tagline} placeholder={t.taglinePlaceholder} defaultValue={v("tagline")} error={e.tagline} />
      <TextAreaField name="about" label={t.about} hint={t.aboutHint} rows={7} defaultValue={v("about")} error={e.about} />
      <Footer state={state} c={c} />
    </form>
  );
}

export function HighlightsForm({
  saved,
  t,
  c,
}: {
  saved: Pick<TeacherSite, "highlight" | "stats">;
  t: Website["highlights"];
  c: Common;
}) {
  const [state, action] = useActionState(saveHighlightsAction, emptyForm);
  const e = state.errors;
  return (
    <form action={action} className="card flex flex-col gap-5 p-5" noValidate aria-labelledby="highlights-title">
      <div>
        <h3 id="highlights-title" className="panel-title">
          {t.title}
        </h3>
        <p className="panel-lead">{t.lead}</p>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="field-label mb-2">{t.highlight}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            name="highlightValue"
            label={t.value}
            placeholder={t.highlightValuePlaceholder}
            defaultValue={valueOf(state, "highlightValue", saved.highlight?.value)}
            error={e.highlightValue}
          />
          <Field
            name="highlightLabel"
            label={t.label}
            placeholder={t.highlightLabelPlaceholder}
            defaultValue={valueOf(state, "highlightLabel", saved.highlight?.label)}
            error={e.highlightLabel}
          />
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="field-label mb-2">{t.stats}</legend>
        {Array.from({ length: STAT_SLOTS }, (_, i) => (
          <div key={i} className="grid gap-3 sm:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)]">
            <Field
              name={`stat${i}Value`}
              label={`${t.value} ${i + 1}`}
              placeholder={i === 0 ? t.statValuePlaceholder : undefined}
              defaultValue={valueOf(state, `stat${i}Value`, saved.stats?.[i]?.value)}
              error={e[`stat${i}Value`]}
            />
            <Field
              name={`stat${i}Label`}
              label={`${t.label} ${i + 1}`}
              placeholder={i === 0 ? t.statLabelPlaceholder : undefined}
              defaultValue={valueOf(state, `stat${i}Label`, saved.stats?.[i]?.label)}
              error={e[`stat${i}Label`]}
            />
          </div>
        ))}
      </fieldset>
      <Footer state={state} c={c} />
    </form>
  );
}

export function ContactForm({ saved, t, c }: { saved: TeacherSite["contact"]; t: Website["contact"]; c: Common }) {
  const [state, action] = useActionState(saveContactAction, emptyForm);
  const s = saved ?? {};
  const e = state.errors;
  const v = (name: keyof NonNullable<TeacherSite["contact"]>) => valueOf(state, name, s[name]);
  return (
    <form action={action} className="card flex flex-col gap-5 p-5" noValidate aria-labelledby="contact-title">
      <h3 id="contact-title" className="panel-title">
        {t.title}
      </h3>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="phone" label={t.phone} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" defaultValue={v("phone")} error={e.phone} />
        <Field name="whatsapp" label={t.whatsapp} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" defaultValue={v("whatsapp")} error={e.whatsapp} />
        <Field name="email" label={t.email} type="email" defaultValue={v("email")} error={e.email} />
        <Field name="hours" label={t.hours} placeholder={t.hoursPlaceholder} defaultValue={v("hours")} error={e.hours} />
        <Field name="facebook" label={t.facebook} type="url" placeholder="facebook.com/…" defaultValue={v("facebook")} error={e.facebook} />
        <Field name="youtube" label={t.youtube} type="url" placeholder="youtube.com/@…" defaultValue={v("youtube")} error={e.youtube} />
      </div>
      <Field name="address" label={t.address} placeholder={t.addressPlaceholder} defaultValue={v("address")} error={e.address} />
      <Footer state={state} c={c} />
    </form>
  );
}

export function RoutineForm({ saved, t, c }: { saved: TeacherSite["routine"]; t: Website["routine"]; c: Common }) {
  const [state, action] = useActionState(saveRoutineAction, emptyForm);
  const rows = saved ?? [];
  const e = state.errors;
  return (
    <form action={action} className="card flex flex-col gap-4 p-5" noValidate aria-labelledby="routine-title">
      <div>
        <h3 id="routine-title" className="panel-title">
          {t.title}
        </h3>
        <p className="panel-lead">{t.lead}</p>
      </div>
      <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)] gap-3 text-sm font-semibold text-muted sm:grid" aria-hidden="true">
        <span>{t.batch}</span>
        <span>{t.days}</span>
        <span>{t.time}</span>
      </div>
      {Array.from({ length: ROUTINE_SLOTS }, (_, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)] sm:gap-3">
          <input
            name={`batch${i}`}
            className="input"
            aria-label={`${t.batch} ${i + 1}`}
            placeholder={i === 0 ? t.batchPlaceholder : t.batch}
            defaultValue={valueOf(state, `batch${i}`, rows[i]?.batch)}
            aria-invalid={e[`batch${i}`] ? true : undefined}
          />
          <input
            name={`days${i}`}
            className="input"
            aria-label={`${t.days} ${i + 1}`}
            placeholder={i === 0 ? t.daysPlaceholder : t.days}
            defaultValue={valueOf(state, `days${i}`, rows[i]?.days)}
          />
          <input
            name={`time${i}`}
            className="input"
            aria-label={`${t.time} ${i + 1}`}
            placeholder={i === 0 ? t.timePlaceholder : t.time}
            defaultValue={valueOf(state, `time${i}`, rows[i]?.time)}
          />
          {e[`batch${i}`] && <p className="field-error sm:col-span-3">{e[`batch${i}`]}</p>}
        </div>
      ))}
      <Footer state={state} c={c} />
    </form>
  );
}

export function LanguageForm({ current, t, c }: { current: Locale; t: Website["language"]; c: Common }) {
  const [state, action] = useActionState(saveLanguageAction, emptyForm);
  return (
    <form action={action} className="card flex flex-col gap-4 p-5" aria-labelledby="language-title">
      <div>
        <h3 id="language-title" className="panel-title">
          {t.title}
        </h3>
        <p className="panel-lead">{t.lead}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(["bn", "en"] as const).map((locale) => (
          <label key={locale} className="choice" lang={locale}>
            <input type="radio" name="locale" value={locale} defaultChecked={current === locale} />
            <span className="font-semibold">{locale === "bn" ? "বাংলা" : "English"}</span>
          </label>
        ))}
      </div>
      <Footer state={state} c={c} />
    </form>
  );
}

export function AddressForm({ handle, t, c }: { handle: string; t: Website["address"]; c: Common }) {
  const [state, action] = useActionState(changeHandleAction, emptyForm);
  return (
    <form action={action} className="card flex flex-col gap-4 p-5" noValidate aria-labelledby="address-title">
      <div>
        <h3 id="address-title" className="panel-title">
          {t.title}
        </h3>
        <p className="panel-lead">{t.lead}</p>
      </div>
      <Field
        name="handle"
        label={t.title}
        prefix="lecturer.bd/"
        defaultValue={valueOf(state, "handle", handle)}
        error={state.errors.handle}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-ghost" pendingLabel={c.saving}>
          {t.submit}
        </SubmitButton>
        <FormMessages state={state} saved={c.saved} />
      </div>
    </form>
  );
}
