import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, type Crumb } from "@/components/breadcrumbs";
import { button } from "@/components/ui";
import { cx } from "@/lib/cx";
import {
  allClasses,
  boards,
  getClass,
  getSubject,
  olderThan,
  searchQuestions,
  years,
  type PlacedQuestion,
} from "@/lib/data";
import { classFullLabel, classLabel, plural, TYPE_META } from "@/lib/format";
import {
  parseBoard,
  parseType,
  parseYear,
  SOURCE_KEYS,
  tagMatches,
  type QuestionFilters,
  type YearFilter,
} from "@/lib/questions";
import { classHref, questionsHref, subjectHref, subjectSlug } from "@/lib/routes";
import type { ClassLevel, QType, Subject } from "@/lib/types";
import { QuestionResults, type ResultGroup } from "./question-results";

/* Questions from many chapters at once: search results (?q=), board questions (?board=any,
   ?board=Dhaka, ?year=2024), a subject's mixed MCQs (?subject=physics&type=mcq). Not one of the
   four designed pages; it gives the home page's search and board links somewhere to land. */

type Search = Record<string, string | string[] | undefined>;

interface Query {
  q: string;
  cls?: ClassLevel;
  subject?: Subject;
  type: QType | null;
  anyBoard: boolean;
  board: string | null;
  year: YearFilter;
}

function readQuery(sp: Search): Query {
  const get = (key: string) => {
    const value = sp[key];
    return typeof value === "string" ? value : undefined;
  };
  const cls = getClass(get("class") ?? "");
  const subjectSlug = get("subject");
  return {
    q: (get("q") ?? "").trim().slice(0, 100),
    cls,
    subject: cls && subjectSlug ? getSubject(cls.id, subjectSlug) : undefined,
    type: parseType(get("type")),
    anyBoard: get("board")?.toLowerCase() === "any",
    board: parseBoard(get("board"), boards()),
    year: parseYear(get("year")),
  };
}

function yearText(year: YearFilter): string | null {
  if (year === "older") return `before ${olderThan()}`;
  return year === null ? null : String(year);
}

function titleOf(query: Query): string {
  if (query.q) return `Results for “${query.q}”`;
  if (query.anyBoard || query.board || query.year !== null) {
    return ["Board questions", query.board, yearText(query.year)].filter(Boolean).join(" · ");
  }
  if (query.subject && query.type === "MCQ") return "Mixed MCQ practice";
  if (query.type) return TYPE_META[query.type].nouns[0].toUpperCase() + TYPE_META[query.type].nouns.slice(1);
  return "All questions";
}

export async function generateMetadata({ searchParams }: PageProps<"/questions">): Promise<Metadata> {
  return { title: titleOf(readQuery(await searchParams)) };
}

