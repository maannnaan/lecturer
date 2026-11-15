import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { toCsv } from "@/lib/student-csv";
import { requireTeacher } from "@/server/auth/current";
import { listBatches } from "@/server/batches";
import { listCourses } from "@/server/courses";
import { getDb } from "@/server/db";
import { batchLabel } from "../text";
import { ImportForm } from "./import-form";

export const instant = false;

export const metadata: Metadata = { title: "CSV থেকে শিক্ষার্থী" };

/** Adding many students at once from a spreadsheet: checked first, added only when every row is right. */
export default async function ImportStudentsPage() {
  const teacher = await requireTeacher();
  const d = getDictionary(await getLocale());
  const t = d.dashboard.students;
  const io = t.io;
  const db = await getDb();
  const [courses, batches] = await Promise.all([listCourses(db, teacher.id), listBatches(db, teacher.id)]);
  // A two-line example with the headings the upload reads, to open in a spreadsheet and fill in.
  const sample = toCsv([
    [t.name, t.phone, t.guardianName, t.guardianPhone, t.institution, t.classLevel, t.address, d.dashboard.requests.roll],
    ["রাহিম উদ্দিন", "01712345678", "করিম উদ্দিন", "01812345678", "ঢাকা কলেজ", "একাদশ", "মিরপুর-১০, ঢাকা", "1"],
  ]);

  return (
    <main className="dash-content max-w-[900px]">
      <Link href="/dashboard/students" className="link text-[15px]">
        <ArrowLeft aria-hidden="true" />
        {t.backToList}
      </Link>
      <header className="page-head">
        <div>
          <h1 className="page-title">{io.importTitle}</h1>
          <p className="page-lead">{io.importLead}</p>
        </div>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(sample)}`} download="students-sample.csv" className="btn btn-ghost btn-sm">
          <Download aria-hidden="true" />
          {io.sample}
        </a>
      </header>
      <ImportForm
        courses={courses.map((course) => ({
          id: course.id,
          title: course.title,
          batches: batches.filter((b) => b.courseId === course.id).map((b) => ({ id: b.id, label: batchLabel(b) })),
        }))}
        t={{
          file: io.file,
          paste: io.paste,
          columns: io.columns,
          enrollIn: io.enrollIn,
          noCourse: io.noCourse,
          batch: d.dashboard.requests.batch,
          noBatch: d.dashboard.requests.noBatch,
          check: io.check,
          run: io.run,
          seeList: io.seeList,
        }}
      />
    </main>
  );
}
