import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { initialOf } from "@/components/logo";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { ThemePicker } from "../theme-picker";
import { PhotoUploader } from "./photo-uploader";
import { AddressForm, ContactForm, HighlightsForm, LanguageForm, ProfileForm, RoutineForm } from "./website-forms";

export const instant = false;

export const metadata: Metadata = { title: "ওয়েবসাইট" };

export default async function WebsiteSettingsPage() {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const w = d.dashboard.website;
  const s = teacher.site;
  const c = { save: d.common.save, saving: d.common.saving, saved: d.common.saved, optional: d.common.optional };

  return (
    <main className="dash-content">
      <header className="page-head">
        <div>
          <h1 className="page-title">{w.title}</h1>
          <p className="page-lead">{w.lead(`lecturer.bd/${teacher.handle}`)}</p>
        </div>
        <Link href={`/${teacher.handle}`} className="btn btn-ghost btn-sm">
          {d.dashboard.status.visit}
          <ExternalLink aria-hidden="true" />
        </Link>
      </header>

      {/* The page's parts, in reach wherever the teacher has scrolled to; each form's heading is its anchor. */}
      <nav className="section-nav" aria-label={w.sections}>
        {(
          [
            ["profile-title", w.profile.title],
            ["photo-title", w.photo.title],
            ["theme-title", d.dashboard.theme.title],
            ["highlights-title", w.highlights.title],
            ["contact-title", w.contact.title],
            ["routine-title", w.routine.title],
            ["language-title", w.language.title],
            ["address-title", w.address.title],
          ] as const
        ).map(([id, label]) => (
          <a key={id} href={`#${id}`} className="chip">
            {label}
          </a>
        ))}
      </nav>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <ProfileForm
            saved={{
              nameBn: teacher.nameBn,
              nameEn: teacher.nameEn,
              subjects: teacher.subjects,
              institution: teacher.institution,
              designation: s.designation,
              location: s.location,
              admission: s.admission,
              tagline: s.tagline,
              about: s.aboutRich ?? s.about,
            }}
            t={w.profile}
            c={c}
            editor={d.editor}
            uploadErrors={{ type: d.errors.uploadType, size: d.errors.uploadSize, unavailable: d.errors.uploadOff }}
          />
          <HighlightsForm saved={{ highlight: s.highlight, stats: s.stats }} t={w.highlights} c={c} />
          <ContactForm saved={s.contact} t={w.contact} c={c} />
          <RoutineForm saved={s.routine} t={w.routine} c={c} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <PhotoUploader
            photoUrl={s.photo?.url ?? null}
            initial={initialOf(teacher.nameBn)}
            t={{ ...w.photo, uploadType: d.errors.uploadType, uploadSize: d.errors.uploadSize, uploadOff: d.errors.uploadOff }}
          />
          <ThemePicker teacher={teacher} t={d.dashboard.theme} stacked />
          <LanguageForm current={teacher.locale} t={w.language} c={c} />
          <AddressForm handle={teacher.handle} t={w.address} c={c} />
        </div>
      </div>
    </main>
  );
}