export default async function QuestionsPage({ searchParams }: PageProps<"/questions">) {
  const query = readQuery(await searchParams);
  const boardMode = query.anyBoard || !!query.board || query.year !== null;
  const filters: QuestionFilters = {
    sources: boardMode ? ["board"] : SOURCE_KEYS,
    board: query.board,
    year: query.year,
    difficulty: null,
  };
  const found = searchQuestions({
    q: query.q,
    classId: query.cls?.id,
    subjectId: query.subject?.id,
    type: query.type,
    filters,
  });
  const groups = boardMode ? byYear(found, filters) : [{ items: found }];

  const title = titleOf(query);
  const scope = query.subject
    ? `${query.subject.nameEn} · ${query.cls ? classLabel(query.cls) : ""}`
    : query.cls
      ? classFullLabel(query.cls)
      : "All classes";
  const noun = boardMode ? "board question" : query.type ? TYPE_META[query.type].noun : "question";
  const summary = `${plural(found.length, noun, boardMode ? "board questions" : query.type ? TYPE_META[query.type].nouns : "questions")} · ${scope}`;

  const crumbs: Crumb[] = [{ label: "Home", href: "/" }];
  if (query.cls) crumbs.push({ label: classLabel(query.cls), href: classHref(query.cls.id) });
  if (query.subject) crumbs.push({ label: query.subject.nameEn, href: subjectHref(query.subject) });
  crumbs.push({ label: query.q ? "Search" : boardMode ? "Board questions" : title });

  const select = "h-12 min-w-0 flex-[1_1_auto] rounded-[10px] border border-line bg-page px-3 text-ink sm:flex-none";

  return (
    <main id="main" className="w-full">
      <div className="border-b border-line bg-surface">
        <div className="page-x flex flex-col gap-5 pt-7 pb-8">
          <Breadcrumbs items={crumbs} />
          <div className="flex flex-col gap-1.5">
            <span className="text-[14px] font-semibold tracking-[0.06em] text-accent uppercase">{scope}</span>
            <h1 className="m-0 font-display text-[clamp(30px,7vw,40px)] leading-[1.1] font-bold tracking-[-0.03em]">
              {title}
            </h1>
          </div>

          <form
            role="search"
            action="/questions"
            className="flex flex-wrap gap-2.5 rounded-[14px] border border-field bg-surface p-2 shadow-search focus-within:border-accent"
          >
            <label htmlFor="q" className="sr-only">
              Search questions
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query.q}
              placeholder="Search a topic, e.g. “velocity”"
              className="h-12 min-w-0 flex-[1_1_220px] border-none bg-transparent px-3 text-[17px] text-ink outline-none placeholder:text-faint focus-visible:outline-none"
            />
            <label htmlFor="f-class" className="sr-only">
              Class
            </label>
            <select id="f-class" name="class" defaultValue={query.cls?.id ?? ""} className={select}>
              <option value="">All classes</option>
              {allClasses().map((c) => (
                <option key={c.id} value={c.id}>
                  {classFullLabel(c)}
                </option>
              ))}
            </select>
            {query.subject && <input type="hidden" name="subject" value={subjectSlug(query.subject)} />}
            <label htmlFor="f-type" className="sr-only">
              Question type
            </label>
            <select id="f-type" name="type" defaultValue={query.type?.toLowerCase() ?? ""} className={select}>
              <option value="">All types</option>
              <option value="cq">CQ</option>
              <option value="mcq">MCQ</option>
              <option value="sq">SQ</option>
            </select>
            <label htmlFor="f-board" className="sr-only">
              Board
            </label>
            <select
              id="f-board"
              name="board"
              defaultValue={query.anyBoard ? "any" : (query.board ?? "")}
              className={select}
            >
              <option value="">Any source</option>
              <option value="any">Board questions</option>
              {boards().map((b) => (
                <option key={b} value={b}>
                  {b} Board
                </option>
              ))}
            </select>
            <label htmlFor="f-year" className="sr-only">
              Year
            </label>
            <select id="f-year" name="year" defaultValue={query.year === null ? "" : String(query.year)} className={select}>
              <option value="">All years</option>
              {years().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
              <option value="older">Older</option>
            </select>
            <button type="submit" className={cx(button.accent, "h-12 flex-[1_1_auto] px-6 sm:flex-none")}>
              Search
            </button>
          </form>
          {query.subject && (
            <p className="m-0 text-[15px] text-muted">
              Only {query.subject.nameEn} questions.{" "}
              <Link
                href={questionsHref({
                  q: query.q || undefined,
                  class: query.cls?.id,
                  type: query.type?.toLowerCase(),
                  board: query.anyBoard ? "any" : (query.board ?? undefined),
                  year: query.year === null ? undefined : String(query.year),
                })}
              >
                Show every subject
              </Link>
            </p>
          )}
        </div>
      </div>

      <div className="page-x pt-7 pb-16">
        {found.length > 0 ? (
          <QuestionResults groups={groups} summary={summary} />
        ) : (
          <div className="flex max-w-[880px] flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-7">
            <p className="m-0 text-[17px] font-semibold">No questions found.</p>
            <p className="m-0 text-muted">
              {query.q
                ? "Try a shorter or different word, or clear some of the choices above."
                : "Nothing matches these choices yet. Clear some of them, or browse by class."}
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Link href="/questions" className={cx(button.outline, "h-11 px-4")}>
                Clear search
              </Link>
              <Link href="/#classes" className={cx(button.outline, "h-11 px-4")}>
                Browse by class
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/** Board questions grouped by exam year, newest first. */
function byYear(found: PlacedQuestion[], filters: QuestionFilters): ResultGroup[] {
  const older = olderThan();
  const groups = new Map<number, ResultGroup>();
  for (const item of found) {
    const tag = item.question.boards.find((t) => tagMatches(t, filters, older)) ?? item.question.boards[0];
    const group = groups.get(tag.year) ?? { heading: String(tag.year), items: [] };
    group.items.push(item);
    groups.set(tag.year, group);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([, group]) => group);
}
