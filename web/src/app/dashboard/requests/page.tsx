import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { PendingButton } from "@/components/form";
import { formatDate, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { listBatches } from "@/server/batches";
import { getDb } from "@/server/db";
import { listEnrollments } from "@/server/enrollments";
import { closeEnrollmentAction } from "../students/actions";
import { PlacementForm } from "../students/student-forms";
import { batchLabel, placementText } from "../students/text";

export const instant = false;

export const metadata: Metadata = { title: "ভর্তির অনুরোধ" };

/** Students who asked to join a course from the website, oldest first: admit each (batch, roll, fee) or decline. */
export default async function RequestsPage() {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.requests;
  const db = await getDb();
  const [requests, batches] = await Promise.all([listEnrollments(db, teacher.id, { status: "pending" }), listBatches(db, teacher.id)]);
  const place = placementText(d);

  return (
    <main className="dash-content max-w-[980px]">
      <header>
        <h1 className="page-title">{t.title}</h1>
        <p className="page-lead">{t.lead}</p>
      </header>

      {requests.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">
            <UserPlus />
          </span>
          <p className="empty-text">{t.empty}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {requests.map((request) => (
            <li key={request.id} className="card flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-ink">{request.studentName}</p>
                  <p className="text-[15px] text-ink-2">
                    {request.studentPhone} · <b className="font-semibold">{request.courseTitle}</b>
                  </p>
                  <p className="text-sm text-muted">{t.asked(formatDate(request.createdAt, locale))}</p>
                </div>
                <Link href={`/dashboard/students/${request.studentId}`} className="link text-[14.5px]">
                  {t.viewStudent}
                </Link>
              </div>
              {request.note && (
                <p className="rounded-md bg-surface-2 p-3 text-[15px] text-ink-2">
                  <b className="text-ink">{t.studentNote}</b> {request.note}
                </p>
              )}
              <PlacementForm
                enrollmentId={request.id}
                batches={batches.filter((b) => b.courseId === request.courseId).map((b) => ({ id: b.id, label: batchLabel(b) }))}
                current={{ batchId: request.batchId, roll: null, fee: null }}
                submit={t.approve}
                t={place}
                c={d.common}
              />
              <form action={closeEnrollmentAction} className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <input type="hidden" name="enrollmentId" value={request.id} />
                <input type="hidden" name="status" value="rejected" />
                <input name="note" className="input !h-10 min-w-0 flex-1 text-[15px]" placeholder={t.rejectNote} aria-label={t.rejectNote} maxLength={300} />
                <PendingButton className="btn btn-danger btn-sm">{t.reject}</PendingButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
