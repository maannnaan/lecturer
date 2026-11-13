import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { QbPrintButton } from "@/components/qbank/auto-print";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { getBatch } from "@/server/batches";
import { getCourse } from "@/server/courses";
import { getDb } from "@/server/db";
import { listEnrollments } from "@/server/enrollments";
import { findStudent } from "@/server/students";

export const instant = false;

export const metadata: Metadata = { title: "ব্যাচের তালিকা" };

/** A batch's students by roll, as a list to read or print (an attendance sheet, a seat plan). */
export default async function BatchRosterPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const db = await getDb();
  const batch = await getBatch(db, teacher.id, id);
  if (!batch) notFound();
  const [course, enrollments] = await Promise.all([
    getCourse(db, teacher.id, batch.courseId),
    listEnrollments(db, teacher.id, { status: "active", batchId: batch.id }),
  ]);
  const students = await Promise.all(enrollments.map((e) => findStudent(db, teacher.id, e.studentId)));
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.batches;
  const s = d.dashboard.students;

  return (
    <main className="dash-content max-w-[980px]">
      <div className="flex flex-wrap items-center justify-between gap-3" data-print-hide>
        <Link href="/dashboard/batches" className="link text-[15px]">
          <ArrowLeft aria-hidden="true" />
          {t.backToList}
        </Link>
        {enrollments.length > 0 && <QbPrintButton label={t.print} className="btn btn-ghost btn-sm" />}
      </div>
      <header>
        <h1 className="page-title">
          {course?.title} · {batch.name}
        </h1>
        <p className="page-lead">{[batch.schedule, t.students(formatNumber(enrollments.length, locale))].filter(Boolean).join(" · ")}</p>
      </header>

      {enrollments.length === 0 ? (
        <p className="card p-6 text-ink-2">{t.rosterEmpty}</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="routine roster">
            <thead>
              <tr>
                <th scope="col">{t.roll}</th>
                <th scope="col">{s.name}</th>
                <th scope="col">{s.phone}</th>
                <th scope="col">{t.guardian}</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e, i) => (
                <tr key={e.id}>
                  <td>{e.roll ? formatNumber(Number(e.roll), locale) : "—"}</td>
                  <td>
                    <Link href={`/dashboard/students/${e.studentId}`} className="tl-link">
                      {e.studentName}
                    </Link>
                  </td>
                  <td>{e.studentPhone}</td>
                  <td>{[students[i]?.guardianName, students[i]?.guardianPhone].filter(Boolean).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
