import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { listBatches } from "@/server/batches";
import { listCourses } from "@/server/courses";
import { getDb } from "@/server/db";
import { batchLabel } from "../../students/text";
import { ExamForm } from "../exam-forms";
import { examFormText, newExamDefaults } from "../text";

export const instant = false;

export const metadata: Metadata = { title: "নতুন পরীক্ষা" };

/** A new exam's settings; its questions are chosen on the next page. */
export default async function NewExamPage() {
  const teacher = await requireTeacher();
  const d = getDictionary(await getLocale());
  const t = d.dashboard.exams;
  const db = await getDb();
  const [courses, batches] = await Promise.all([listCourses(db, teacher.id), listBatches(db, teacher.id)]);

  return (
    <main className="dash-content max-w-[860px]">
      <Link href="/dashboard/exams" className="link text-[15px]">
        <ArrowLeft aria-hidden="true" />
        {t.backToList}
      </Link>
      <header>
        <h1 className="page-title">{t.new}</h1>
        <p className="page-lead">{t.lead}</p>
      </header>
      {courses.length === 0 ? (
        <p className="card p-6 text-ink-2">{t.noCourses}</p>
      ) : (
        <ExamForm
          defaults={newExamDefaults(courses[0].id)}
          courses={courses.map((course) => ({
            id: course.id,
            title: course.title,
            batches: batches.filter((b) => b.courseId === course.id).map((b) => ({ id: b.id, label: batchLabel(b) })),
          }))}
          t={examFormText(d)}
          c={d.common}
        />
      )}
    </main>
  );
}
