import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { QbPrintButton } from "@/components/qbank/auto-print";
import { RichContent } from "@/components/rich-content";
import { type Dictionary, type Locale, formatMarks, formatNumber, getDictionary } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { printSets } from "@/lib/papers";
import { requireTeacher } from "@/server/auth/current";
import { getCourse } from "@/server/courses";
import { getDb } from "@/server/db";
import type { PaperQuestionSnapshot } from "@/server/db/schema";
import { type SetQuestion, getPaper, listPaperQuestions, paperSets } from "@/server/papers";

export const instant = false;

export const metadata: Metadata = { title: "প্রশ্নপত্র ছাপুন", robots: { index: false } };

/** A picture in a question, as the teacher uploaded it. */
function Picture({ url }: { url: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- the teacher's own upload
  return <img src={url} alt="" className="rich-img mt-1" />;
}

function McqItem({ item, number, d, locale }: { item: SetQuestion; number: number; d: Dictionary; locale: Locale }) {
  const { type, body } = item.question;
  return (
    <li className="paper-q">
      <span className="paper-qn">{formatNumber(number, locale)}.</span>
      <div className="min-w-0 flex-1">
        <RichContent value={body.stem} />
        {body.image && <Picture url={body.image.url} />}
        {type === "mcq_multi" && (
          <>
            {(body.statements ?? []).map((statement, k) => (
              <p key={k} className="paper-stmt">
                {d.questions.statementKeys[k]}. <RichContent value={statement} inline />
              </p>
            ))}
            <p className="m-0">{body.prompt || d.questions.defaultPrompt}</p>
          </>
        )}
        <div className="paper-opts">
          {item.optionOrder.map((original, k) => (
            <span key={k}>
              {d.questions.optionKeys[k]}. <RichContent value={(body.options ?? [])[original] ?? ""} inline />
            </span>
          ))}
        </div>
      </div>
    </li>
  );
}

function WrittenItem({ question, number, d, locale }: { question: PaperQuestionSnapshot; number: number; d: Dictionary; locale: Locale }) {
  const { type, body } = question;
  return (
    <li className="paper-q">
      <span className="paper-qn">{formatNumber(number, locale)}.</span>
      <div className="min-w-0 flex-1">
        <RichContent value={body.stem} />
        {body.image && <Picture url={body.image.url} />}
        {type === "creative" &&
          (body.parts ?? []).map((part, k) => (
            <div key={k} className="paper-cq-part">
              <span>{d.questions.partKeys[k]}.</span>
              <div className="min-w-0 flex-1">
                <RichContent value={part.text} />
              </div>
              <span className="shrink-0">{formatNumber(part.marks, locale)}</span>
            </div>
          ))}
      </div>
    </li>
  );
}

/**
 * A paper's sets as they print (`?sets=102` one set, `?sets=101-110` a run of them): each on its
 * own A4 pages, with its set code, its MCQs in its own order in two columns, then the written part.
 */
export default async function PaperPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sets?: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const db = await getDb();
  const paper = await getPaper(db, teacher.id, id);
  if (!paper) notFound();
  // Without a set asked for (or one the paper doesn't have), its first set.
  const codes = printSets((await searchParams).sets, paper) ?? [paper.firstSet];
  const locale = await getLocale();
  const d = getDictionary(locale);
  const t = d.dashboard.papers;
  const s = t.sheet;
  const n = (value: number) => formatNumber(value, locale);

  const [list, course] = await Promise.all([listPaperQuestions(db, teacher.id, paper.id), getCourse(db, teacher.id, paper.courseId)]);
  const sets = paperSets(paper, list, codes);
  const written = list.flatMap((q) => (q.section === "written" && q.question ? [q.question] : []));
  const mcqCount = sets[0]?.mcqs.length ?? 0;
  const header = paper.header;
  const subject = header.subject || course?.title || "";
  const fullMarks = header.fullMarks || (written.length === 0 && mcqCount > 0 ? formatMarks(mcqCount * paper.markHundredths, locale) : "");
  const marking = [
    s.marking(formatMarks(paper.markHundredths, locale)),
    paper.negativeHundredths > 0 && s.negative(formatMarks(paper.negativeHundredths, locale)),
    s.omr,
  ]
    .filter(Boolean)
    .join(" ");
  const label = codes.length === 1 ? t.printSet(n(codes[0])) : t.printRun(n(codes[0]), n(codes[codes.length - 1]));

  return (
    <main className="dash-content print:p-0">
      <div className="flex flex-col gap-3" data-print-hide>
        <Link href={`/dashboard/papers/${paper.id}`} className="link text-[15px]">
          <ArrowLeft aria-hidden="true" />
          {paper.title}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title">
            {t.printTitle}: {label}
          </h1>
          <QbPrintButton label={t.printAgain} className="btn btn-primary btn-sm" />
        </div>
        {paper.status === "draft" && (
          <p className="form-alert" role="status">
            {t.draftBanner}
          </p>
        )}
      </div>

      <div className="paper-sheets">
        {sets.map((set) => (
          <article key={set.code} className="paper-sheet" aria-label={t.printSet(n(set.code))}>
            <header className="paper-head">
              {header.institution && <p className="paper-org">{header.institution}</p>}
              <h2 className="paper-title">{paper.title}</h2>
              {(subject || header.className) && <p className="paper-sub">{[subject, header.className].filter(Boolean).join(" · ")}</p>}
              <div className="paper-meta">
                <span>{header.duration && `${s.time}: ${header.duration}`}</span>
                {header.date && (
                  <span>
                    {s.date}: {header.date}
                  </span>
                )}
                {fullMarks && (
                  <span>
                    {s.fullMarks}: {fullMarks}
                  </span>
                )}
                {mcqCount > 0 && (
                  <span className="paper-set">
                    {s.setCode}: {n(set.code)}
                  </span>
                )}
              </div>
              {header.instructions && <p className="paper-note">{header.instructions}</p>}
            </header>

            {set.mcqs.length > 0 && (
              <section>
                <h3 className="paper-part">{s.mcq}</h3>
                <p className="paper-note">{marking}</p>
                <ol className="paper-cols">
                  {set.mcqs.map((item, i) => (
                    <McqItem key={item.id} item={item} number={i + 1} d={d} locale={locale} />
                  ))}
                </ol>
              </section>
            )}

            {written.length > 0 && (
              <section>
                <h3 className="paper-part">{s.written}</h3>
                <ol className="paper-cols">
                  {written.map((question, i) => (
                    <WrittenItem key={i} question={question} number={i + 1} d={d} locale={locale} />
                  ))}
                </ol>
              </section>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
