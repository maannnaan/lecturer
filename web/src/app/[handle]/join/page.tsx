import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getCurrentStudent } from "@/server/auth/current";
import { getSite } from "../data";
import { JoinForm } from "../student-forms";

export const instant = false;

export const metadata: Metadata = { robots: { index: false } };

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<{ next?: string }> };

/** A student opens their account on this teacher's site. `?next=` is where they were headed (a course). */
export default async function JoinPage({ params, searchParams }: Props) {
  const site = await getSite((await params).handle.toLowerCase());
  if (!site) notFound();
  const teacher = site.teacher;
  const { next } = await searchParams;
  if (await getCurrentStudent(teacher.id)) redirect(`/${teacher.handle}/me`);
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);
  const t = d.site.student;
  const query = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <main className="section">
      <div className="wrap max-w-[640px]">
        <div className="card p-6 sm:p-9">
          <h1 className="text-[clamp(26px,4vw,34px)]">{t.joinTitle}</h1>
          <p className="mt-2 text-ink-2">{t.joinLead(locale === "bn" ? teacher.nameBn : teacher.nameEn)}</p>
          <div className="mt-7">
            {teacher.status === "approved" ? (
              <JoinForm
                handle={teacher.handle}
                next={next}
                t={{
                  name: t.name,
                  phone: t.phone,
                  password: t.password,
                  passwordHint: t.passwordHint,
                  institution: t.institution,
                  classLevel: t.classLevel,
                  classPlaceholder: t.classPlaceholder,
                  guardianName: t.guardianName,
                  guardianPhone: t.guardianPhone,
                  join: t.join,
                  working: t.working,
                  optional: d.common.optional,
                }}
              />
            ) : (
              <p className="form-alert">{d.site.previewBanner}</p>
            )}
          </div>
          <p className="mt-6 border-t border-line pt-5 text-[15px] text-ink-2">
            {t.haveAccount}{" "}
            <Link href={`/${teacher.handle}/login${query}`} className="link">
              {t.login}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
