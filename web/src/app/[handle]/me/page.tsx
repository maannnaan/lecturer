import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, LogOut } from "lucide-react";
import { PendingButton } from "@/components/form";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getCurrentStudent } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { listEnrollments } from "@/server/enrollments";
import { getSite } from "../data";
import { logoutStudentAction } from "../student-actions";
import { ChangePasswordForm } from "../student-forms";

export const instant = false;

export const metadata: Metadata = { robots: { index: false } };

const STATUS_BADGE = { pending: "badge badge-warn", active: "badge badge-ok", rejected: "badge badge-bad", left: "badge" } as const;

/** The signed-in student's own page on this teacher's site: their courses and where each stands, and their account. */
export default async function StudentHomePage({ params }: { params: Promise<{ handle: string }> }) {
  const site = await getSite((await params).handle.toLowerCase());
  if (!site) notFound();
  const teacher = site.teacher;
  const student = await getCurrentStudent(teacher.id);
  if (!student) redirect(`/${teacher.handle}/login`);
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);
  const t = d.site.student;
  const home = `/${teacher.handle}`;
  const enrollments = await listEnrollments(await getDb(), teacher.id, { studentId: student.id });
  const details = [
    [t.phone, student.phone],
    [t.institution, student.institution],
    [t.classLevel, student.classLevel],
    [t.guardianName, student.guardianName],
    [t.guardianPhone, student.guardianPhone],
  ].filter(([, value]) => value);

  return (
    <main className="section">
      <div className="wrap flex max-w-[900px] flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{locale === "bn" ? teacher.nameBn : teacher.nameEn}</p>
            <h1 className="mt-1 text-[clamp(26px,4vw,36px)]">{t.hello(student.name)}</h1>
          </div>
          <form action={logoutStudentAction}>
            <input type="hidden" name="handle" value={teacher.handle} />
            <PendingButton className="btn btn-ghost btn-sm">
              <LogOut aria-hidden="true" />
              {t.logout}
            </PendingButton>
          </form>
        </header>

        <section className="card p-5 sm:p-6" aria-labelledby="my-courses">
          <h2 id="my-courses" className="text-xl">
            {t.myCourses}
          </h2>
          {enrollments.length === 0 ? (
            <div className="mt-3 flex flex-col items-start gap-3">
              <p className="text-ink-2">{t.noCourses}</p>
              <Link href={`${home}#courses`} className="btn btn-primary btn-sm">
                {t.browse}
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {enrollments.map((enrollment) => (
                <li key={enrollment.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
                  <div className="min-w-0 flex-1">
                    <Link href={`${home}/courses/${enrollment.courseNumber}`} className="text-[17px] font-semibold text-ink">
                      {enrollment.courseTitle}
                    </Link>
                    <p className="text-[14.5px] text-muted">
                      {[
                        enrollment.batchName && `${t.batch}: ${enrollment.batchName}`,
                        enrollment.status === "active" && enrollment.roll && `${t.roll}: ${formatNumber(Number(enrollment.roll), locale)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {enrollment.decisionNote && (
                      <p className="mt-1 text-[14.5px] text-ink-2">
                        <b>{t.teacherSays}</b> {enrollment.decisionNote}
                      </p>
                    )}
                  </div>
                  <span className={STATUS_BADGE[enrollment.status]}>{t.statuses[enrollment.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid items-start gap-6 md:grid-cols-2">
          <section className="card p-5 sm:p-6" aria-labelledby="my-details">
            <h2 id="my-details" className="text-xl">
              {t.profile}
            </h2>
            <dl className="mt-3 flex flex-col">
              {details.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-t border-line py-2.5 text-[15px] first:border-t-0">
                  <dt className="text-muted">{label}</dt>
                  <dd className="min-w-0 text-right font-medium break-words text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="card p-5 sm:p-6" aria-labelledby="my-password">
            <h2 id="my-password" className="mb-4 text-xl">
              {t.changePassword}
            </h2>
            <ChangePasswordForm
              handle={teacher.handle}
              t={{
                currentPassword: t.currentPassword,
                newPassword: t.newPassword,
                passwordHint: t.passwordHint,
                changePassword: t.changePassword,
                working: t.working,
                saved: d.common.saved,
              }}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
