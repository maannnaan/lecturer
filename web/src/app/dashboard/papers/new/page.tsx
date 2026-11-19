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
import { PaperForm } from "../paper-forms";
import { newPaperDefaults, paperFormText } from "../text";

export const instant = false;

export const metadata: Metadata = { title: "নতুন প্রশ্নপত্র" };

/** A new paper's details; its questions are chosen on the next page. */
export default async function NewPaperPage() {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.papers;
  const db = await getDb();
  const [courses, batches] = await Promise.all([listCourses(db, teacher.id), listBatches(db, teacher.id)]);

  return (
    <main className="dash-content max-w-[860px]">
      <Link href="/dashboard/papers" className="link text-[15px]">
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
        <PaperForm
          defaults={newPaperDefaults(courses[0].id, locale === "bn" ? teacher.nameBn : teacher.nameEn)}
          courses={courses.map((course) => ({
            id: course.id,
            title: course.title,
            batches: batches.filter((b) => b.courseId === course.id).map((b) => ({ id: b.id, label: batchLabel(b) })),
          }))}
          t={paperFormText(d, locale)}
          c={d.common}
        />
      )}
    </main>
  );
}
