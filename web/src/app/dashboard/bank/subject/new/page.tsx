import type { Metadata } from "next";
import { Crumbs } from "@/components/bank-ui";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { gradeName, isGrade } from "@/lib/grades";
import { requireTeacher } from "@/server/auth/current";
import { listCoursesWithChapters } from "@/server/courses";
import { getDb } from "@/server/db";
import { SubjectForm } from "../../subject-forms";

export const instant = false;

export const metadata: Metadata = { title: "নতুন বিষয়" };

/** A new subject for the question bank: class, name and chapters (typed, pasted or from a course). */
export default async function NewSubjectPage({ searchParams }: { searchParams: Promise<{ grade?: string }> }) {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.bank;
  const { grade } = await searchParams;
  const courses = (await listCoursesWithChapters(await getDb(), teacher.id)).filter((course) => course.chapters.length > 0);
  const crumbs = [{ label: t.title, href: "/dashboard/bank" }];
  if (isGrade(grade)) crumbs.push({ label: gradeName(grade, d).label, href: `/dashboard/bank/class/${grade}` });

  return (
    <main className="dash-content max-w-[820px]">
      <Crumbs className="crumbs !pt-0" label={d.common.breadcrumb} items={[...crumbs, { label: t.newSubject }]} />
      <div>
        <h2 className="text-2xl">{t.subjectForm.newTitle}</h2>
        <p className="mt-1 text-ink-2">{t.subjectForm.newLead}</p>
      </div>
      <SubjectForm
        courses={courses.map((course) => ({
          id: course.id,
          title: `${course.title} (${d.dashboard.courses.chaptersCount(formatNumber(course.chapters.length, locale))})`,
        }))}
        defaultGrade={isGrade(grade) ? grade : ""}
        t={t.subjectForm}
        c={d.common}
        grades={d.grades}
        groups={d.bankGroups}
      />
    </main>
  );
}
