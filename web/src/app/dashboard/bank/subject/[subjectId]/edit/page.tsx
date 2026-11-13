import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Crumbs } from "@/components/bank-ui";
import { PendingButton } from "@/components/form";
import { formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { classKey } from "@/lib/bank-look";
import { subjectNode } from "@/lib/bank-tree";
import { chapterLabel, topicNumber } from "@/lib/chapter-label";
import { requireTeacher } from "@/server/auth/current";
import { getSubject, listBankClasses } from "@/server/bank";
import { getDb } from "@/server/db";
import { bankCounts } from "@/server/questions";
import { deleteBankChapterAction, deleteTopicAction, moveBankChapterAction, moveTopicAction } from "../../../actions";
import { AddChaptersForm, AddTopicsForm, DeleteSubjectForm, EditBankChapterForm, RenameTopicForm, SubjectForm } from "../../../subject-forms";

export const instant = false;

export const metadata: Metadata = { title: "বিষয় সম্পাদনা" };

/**
 * A bank subject's class and name, its chapters and each chapter's sub-chapters (add, rename,
 * reorder, delete), and deleting it. `?chapter=<id>` opens that chapter's panel.
 */
export default async function EditSubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectId: string }>;
  searchParams: Promise<{ chapter?: string }>;
}) {
  const teacher = await requireTeacher();
  const { subjectId } = await params;
  const openChapter = (await searchParams).chapter;
  const db = await getDb();
  const subject = await getSubject(db, teacher.id, subjectId);
  if (!subject) notFound();
  const [counts, classes] = await Promise.all([bankCounts(db, teacher.id), listBankClasses(db, teacher.id)]);
  const questionCount = subjectNode(subject, counts).total;
  const bankClass = classes.find((x) => x.id === subject.classId);
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.bank;
  const autoLabel = (i: number) => d.dashboard.courses.chapters.defaultLabel(formatNumber(i + 1, locale));

  return (
    <main className="dash-content">
      <Crumbs
        className="crumbs !pt-0"
        label={d.common.breadcrumb}
        items={[
          { label: t.title, href: "/dashboard/bank" },
          ...(bankClass ? [{ label: bankClass.name, href: `/dashboard/bank/class/${bankClass.id}` }] : []),
          { label: subject.name, href: `/dashboard/bank/subject/${subject.id}` },
          { label: t.editSubject },
        ]}
      />
      <h1 className="page-title">{t.editSubject}</h1>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="min-w-0">
          <SubjectForm
            subject={{ id: subject.id, classId: subject.classId, group: subject.group, name: subject.name }}
            classes={classes.map((x) => ({ id: x.id, name: x.name, key: classKey(x.name) }))}
            groups={d.bankGroups}
            heading={t.subjectForm.editTitle}
            t={t.subjectForm}
            c={d.common}
          />
        </div>

        <section id="chapters" className="card flex min-w-0 flex-col gap-4 p-5" aria-labelledby="chapters-title">
          <div>
            <h2 id="chapters-title" className="panel-title">
              {t.chaptersEditor.title}
            </h2>
            <p className="panel-lead">{t.chaptersEditor.lead}</p>
          </div>
          {subject.chapters.length === 0 && <p className="text-[15px] text-muted">{t.chaptersEditor.empty}</p>}
          <ol className="flex flex-col gap-2">
            {subject.chapters.map((chapter, i) => (
              <li key={chapter.id} id={`chapter-${chapter.id}`} className="flex scroll-mt-24 items-start gap-2 rounded-lg border border-line p-3">
                <details className="fold min-w-0 flex-1" open={chapter.id === openChapter}>
                  <summary className="cursor-pointer list-none">
                    <span className="block text-[13px] font-semibold text-muted">
                      {chapterLabel(chapter, i, d, locale)}
                      {chapter.topics.length > 0 && ` · ${t.topicCount(formatNumber(chapter.topics.length, locale))}`}
                    </span>
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

                    <section className="flex flex-col gap-3 border-t border-line pt-4" aria-labelledby={`topics-${chapter.id}`}>
                      <div>
                        <h3 id={`topics-${chapter.id}`} className="font-semibold text-ink">
                          {t.chaptersEditor.topics}
                        </h3>
                        <p className="text-[14px] text-muted">{t.chaptersEditor.topicsLead}</p>
                      </div>
                      {chapter.topics.length > 0 && (
                        <ol className="flex flex-col gap-2">
                          {chapter.topics.map((topic, k) => {
                            const number = topicNumber(i, k, locale);
                            return (
                              <li key={topic.id} className="flex flex-wrap items-end gap-2 rounded-lg bg-surface-2 p-2.5">
                                <RenameTopicForm topic={{ id: topic.id, title: topic.title }} number={number} t={t.chaptersEditor} c={d.common} />
                                <div className="row-actions shrink-0">
                                  {(["up", "down"] as const).map((dir) => (
                                    <form key={dir} action={moveTopicAction}>
                                      <input type="hidden" name="topicId" value={topic.id} />
                                      <input type="hidden" name="direction" value={dir} />
                                      <PendingButton
                                        className="icon-btn"
                                        disabled={dir === "up" ? k === 0 : k === chapter.topics.length - 1}
                                        aria-label={`${dir === "up" ? d.common.moveUp : d.common.moveDown}: ${number} ${topic.title}`}
                                      >
                                        {dir === "up" ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                                      </PendingButton>
                                    </form>
                                  ))}
                                  <form action={deleteTopicAction}>
                                    <input type="hidden" name="topicId" value={topic.id} />
                                    <PendingButton className="icon-btn" aria-label={`${d.common.delete}: ${number} ${topic.title}`}>
                                      <Trash2 aria-hidden="true" />
                                    </PendingButton>
                                  </form>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                      <AddTopicsForm chapterId={chapter.id} t={t.chaptersEditor} c={d.common} />
                    </section>
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
