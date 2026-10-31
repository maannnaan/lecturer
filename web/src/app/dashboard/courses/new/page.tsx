import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { requireTeacher } from "@/server/auth/current";
import { CourseForm } from "../course-forms";

export const instant = false;

export const metadata: Metadata = { title: "নতুন কোর্স" };

export default async function NewCoursePage() {
  await requireTeacher();
  const d = getDictionary(await getLocale());
  const t = d.dashboard.courses;
  return (
    <main className="dash-content max-w-[820px]">
      <Link href="/dashboard/courses" className="link text-[15px]">
        <ArrowLeft aria-hidden="true" />
        {t.backToList}
      </Link>
      <h2 className="text-2xl">{t.newTitle}</h2>
      <CourseForm t={t.form} c={d.common} />
    </main>
  );
}
