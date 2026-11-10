import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { button, SubjectIcon } from "@/components/ui";
import { cx } from "@/lib/cx";
import { allSubjects, chapterCounts, chaptersOfSubject, getClass, getSubject } from "@/lib/data";
import { classLabel, groupLabel, plural } from "@/lib/format";
import { classHref, questionsHref, subjectSlug } from "@/lib/routes";
import { ChapterList, type ChapterRow } from "./chapter-list";

// Every subject page is built ahead of time; any other address is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return allSubjects().map((s) => ({ classId: s.classId, subjectId: subjectSlug(s) }));
}

export async function generateMetadata({ params }: PageProps<"/class/[classId]/[subjectId]">): Promise<Metadata> {
  const { classId, subjectId } = await params;
  const cls = getClass(classId);
  const subject = getSubject(classId, subjectId);
  return cls && subject ? { title: `${subject.nameEn} · ${classLabel(cls)} — Chapters` } : {};
}

export default async function SubjectPage({ params }: PageProps<"/class/[classId]/[subjectId]">) {
  const { classId, subjectId } = await params;
  const cls = getClass(classId);
  const subject = getSubject(classId, subjectId);
  if (!cls || !subject) notFound();

  const rows: ChapterRow[] = chaptersOfSubject(subject.id).map((ch) => ({
    id: ch.id,
    no: ch.no,
    titleEn: ch.titleEn,
    titleBn: ch.titleBn,
    counts: chapterCounts(ch.id),
  }));
  const hasBoard = rows.some((r) => r.counts.board > 0);
  const hasMcq = rows.some((r) => r.counts.mcq > 0);
  const slug = subjectSlug(subject);

  const facts = [
    classLabel(cls),
    cls.groups.length > 1 ? groupLabel(subject.group) : null,
    rows.length > 0 ? plural(rows.length, "chapter") : null,
  ].filter(Boolean);

  return (
    <main id="main" className="w-full">
      <div className="border-b border-line bg-surface">
        <div className="page-x flex flex-col gap-5 pt-7 pb-8">
          <Breadcrumbs
            items={[{ label: "Home", href: "/" }, { label: classLabel(cls), href: classHref(cls.id) }, { label: subject.nameEn }]}
          />
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-[18px]">
              <SubjectIcon subject={subject} size="lg" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <h1 className="m-0 font-display text-[clamp(30px,7vw,40px)] leading-[1.1] font-bold tracking-[-0.03em]">
                  {subject.nameEn}
                </h1>
                <span className="text-[17px] text-muted">
                  <span lang="bn">{subject.nameBn}</span>
                  {facts.map((fact) => ` · ${fact}`)}
                </span>
              </div>
            </div>
            {(hasBoard || hasMcq) && (
              <div className="flex flex-wrap gap-2.5">
                {hasBoard && (
                  <Link
                    href={questionsHref({ class: cls.id, subject: slug, board: "any" })}
                    className={cx(button.outline, "h-[46px] px-[18px]")}
                  >
                    All board questions
                  </Link>
                )}
                {hasMcq && (
                  <Link
                    href={questionsHref({ class: cls.id, subject: slug, type: "mcq" })}
                    className={cx(button.accent, "h-[46px] px-[18px]")}
                  >
                    Start a mixed MCQ test
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="page-x flex flex-col gap-[18px] pt-7 pb-16">
        {rows.length > 0 ? (
          <ChapterList chapters={rows} />
        ) : (
          <>
            <h2 className="m-0 text-[22px] font-bold">Chapters</h2>
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-7">
              <p className="m-0 text-[17px] font-semibold">Chapters for {subject.nameEn} are coming soon.</p>
              <p className="m-0 text-muted">
                {subject.blurb
                  ? `This subject is organised as ${subject.blurb.toLowerCase()}; its questions are being added.`
                  : "Its questions are being added."}{" "}
                Meanwhile, try another subject in {classLabel(cls)}.
              </p>
              <Link href={classHref(cls.id)} className={cx(button.outline, "h-11 px-4")}>
                ← All {classLabel(cls)} subjects
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
