import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3, ChevronDown, ChevronUp, Eye, KeyRound, Lock, LockOpen, Printer, Trash2 } from "lucide-react";
import { PendingButton } from "@/components/form";
import { QuestionPicker } from "@/components/question-picker";
import { RichContent } from "@/components/rich-content";
import { boardTag } from "@/components/qbank/views";
import { type Dictionary, type Locale, formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { chapterLabel } from "@/lib/chapter-label";
import { printRuns, setCodes } from "@/lib/papers";
import { SECTION_TABS, type SectionTab } from "@/lib/questions";
import { requireTeacher } from "@/server/auth/current";
import { listSubjectsWithChapters } from "@/server/bank";
import { listBatches } from "@/server/batches";
import { listCourses } from "@/server/courses";
import { getDb } from "@/server/db";
import { type PaperQuestion, getPaper, hasResults, listPaperQuestions } from "@/server/papers";
import { listChapterQuestions } from "@/server/questions";
import { batchLabel } from "../../students/text";
import { addPaperQuestionsAction, finalizePaperAction, movePaperQuestionAction, removePaperQuestionAction } from "../actions";
import { DeletePaperForm, PaperForm } from "../paper-forms";
import { STATUS_BADGE, paperFormText, paperValues } from "../text";

export const instant = false;

export const metadata: Metadata = { title: "প্রশ্নপত্র" };

type Search = Promise<{ s?: string; c?: string; k?: string }>;

/** One part of the paper (its MCQs, or its written questions), in order, with moving and removing while it is a draft. */
function PartList({ items, final, d, locale }: { items: PaperQuestion[]; final: boolean; d: Dictionary; locale: Locale }) {
  const t = d.dashboard.papers;
  const n = (value: number) => formatNumber(value, locale);
  return (
    <ol className="flex flex-col gap-2">
      {items.map((q, i) => (
        <li key={q.id} className="flex items-start gap-3 rounded-lg border border-line p-3">
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-[13px] font-bold text-ink-2">{n(i + 1)}</span>
          <div className="min-w-0 flex-1">
            <div className="line-clamp-3 text-[15px] text-ink">{q.question ? <RichContent value={q.question.body.stem} /> : "—"}</div>
            {q.question && q.section === "written" && <span className="mt-1 block text-[13px] text-muted">{d.questions.types[q.question.type]}</span>}
          </div>
          {!final && (
            <div className="row-actions shrink-0">
              {(["up", "down"] as const).map((dir) => (
                <form key={dir} action={movePaperQuestionAction}>
                  <input type="hidden" name="paperQuestionId" value={q.id} />
                  <input type="hidden" name="direction" value={dir} />
                  <PendingButton
                    className="icon-btn"
                    disabled={dir === "up" ? i === 0 : i === items.length - 1}
                    aria-label={`${dir === "up" ? d.common.moveUp : d.common.moveDown}: ${n(i + 1)}`}
                  >
                    {dir === "up" ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                  </PendingButton>
                </form>
              ))}
              <form action={removePaperQuestionAction}>
                <input type="hidden" name="paperQuestionId" value={q.id} />
                <PendingButton className="icon-btn" aria-label={`${t.remove}: ${n(i + 1)}`}>
                  <Trash2 aria-hidden="true" />
                </PendingButton>
              </form>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * One paper: making it final, its MCQs and its written part (and adding more from the bank:
 * `?s=<subject>&c=<chapter>&k=<type>` picks what to choose from), printing its sets and answer
 * keys, its details, and deleting it.
 */
export default async function PaperPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const db = await getDb();
  const paper = await getPaper(db, teacher.id, id);
  if (!paper) notFound();
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.papers;
  const n = (value: number) => formatNumber(value, locale);
  const s = await searchParams;

  const [list, subjects, courses, batches] = await Promise.all([
    listPaperQuestions(db, teacher.id, paper.id),
    listSubjectsWithChapters(db, teacher.id),
    listCourses(db, teacher.id),
    listBatches(db, teacher.id),
  ]);
  const final = paper.status === "final";
  // Once answer sheets are in, the paper stays final.
  const resulted = final && (await hasResults(db, paper.id));
  const mcqs = list.filter((q) => q.section === "mcq");
  const written = list.filter((q) => q.section === "written");

  // What to choose from: the subject, chapter and type asked for, else the first chapter's MCQs.
  const subject = subjects.find((x) => x.id === s.s) ?? subjects.find((x) => x.chapters.length > 0) ?? subjects[0];
  const chapter = subject?.chapters.find((x) => x.id === s.c) ?? subject?.chapters[0];
  const kind: SectionTab = (SECTION_TABS as readonly string[]).includes(s.k ?? "") ? (s.k as SectionTab) : "mcq";
  const onPaper = new Set(list.map((q) => q.questionId));
  const bank =
    subject && chapter && !final
      ? (await listChapterQuestions(db, teacher.id, { subjectId: subject.id, chapterId: chapter.id }, { tab: kind, includePrivate: true, pageSize: 200 })).items
      : [];
  const codes = setCodes(paper);
  const base = `/dashboard/papers/${paper.id}`;

  return (
    <main className="dash-content">
      <Link href="/dashboard/papers" className="link text-[15px]">
        <ArrowLeft aria-hidden="true" />
        {t.backToList}
      </Link>
      <header className="page-head">
        <div className="min-w-0">
          <h1 className="page-title">{paper.title}</h1>
          <p className="page-lead flex flex-wrap items-center gap-2">
            <span className={STATUS_BADGE[paper.status]}>{t.statuses[paper.status]}</span>
            {[t.mcqCount(n(mcqs.length)), written.length > 0 && t.writtenCount(n(written.length)), t.setCount(n(paper.setCount))].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {final && (
            <Link href={`${base}/results`} className="btn btn-primary btn-sm">
              <BarChart3 aria-hidden="true" />
              {t.results.title}
            </Link>
          )}
          {!resulted && (
            <form action={finalizePaperAction}>
              <input type="hidden" name="paperId" value={paper.id} />
              {final ? (
                <>
                  <input type="hidden" name="reopen" value="1" />
                  <PendingButton className="btn btn-ghost btn-sm">
                    <LockOpen aria-hidden="true" />
                    {t.reopen}
                  </PendingButton>
                </>
              ) : (
                <PendingButton className="btn btn-primary btn-sm" disabled={list.length === 0}>
                  <Lock aria-hidden="true" />
                  {t.finalize}
                </PendingButton>
              )}
            </form>
          )}
        </div>
      </header>
      <p className={final ? "form-ok" : "text-[15px] text-ink-2"} role="status">
        {final ? (resulted ? `${t.finalNote} ${t.results.lockedNote}` : t.finalNote) : list.length === 0 ? t.needQuestions : t.draftHint}
      </p>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="card flex flex-col gap-4 p-5" aria-labelledby="mcq-title">
            <div>
              <h2 id="mcq-title" className="panel-title">
                {t.mcqTitle}
              </h2>
              <p className="panel-lead">{t.mcqLead}</p>
            </div>
            {mcqs.length === 0 ? <p className="text-[15px] text-muted">{t.noMcqs}</p> : <PartList items={mcqs} final={final} d={d} locale={locale} />}
          </section>

          <section className="card flex flex-col gap-4 p-5" aria-labelledby="written-title">
            <div>
              <h2 id="written-title" className="panel-title">
                {t.writtenTitle}
              </h2>
              <p className="panel-lead">{t.writtenLead}</p>
            </div>
            {written.length === 0 ? <p className="text-[15px] text-muted">{t.noWritten}</p> : <PartList items={written} final={final} d={d} locale={locale} />}
          </section>

          {final ? (
            <p className="text-[15px] text-ink-2">{t.lockedNote}</p>
          ) : (
            subject && (
              <section className="card flex flex-col gap-4 p-5" aria-labelledby="bank-title">
                <h2 id="bank-title" className="panel-title">
                  {t.fromBank}
                </h2>
                {/* What to choose from: a plain form, so the address carries it. */}
                <form className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto]">
                  <div className="field">
                    <label className="field-label" htmlFor="s">
                      {t.subject}
                    </label>
                    <select id="s" name="s" className="input" defaultValue={subject.id}>
                      {subjects.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="c">
                      {t.chapter}
                    </label>
                    <select id="c" name="c" className="input" defaultValue={chapter?.id ?? ""}>
                      {subject.chapters.map((x, i) => (
                        <option key={x.id} value={x.id}>
                          {`${chapterLabel(x, i, d, locale)}: ${x.title}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="k">
                      {t.kind}
                    </label>
                    <select id="k" name="k" className="input" defaultValue={kind}>
                      {(["mcq", "cq", "sq", "textbook", "practice"] as const).map((tab) => (
                        <option key={tab} value={tab}>
                          {d.questions.tabs[tab]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="btn btn-ghost">
                    <Eye aria-hidden="true" />
                    {t.show}
                  </button>
                </form>
                {chapter && (
                  <QuestionPicker
                    key={`${chapter.id}:${kind}`}
                    action={addPaperQuestionsAction}
                    hidden={{ paperId: paper.id, subjectId: subject.id, chapterId: chapter.id, tab: kind }}
                    items={bank.map((q) => ({
                      id: q.id,
                      stem: <RichContent value={q.body.stem} />,
                      tags: [d.questions.types[q.type], q.board ? boardTag(q, d, locale) : q.source].filter(Boolean).join(" · "),
                      added: onPaper.has(q.id),
                    }))}
                    t={{
                      pickHint: t.pickHint,
                      add: t.add,
                      already: t.already,
                      none: t.noneHere,
                      randomCount: t.randomCount,
                      addRandom: t.addRandom,
                      saving: d.common.saving,
                    }}
                  />
                )}
              </section>
            )
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {list.length > 0 && (
            <section className="card flex flex-col gap-3 p-5" aria-labelledby="print-title">
              <div>
                <h2 id="print-title" className="panel-title">
                  {t.printTitle}
                </h2>
                <p className="panel-lead">{t.printLead}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {printRuns(paper).map((run) => (
                  <Link key={run.from} href={`${base}/print?sets=${run.from}-${run.to}`} className="btn btn-primary btn-sm">
                    <Printer aria-hidden="true" />
                    {run.from === run.to ? t.printSet(n(run.from)) : t.printRun(n(run.from), n(run.to))}
                  </Link>
                ))}
                {mcqs.length > 0 && (
                  <Link href={`${base}/key`} className="btn btn-ghost btn-sm">
                    <KeyRound aria-hidden="true" />
                    {t.key}
                  </Link>
                )}
              </div>
              {codes.length > 1 && (
                <form action={`${base}/print`} className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
                  <div className="field w-36">
                    <label className="field-label" htmlFor="print-set">
                      {t.printOne}
                    </label>
                    <select id="print-set" name="sets" className="input">
                      {codes.map((code) => (
                        <option key={code} value={code}>
                          {n(code)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="btn btn-ghost">
                    <Printer aria-hidden="true" />
                    {t.printGo}
                  </button>
                </form>
              )}
            </section>
          )}
          <section aria-labelledby="settings-title" className="flex flex-col gap-3">
            <h2 id="settings-title" className="panel-title">
              {t.settings}
            </h2>
            <PaperForm
              paper={paperValues(paper)}
              defaults={paperValues(paper)}
              locked={final}
              audienceLocked={resulted}
              courses={courses.map((course) => ({
                id: course.id,
                title: course.title,
                batches: batches.filter((b) => b.courseId === course.id).map((b) => ({ id: b.id, label: batchLabel(b) })),
              }))}
              t={paperFormText(d, locale)}
              c={d.common}
            />
          </section>
          <DeletePaperForm paperId={paper.id} t={t.delete} label={d.common.delete} />
        </div>
      </div>
    </main>
  );
}
