import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { StudentForm } from "../student-forms";
import { studentFormText } from "../text";

export const instant = false;

export const metadata: Metadata = { title: "নতুন শিক্ষার্থী" };

/** The teacher adds a student who hasn't joined from the website. */
export default async function NewStudentPage() {
  await requireTeacher();
  const d = getDictionary(await getLocale());
  const t = d.dashboard.students;
  return (
    <main className="dash-content max-w-[860px]">
      <Link href="/dashboard/students" className="link text-[15px]">
        <ArrowLeft aria-hidden="true" />
        {t.backToList}
      </Link>
      <header>
        <h1 className="page-title">{t.newTitle}</h1>
        <p className="page-lead">{t.newLead}</p>
      </header>
      <StudentForm t={studentFormText(d)} c={d.common} />
    </main>
  );
}
