import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { PendingButton } from "@/components/form";
import { formatDate, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { listBatches } from "@/server/batches";
import { listCourses } from "@/server/courses";
import { getDb } from "@/server/db";
import { listEnrollments } from "@/server/enrollments";
import { findStudent } from "@/server/students";
import { closeEnrollmentAction, removeEnrollmentAction, setStudentStatusAction } from "../actions";
import { DeleteStudentForm, EnrollForm, PlacementForm, StudentForm, StudentPasswordForm } from "../student-forms";
import { batchLabel, placementText, studentFormText } from "../text";

export const instant = false;

export const metadata: Metadata = { title: "শিক্ষার্থী" };

const STATUS_BADGE = { pending: "badge badge-warn", active: "badge badge-ok", rejected: "badge badge-bad", left: "badge" } as const;

/** One student: what is known about them, the courses they are in (batch, roll, fee), their login, and deleting them. */
export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const db = await getDb();
  const student = await findStudent(db, teacher.id, id);
  if (!student) notFound();
  const [enrollments, courses, batches] = await Promise.all([
    listEnrollments(db, teacher.id, { studentId: student.id }),
    listCourses(db, teacher.id),
    listBatches(db, teacher.id),
  ]);
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.students;
  const place = placementText(d);
  const batchesOf = (courseId: string) => batches.filter((b) => b.courseId === courseId).map((b) => ({ id: b.id, label: batchLabel(b) }));
  // Courses the student isn't in yet (or was turned down from, or left): the ones to enrol in.
  const open = courses.filter((course) => !enrollments.some((e) => e.courseId === course.id && (e.status === "active" || e.status === "pending")));

  return (
    <main className="dash-content">
      <Link href="/dashboard/students" className="link text-[15px]">
        <ArrowLeft aria-hidden="true" />
        {t.backToList}
      </Link>
      <header className="page-head">
        <div>
          <h1 className="page-title">{student.name}</h1>
          <p className="page-lead">
            {[student.phone, t.sources[student.source], t.joined(formatDate(student.createdAt, locale))].join(" · ")}
          </p>
        </div>
        {student.status === "inactive" && <span className="badge badge-bad">{t.statuses.inactive}</span>}
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="card flex flex-col gap-4 p-5" aria-labelledby="courses-title">
            <h2 id="courses-title" className="panel-title">
              {t.courses}
            </h2>
            {enrollments.length === 0 && <p className="text-[15px] text-muted">{t.noCourses}</p>}
            <ul className="flex flex-col gap-3">
              {enrollments.map((e) => (
                <li key={e.id} className="flex flex-col gap-3 rounded-lg border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <b className="font-semibold text-ink">{e.courseTitle}</b>
                    <span className={STATUS_BADGE[e.status]}>{t.enrollmentStatuses[e.status]}</span>
                  </div>
                  {e.note && (
                    <p className="text-[14.5px] text-ink-2">
                      <b>{d.dashboard.requests.studentNote}</b> {e.note}
                    </p>
                  )}
                  {(e.status === "active" || e.status === "pending") && (
                    <PlacementForm
                      enrollmentId={e.id}
                      batches={batchesOf(e.courseId)}
                      current={{ batchId: e.batchId, roll: e.roll, fee: e.status === "active" ? e.fee : null }}
                      submit={e.status === "pending" ? d.dashboard.requests.approve : t.savePlace}
                      t={place}
                      c={d.common}
                    />
                  )}
                  <div className="row-actions">
                    {(e.status === "active" || e.status === "pending") && (
                      <form action={closeEnrollmentAction}>
                        <input type="hidden" name="enrollmentId" value={e.id} />
                        <input type="hidden" name="status" value={e.status === "pending" ? "rejected" : "left"} />
                        <PendingButton className="btn btn-ghost btn-xs">{e.status === "pending" ? d.dashboard.requests.reject : t.markLeft}</PendingButton>
                      </form>
                    )}
                    <form action={removeEnrollmentAction}>
                      <input type="hidden" name="enrollmentId" value={e.id} />
                      <PendingButton className="btn btn-danger btn-xs" aria-label={`${d.common.delete}: ${e.courseTitle}`}>
                        <Trash2 aria-hidden="true" />
                        {d.common.delete}
                      </PendingButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
            {open.length > 0 && (
              <div className="field-group">
                <p className="field-group-title">{t.enrollTitle}</p>
                <EnrollForm
                  studentId={student.id}
                  courses={open.map((course) => ({ id: course.id, title: course.title, batches: batchesOf(course.id) }))}
                  t={{ ...place, course: t.course, enroll: t.enroll }}
                  c={d.common}
                />
              </div>
            )}
          </section>

          <section aria-labelledby="details-title" className="flex flex-col gap-3">
            <h2 id="details-title" className="panel-title">
              {t.details}
            </h2>
            <StudentForm student={student} t={studentFormText(d)} c={d.common} />
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section className="card flex flex-col gap-4 p-5" aria-labelledby="login-title">
            <h2 id="login-title" className="panel-title">
              {t.loginTitle}
            </h2>
            {student.status === "inactive" && <p className="form-alert">{t.inactiveNote}</p>}
            <p className="text-[15px] text-ink-2">{student.hasLogin ? t.hasLogin : t.noLogin}</p>
            <StudentPasswordForm studentId={student.id} t={{ newPassword: t.newPassword, passwordHint: t.passwordHint, setPassword: t.setPassword }} c={d.common} />
            <form action={setStudentStatusAction} className="border-t border-line pt-4">
              <input type="hidden" name="studentId" value={student.id} />
              <input type="hidden" name="status" value={student.status === "active" ? "inactive" : "active"} />
              <PendingButton className={student.status === "active" ? "btn btn-danger btn-sm" : "btn btn-primary btn-sm"}>
                {student.status === "active" ? t.deactivate : t.activate}
              </PendingButton>
            </form>
          </section>
          <DeleteStudentForm studentId={student.id} t={t.remove} label={d.common.delete} />
        </div>
      </div>
    </main>
  );
}
