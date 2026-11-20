import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, LogOut, Radio } from "lucide-react";
import { PendingButton } from "@/components/form";
import { paymentFor } from "@/components/receipt";
import { formatDate, formatMarks, formatNumber, formatTaka, formatYear, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getCurrentStudent } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { listEnrollments } from "@/server/enrollments";
import { listStudentPaperResults } from "@/server/paper-results";
import { listDues, listPayments } from "@/server/payments";
import { getSite } from "../data";
import { logoutStudentAction } from "../student-actions";
import { ChangePasswordForm } from "../student-forms";

export const instant = false;

export const metadata: Metadata = { robots: { index: false } };

const STATUS_BADGE = { pending: "badge badge-warn", active: "badge badge-ok", rejected: "badge badge-bad", left: "badge" } as const;

/** The signed-in student's own page on this teacher's site: their courses and where each stands, and their account. */
export default async function StudentHomePage({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<{ paid?: string }> }) {
  const site = await getSite((await params).handle.toLowerCase());
  if (!site) notFound();
  const teacher = site.teacher;
  const student = await getCurrentStudent(teacher.id);
  if (!student) redirect(`/${teacher.handle}/login`);
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);
  const t = d.site.student;
  const home = `/${teacher.handle}`;
  const db = await getDb();
  const [enrollments, dues, payments, results] = await Promise.all([
    listEnrollments(db, teacher.id, { studentId: student.id }),
    listDues(db, teacher.id, { studentId: student.id, all: true }),
    listPayments(db, teacher.id, { studentId: student.id, limit: 30 }),
    listStudentPaperResults(db, teacher.id, student.id),
  ]);
  const marks = (hundredths: number) => formatMarks(hundredths, locale);
  const dueOf = new Map(dues.map((due) => [due.enrollmentId, due]));
  const p = d.dashboard.payments;
  const justPaid = Boolean((await searchParams).paid);
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
          <div className="flex flex-wrap gap-2">
            {enrollments.some((e) => e.status === "active") && (
              <Link href={`${home}/exams`} className="btn btn-primary btn-sm">
                <Radio aria-hidden="true" />
                {t.exams}
              </Link>
            )}
            <form action={logoutStudentAction}>
              <input type="hidden" name="handle" value={teacher.handle} />
              <PendingButton className="btn btn-ghost btn-sm">
                <LogOut aria-hidden="true" />
                {t.logout}
              </PendingButton>
            </form>
          </div>
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
                  {/* What is owed in this course, and the way to pay it (or ahead). */}
                  {(() => {
                    const due = dueOf.get(enrollment.id);
                    if (!due || due.fee <= 0) return null;
                    return (
                      <div className="flex basis-full flex-wrap items-center gap-3">
                        <span className={due.amount > 0 ? "font-semibold text-bad" : "text-[14.5px] text-muted"}>
                          {due.amount > 0 ? t.dues(formatTaka(due.amount, locale)) : t.noDues}
                        </span>
                        {due.payable.length > 0 && (
                          <Link href={`${home}/me/pay?e=${enrollment.id}`} className={due.amount > 0 ? "btn btn-primary btn-xs" : "btn btn-ghost btn-xs"}>
                            {t.pay}
                          </Link>
                        )}
                      </div>
                    );
                  })()}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Results of the teacher's papers, once the teacher has published them. */}
        {results.length > 0 && (
          <section className="card p-5 sm:p-6" aria-labelledby="my-results">
            <h2 id="my-results" className="text-xl">
              {t.myResults}
            </h2>
            <ul className="mt-2 divide-y divide-line">
              {results.map((result) => (
                <li key={result.paperId} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{result.title}</p>
                    <p className="text-[14px] text-muted">
                      {t.resultFacts(formatYear(result.setCode, locale), formatNumber(result.rank, locale), formatNumber(result.of, locale))}
                    </p>
                    <p className="text-[14px] text-ink-2">
                      {[
                        t.mcqMarks(marks(result.scoreHundredths), marks(result.mcqTotalHundredths)),
                        result.writtenHundredths !== null && t.writtenMarks(marks(result.writtenHundredths)),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <b className="font-num text-[19px] text-ink">{t.totalMarks(marks(result.totalHundredths))}</b>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card p-5 sm:p-6" aria-labelledby="my-payments">
          <h2 id="my-payments" className="text-xl">
            {t.history}
          </h2>
          {justPaid && (
            <p className="form-ok mt-3" role="status">
              {t.payDone}
            </p>
          )}
          {payments.length === 0 ? (
            <p className="mt-3 text-ink-2">{t.noHistory}</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {payments.map((payment) => (
                <li key={payment.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{paymentFor(payment, d, locale)}</p>
                    <p className="text-[14px] text-muted">
                      {[formatDate(payment.paidAt, locale), p.methods[payment.method], payment.txnId].filter(Boolean).join(" · ")}
                    </p>
                    {payment.status === "rejected" && payment.note && (
                      <p className="text-[14.5px] text-ink-2">
                        <b>{t.rejectedWhy}</b> {payment.note}
                      </p>
                    )}
                  </div>
                  <b className="font-num text-[18px] text-ink">{formatTaka(payment.amount, locale)}</b>
                  {payment.status === "verified" ? (
                    <Link href={`${home}/me/receipt/${payment.id}`} className="btn btn-ghost btn-xs">
                      {t.receipt}
                    </Link>
                  ) : (
                    <span className={payment.status === "pending" ? "badge badge-warn" : "badge badge-bad"}>{p.statuses[payment.status]}</span>
                  )}
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
