import { notFound } from "next/navigation";
import { Building2, Sparkles } from "lucide-react";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getSite } from "./data";

export const instant = false;

// Phase 1 shows who the teacher is; courses, the lesson plan, exams and notices arrive in Phase 2.
export default async function TeacherHomePage({ params }: { params: Promise<{ handle: string }> }) {
  const site = await getSite((await params).handle.toLowerCase());
  if (!site) notFound();
  const teacher = site.teacher;
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);
  const name = locale === "bn" ? teacher.nameBn : teacher.nameEn;

  return (
    <main>
      <section className="border-b border-line" style={{ background: "var(--lb-hero-bg)" }}>
        <div className="wrap py-16 sm:py-24">
          {teacher.subjects && <p className="eyebrow">{teacher.subjects}</p>}
          <h1 className="mt-3 text-[clamp(38px,5.4vw,64px)] leading-[1.12]">{name}</h1>
          {teacher.institution && (
            <p className="mt-4 flex items-center gap-2 text-lg text-ink-2">
              <Building2 className="size-5 text-primary-text" aria-hidden="true" />
              {teacher.institution}
            </p>
          )}
        </div>
      </section>
      <section className="wrap py-14">
        <div className="card flex gap-4 p-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-text">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl">{d.site.comingTitle}</h2>
            <p className="mt-1 text-ink-2">{d.site.comingText}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
