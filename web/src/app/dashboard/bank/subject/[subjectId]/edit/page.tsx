import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Crumbs } from "@/components/bank-ui";
import { PendingButton } from "@/components/form";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { buildBankTree } from "@/lib/bank-tree";
import { chapterLabel } from "@/lib/chapter-label";
import { gradeName, gradeOf } from "@/lib/grades";
import { requireTeacher } from "@/server/auth/current";
import { getSubject } from "@/server/bank";
import { getDb } from "@/server/db";
import { bankCounts } from "@/server/questions";
import { deleteBankChapterAction, moveBankChapterAction } from "../../../actions";
import { AddChaptersForm, DeleteSubjectForm, EditBankChapterForm, SubjectForm } from "../../../subject-forms";

export const instant = false;

export const metadata: Metadata = { title: "বিষয় সম্পাদনা" };

/** A bank subject's class and name, its chapters (add, rename, reorder, delete), and deleting it. */
export default async function EditSubjectPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const teacher = await requireTeacher();
  const { subjectId } = await params;
  const db = await getDb();
  const subject = await getSubject(db, teacher.id, subjectId);
  if (!subject) notFound();
  const questionCount = buildBankTree([subject], await bankCounts(db, teacher.id))[0].subjects[0].total;
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.bank;
  const grade = gradeOf(subject);
  const autoLabel = (i: number) => d.dashboard.courses.chapters.defaultLabel(formatNumber(i + 1, locale));

  return (
    <main className="dash-content">
      <Crumbs
        className="crumbs !pt-0"
        label={d.common.breadcrumb}
        items={[
          { label: t.title, href: "/dashboard/bank" },
          { label: gradeName(grade, d).label, href: `/dashboard/bank/class/${grade}` },
          { label: subject.name, href: `/dashboard/bank/subject/${subject.id}` },
          { label: t.editSubject },
        ]}
      />
      <h2 className="text-2xl">{t.editSubject}</h2>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="min-w-0">
          <SubjectForm
            subject={{ id: subject.id, grade: subject.grade, group: subject.group, name: subject.name }}
            groups={d.bankGroups}
            heading={t.subjectForm.editTitle}
            t={t.subjectForm}
            c={d.common}
            grades={d.grades}
          />
        </div>

        <section id="chapters" className="card flex min-w-0 flex-col gap-4 p-5" aria-labelledby="chapters-title">
          <div>
            <h3 id="chapters-title" className="panel-title">
              {t.chaptersEditor.title}
            </h3>
            <p className="panel-lead">{t.chaptersEditor.lead}</p>
          </div>
          {subject.chapters.length === 0 && <p className="text-[15px] text-muted">{t.chaptersEditor.empty}</p>}
          <ol className="flex flex-col gap-2">
            {subject.chapters.map((chapter, i) => (
              <li key={chapter.id} className="flex items-start gap-2 rounded-lg border border-line p-3">
                <details className="min-w-0 flex-1">
                  <summary className="cursor-pointer list-none">
                    <span className="block text-[13px] font-semibold text-muted">{chapterLabel(chapter, i, d, locale)}</span>
                    <span className="font-semibold text-ink">{chapter.title}</span>
                  </summary>
                  <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
                    <EditBankChapterForm
                      chapter={{ id: chapter.id, number: chapter.number, label: chapter.label, title: chapter.title }}
                      autoLabel={autoLabel(i)}
                      t={t.chaptersEditor}
                      c={d.common}
                    />
                    <form action={deleteBankChapterAction}>
                      <input type="hidden" name="chapterId" value={chapter.id} />
                      <PendingButton className="btn btn-danger btn-xs">
                        <Trash2 aria-hidden="true" />
                        {d.common.delete}
                      </PendingButton>
                    </form>
                  </div>
                </details>
                <div className="row-actions shrink-0">
                  {(["up", "down"] as const).map((dir) => (
                    <form key={dir} action={moveBankChapterAction}>
                      <input type="hidden" name="chapterId" value={chapter.id} />
                      <input type="hidden" name="direction" value={dir} />
                      <PendingButton
                        className="icon-btn"
                        disabled={dir === "up" ? i === 0 : i === subject.chapters.length - 1}
                        aria-label={`${dir === "up" ? d.common.moveUp : d.common.moveDown}: ${chapter.title}`}
                      >
                        {dir === "up" ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                      </PendingButton>
                    </form>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <AddChaptersForm subjectId={subject.id} t={t.chaptersEditor} c={d.common} />
        </section>
      </div>

      <DeleteSubjectForm
        subjectId={subject.id}
        t={{ title: t.removeSubject.title, lead: t.removeSubject.lead(formatNumber(questionCount, locale)), confirm: t.removeSubject.confirm }}
        c={d.common}
      />
    </main>
  );
}
