import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { cx } from "@/lib/cx";
import { boards, chaptersOfSubject, getChapter, getClass, getSubject, olderThan, questionsOfChapter } from "@/lib/data";
import { classLabel, pad2, TONE, toneOf } from "@/lib/format";
import { chapterHref, classHref, subjectHref } from "@/lib/routes";
import { ChapterView } from "./chapter-view";

type Props = PageProps<"/class/[classId]/[subjectId]/[chapterNo]">;

async function load(params: Props["params"]) {
  const { classId, subjectId, chapterNo } = await params;
  // "2", never "02" or "2.0": one address per chapter.
  if (!/^[1-9]\d{0,2}$/.test(chapterNo)) return null;
  const cls = getClass(classId);
  const subject = getSubject(classId, subjectId);
  const chapter = subject ? getChapter(subject.id, Number(chapterNo)) : undefined;
  return cls && subject && chapter ? { cls, subject, chapter } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load(params);
  if (!found) return {};
  const { cls, subject, chapter } = found;
  return { title: `${chapter.titleEn} · ${subject.nameEn} Ch ${chapter.no} · ${classLabel(cls)} — Questions` };
}

export default async function ChapterPage({ params }: Props) {
  // The tab and filters are in the address (?type=…), so each request is rendered with them.
  await connection();
  const found = await load(params);
  if (!found) notFound();
  const { cls, subject, chapter } = found;

  const siblings = chaptersOfSubject(subject.id);
  const at = siblings.findIndex((c) => c.id === chapter.id);
  const prev = siblings[at - 1];
  const next = siblings[at + 1];

  return (
    <main id="main" className="w-full">
      <ChapterView
        crumbs={
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: classLabel(cls), href: classHref(cls.id) },
              { label: subject.nameEn, href: subjectHref(subject) },
              { label: `Chapter ${chapter.no}` },
            ]}
          />
        }
        title={
          <div className="flex flex-col gap-1">
            <span className={cx("text-[14px] font-semibold tracking-[0.06em] uppercase", TONE[toneOf(subject)].text)}>
              {subject.nameEn} · Chapter {pad2(chapter.no)}
            </span>
            <h1 className="m-0 font-display text-[clamp(30px,7vw,40px)] leading-[1.1] font-bold tracking-[-0.03em]">
              {chapter.titleEn}{" "}
              <span lang="bn" className="font-sans text-[clamp(20px,4.6vw,26px)] font-medium tracking-normal text-subtle">
                · {chapter.titleBn}
              </span>
            </h1>
          </div>
        }
        questions={questionsOfChapter(chapter.id)}
        boards={boards()}
        olderThan={olderThan()}
        prev={prev && { no: prev.no, href: chapterHref(prev) }}
        next={next && { no: next.no, href: chapterHref(next) }}
        printTitle={`${subject.nameEn} · ${classLabel(cls)} · Chapter ${chapter.no}: ${chapter.titleEn}`}
      />
    </main>
  );
}
