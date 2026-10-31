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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl">{w.title}</h2>
          <p className="mt-1 text-ink-2">{w.lead(`lecturer.bd/${teacher.handle}`)}</p>
        </div>
        <Link href={`/${teacher.handle}`} className="btn btn-ghost btn-sm">
          {d.dashboard.status.visit}
          <ExternalLink aria-hidden="true" />
        </Link>
      </header>

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
              about: s.about,
            }}
            t={w.profile}
            c={c}
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
