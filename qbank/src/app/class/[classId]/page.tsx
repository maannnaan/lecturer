import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { cx } from "@/lib/cx";
import { allClasses, chaptersOfSubject, classHasBoardQuestions, getClass, subjectsOfClass } from "@/lib/data";
import { classFullLabel, classLabel, classTabLabel, classTitle, subjectMeta } from "@/lib/format";
import { classHref, questionsHref } from "@/lib/routes";
import { SubjectGroups, type SubjectCardData } from "./subject-groups";

export async function generateMetadata({ params }: PageProps<"/class/[classId]">): Promise<Metadata> {
  const { classId } = await params;
  const cls = getClass(classId);
  return cls ? { title: `${classFullLabel(cls)} — Subjects` } : {};
}

export default async function ClassPage({ params }: PageProps<"/class/[classId]">) {
  // The group tab lives in the address (?group=), so each request is rendered with it.
  await connection();
  const { classId } = await params;
  const cls = getClass(classId);
  if (!cls) notFound();

  const subjects: SubjectCardData[] = subjectsOfClass(cls.id).map((s) => ({
    id: s.id,
    group: s.group,
    nameEn: s.nameEn,
    nameBn: s.nameBn,
    abbr: s.abbr,
    tone: s.tone,
    meta: subjectMeta(s, chaptersOfSubject(s.id).length),
  }));

  return (
    <main id="main" className="page-x flex w-full flex-col gap-7 pt-8 pb-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: classFullLabel(cls) }]} />

      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-display text-[clamp(32px,7vw,44px)] leading-[1.1] font-bold tracking-[-0.03em]">
            {classTitle(cls)}
          </h1>
          <p className="m-0 text-[18px] text-muted">Pick a subject to see its chapters and questions.</p>
        </div>
        <nav aria-label="Class" className="flex flex-wrap gap-1.5 rounded-xl border border-line bg-surface p-1.5">
          {allClasses().map((c) => {
            const on = c.id === cls.id;
            return (
              <Link
                key={c.id}
                href={classHref(c.id)}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "inline-flex h-11 items-center rounded-lg px-4 font-semibold no-underline",
                  on ? "bg-ink text-white hover:text-white" : "text-muted hover:bg-page hover:text-ink",
                )}
              >
                {classTabLabel(c)}
              </Link>
            );
          })}
        </nav>
      </div>

      <SubjectGroups groups={cls.groups} defaultGroup={cls.defaultGroup ?? cls.groups[0]} subjects={subjects} />

      {classHasBoardQuestions(cls.id) && (
        <div className="on-dark flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-ink px-7 py-6 text-white">
          <div className="flex flex-col gap-1">
            <span className="font-display text-[22px] font-bold">Preparing for {cls.name}?</span>
            <span className="text-footer">
              See all board questions for {classLabel(cls)}, grouped by board and year.
            </span>
          </div>
          <Link
            href={questionsHref({ class: cls.id, board: "any" })}
            className="rounded-[10px] bg-board-cta px-5 py-3 font-bold text-ink no-underline hover:bg-[#f5c25c] hover:text-ink"
          >
            Open board questions →
          </Link>
        </div>
      )}
    </main>
  );
}
