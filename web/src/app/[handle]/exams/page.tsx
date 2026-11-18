import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatDateTime, formatMarks, formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getCurrentStudent } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { listStudentExams, resultVisible } from "@/server/exams";
import { getSite } from "../data";

export const instant = false;

export const metadata: Metadata = { robots: { index: false } };

const STATE_BADGE = { upcoming: "badge badge-primary", open: "badge badge-ok", done: "badge", missed: "badge badge-bad" } as const;

/** The signed-in student's exams: those open now first, then those to come, then the past ones with their marks. */
export default async function StudentExamsPage({ params }: { params: Promise<{ handle: string }> }) {
  const site = await getSite((await params).handle.toLowerCase());
  if (!site) notFound();
  const teacher = site.teacher;
  const student = await getCurrentStudent(teacher.id);
  if (!student) redirect(`/${teacher.handle}/login`);
  const locale = await getLocale(teacher.locale);
  const d = getDictionary(locale);
  const t = d.site.student;
  const home = `/${teacher.handle}`;
  const now = new Date();
  const n = (value: number) => formatNumber(value, locale);

  const exams = (await listStudentExams(await getDb(), teacher.id, student.id, now)).map((exam) => {
    const state: keyof typeof STATE_BADGE = exam.attempt?.submittedAt ? "done" : now < exam.startsAt ? "upcoming" : now < exam.endsAt ? "open" : exam.attempt ? "done" : "missed";
    return { ...exam, state };
  });
  const order = { open: 0, upcoming: 1, done: 2, missed: 3 } as const;
  exams.sort((a, b) => order[a.state] - order[b.state] || (a.state === "upcoming" ? a.startsAt.getTime() - b.startsAt.getTime() : 0));

  return (
    <main className="section">
      <div className="wrap flex max-w-[860px] flex-col gap-6">
        <Link href={`${home}/me`} className="link text-[15px]">
          <ArrowLeft aria-hidden="true" />
          {t.backToMe}
        </Link>
        <header>
          <h1 className="text-[clamp(26px,4vw,36px)]">{t.exams}</h1>
          <p className="mt-2 text-ink-2">{t.examsLead}</p>
        </header>
        {exams.length === 0 ? (
          <p className="card p-6 text-ink-2">{t.noExams}</p>
        ) : (
          <ul className="card divide-y divide-line">
            {exams.map((exam) => (
              <li key={exam.id}>
                <Link href={`${home}/exams/${exam.number}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <b className="block font-semibold text-ink">{exam.title}</b>
                    <span className="block text-[14px] text-ink-2">{exam.courseTitle}</span>
                    <span className="block text-[13.5px] text-muted">
                      {exam.state === "upcoming" ? t.opensAt(formatDateTime(exam.startsAt, locale)) : t.closesAt(formatDateTime(exam.endsAt, locale))} ·{" "}
                      {t.examFacts(n(exam.questionCount), n(exam.durationMin))}
                    </span>
                  </span>
                  {exam.state === "done" && resultVisible(exam, exam.attempt, now) && exam.attempt?.scoreHundredths !== null ? (
                    <b className="font-num text-[19px] text-ink">
                      {d.dashboard.exams.outOf(formatMarks(exam.attempt!.scoreHundredths!, locale), formatMarks(exam.questionCount * exam.markHundredths, locale))}
                    </b>
                  ) : (
                    <span className={STATE_BADGE[exam.state]}>{t.examStates[exam.state]}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
