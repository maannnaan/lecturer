import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Crumbs } from "@/components/bank-ui";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { classKey } from "@/lib/bank-look";
import { requireTeacher } from "@/server/auth/current";
import { listBankClasses } from "@/server/bank";
import { listCoursesWithChapters } from "@/server/courses";
import { getDb } from "@/server/db";
import { SubjectForm } from "../../subject-forms";

export const instant = false;

export const metadata: Metadata = { title: "নতুন বিষয়" };

/** A new subject for the question bank: its class, name and chapters (typed, pasted or from a course). */
export default async function NewSubjectPage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  const teacher = await requireTeacher();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.bank;
  const { class: asked } = await searchParams;
  const db = await getDb();
  const [classes, courses] = await Promise.all([listBankClasses(db, teacher.id), listCoursesWithChapters(db, teacher.id)]);
  const picked = classes.find((x) => x.id === asked);
  const crumbs = [{ label: t.title, href: "/dashboard/bank" }];
  if (picked) crumbs.push({ label: picked.name, href: `/dashboard/bank/class/${picked.id}` });

  return (
    <main className="dash-content max-w-[820px]">
      <Crumbs className="crumbs !pt-0" label={d.common.breadcrumb} items={[...crumbs, { label: t.newSubject }]} />
      <div>
        <h1 className="page-title">{t.subjectForm.newTitle}</h1>
        <p className="mt-1 text-ink-2">{t.subjectForm.newLead}</p>
      </div>
      {classes.length === 0 ? (
        // Subjects live in classes: the bank starts with one.
        <div className="card flex flex-col items-start gap-3 p-6">
          <p className="text-ink-2">{t.needClass}</p>
          <Link href="/dashboard/bank/class/new" className="btn btn-primary btn-sm">
            <Plus aria-hidden="true" />
            {t.newClass}
          </Link>
        </div>
      ) : (
        <SubjectForm
          classes={classes.map((x) => ({ id: x.id, name: x.name, key: classKey(x.name) }))}
          courses={courses
            .filter((course) => course.chapters.length > 0)
            .map((course) => ({
              id: course.id,
              title: `${course.title} (${d.dashboard.courses.chaptersCount(formatNumber(course.chapters.length, locale))})`,
            }))}
          defaultClassId={picked?.id ?? ""}
          t={t.subjectForm}
          c={d.common}
          groups={d.bankGroups}
        />
      )}
    </main>
  );
}
