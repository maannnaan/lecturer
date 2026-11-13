import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getCurrentStudent } from "@/server/auth/current";
import { getSite } from "../data";
import { StudentLoginForm } from "../student-forms";

export const instant = false;

export const metadata: Metadata = { robots: { index: false } };

type Props = { params: Promise<{ handle: string }>; searchParams: Promise<{ next?: string }> };

/** A student signs in to this teacher's site. `?next=` is where they were headed. */
export default async function StudentLoginPage({ params, searchParams }: Props) {
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
      <div className="wrap max-w-[520px]">
        <div className="card p-6 sm:p-9">
          <h1 className="text-[clamp(26px,4vw,34px)]">{t.loginTitle}</h1>
          <p className="mt-2 text-ink-2">{t.loginLead}</p>
          <div className="mt-7">
            <StudentLoginForm handle={teacher.handle} next={next} t={{ phone: t.phone, password: t.password, loginButton: t.loginButton, working: t.working }} />
          </div>
          <p className="mt-4 text-[14.5px] text-muted">{t.forgot}</p>
          <p className="mt-6 border-t border-line pt-5 text-[15px] text-ink-2">
            {t.noAccount}{" "}
            <Link href={`/${teacher.handle}/join${query}`} className="link">
              {t.joinTitle}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
