import Link from "next/link";
import { button, Eyebrow, TypeBadge } from "@/components/ui";
import { cx } from "@/lib/cx";
import { allClasses, boards, years } from "@/lib/data";
import { classFullLabel, classNumber, TONE, toneOf } from "@/lib/format";
import { chapterHref, classHref, questionsHref } from "@/lib/routes";
import { FEATURED } from "@/lib/site";

const POPULAR = [
  { label: "Motion — CQ", href: chapterHref({ id: FEATURED.chapterId }, { type: "cq" }) },
  { label: "SSC Higher Math MCQ", href: questionsHref({ class: "9-10", subject: "higher-math", type: "mcq" }) },
  { label: "Dhaka Board 2025", href: questionsHref({ board: "Dhaka", year: "2025" }) },
];

const WAYS = [
  {
    badge: "CQ",
    title: "Creative Questions",
    body: "A stem followed by knowledge, comprehension, application and higher-ability parts (a–d), with model answers.",
    card: "bg-cq-wash",
    solid: "bg-cq",
  },
  {
    badge: "MCQ",
    title: "Multiple Choice",
    body: "Single, multi-statement and situation-based MCQs. Tap to check, or take a timed chapter test.",
    card: "bg-mcq-wash",
    solid: "bg-mcq",
  },
  {
    badge: "SQ",
    title: "Short Questions",
    body: "Knowledge and comprehension questions with short, exam-ready answers for quick revision.",
    card: "bg-sq-wash",
    solid: "bg-sq",
  },
  {
    badge: "Board",
    title: "Board Questions",
    body: "Past questions from every education board, filterable by board and exam year.",
    card: "bg-board-wash",
    solid: "bg-ink",
  },
];

const h2 = "m-0 font-display text-[clamp(28px,6vw,34px)] font-bold tracking-[-0.02em]";

export default function HomePage() {
  const classes = allClasses();

  return (
    <main id="main">
      <section className="page-x flex flex-wrap items-center gap-12 pt-12 pb-14 sm:pt-[72px]">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <span className="self-start rounded-full bg-accent-soft px-3 py-1.5 text-[14px] font-semibold text-accent">
            NCTB syllabus · Class 6 to HSC
          </span>
          <h1 className="m-0 font-display text-[clamp(38px,9vw,56px)] leading-[1.05] font-bold tracking-[-0.035em]">
            Every question, sorted by class, subject and chapter.
          </h1>
          <p className="m-0 max-w-[560px] text-[19px] text-muted">
            Practise creative questions, MCQs and short questions chapter by chapter — with past board questions tagged
            by board and year.
          </p>
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
              placeholder="Search a topic, e.g. “velocity”, “photosynthesis”"
              className="h-12 min-w-0 flex-[1_1_260px] border-none bg-transparent px-3 text-[17px] text-ink outline-none placeholder:text-faint focus-visible:outline-none"
            />
            <label htmlFor="cls" className="sr-only">
              Class
            </label>
            <select
              id="cls"
              name="class"
              defaultValue=""
              className="h-12 min-w-0 flex-[1_1_auto] rounded-[10px] border border-line bg-page px-3 text-ink sm:flex-none"
            >
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {classFullLabel(c)}
                </option>
              ))}
            </select>
            <button type="submit" className={cx(button.accent, "h-12 flex-[1_1_auto] px-6 sm:flex-none")}>
              Search
            </button>
          </form>
          <div className="flex flex-wrap items-center gap-2 text-[14px]">
            <span className="text-subtle">Popular:</span>
            {POPULAR.map((p) => (
              <Link
                key={p.label}
                href={p.href}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-ink no-underline hover:border-field hover:text-ink"
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>

        {/* A taste of what's inside: one creative question, one MCQ, one board tag. */}
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3" aria-hidden="true">
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center gap-2">
              <TypeBadge type="CQ" />
              <span className="text-[14px] text-subtle">Physics · Ch 2 · Motion</span>
            </div>
            <p className="m-0 text-[15px] text-ink-soft">
              A car starts from rest and reaches 20 m/s in 10 s, then moves at that speed for 30 s.
            </p>
            <div className="flex flex-col gap-1.5 text-[14px] text-muted">
              <div>
                a. What is acceleration? <span className="text-faint">· 1</span>
              </div>
              <div>
                b. Why is uniform velocity also uniform speed? <span className="text-faint">· 2</span>
              </div>
              <div>
                c. Find the total distance travelled. <span className="text-faint">· 3</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
              <TypeBadge type="MCQ" className="self-start" />
              <span className="text-[14px]">Unit of acceleration?</span>
              <span className="text-[13px] font-semibold text-accent">✓ m s⁻²</span>
            </div>
            <div className="flex flex-1 flex-col gap-2 rounded-2xl border border-board-line bg-board-soft p-4">
              <span className="self-start rounded-md bg-ink px-2.5 py-[3px] text-[13px] font-bold text-white">Board</span>
              <span className="text-[14px] text-board-ink">Tagged by board &amp; year</span>
              <span className="text-[13px] font-semibold text-board">Dhaka · 2024</span>
            </div>
          </div>
        </div>
      </section>

      <section id="classes" aria-labelledby="cls-h" className="page-x flex flex-col gap-6 pt-6 pb-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow className="mb-1">Step 1</Eyebrow>
            <h2 id="cls-h" className={h2}>
              Choose your class
            </h2>
          </div>
          <Link href={classHref(FEATURED.classId)} className="font-semibold">
            See all classes →
          </Link>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
          {classes.map((c) => (
            <Link
              key={c.id}
              href={classHref(c.id)}
              className="flex min-h-[150px] flex-col gap-3.5 rounded-2xl border border-line bg-surface p-[22px] text-ink no-underline hover:border-field hover:text-ink"
            >
              <span
                className={cx(
                  "font-display text-[34px] font-bold tracking-[-0.03em] sm:text-[40px]",
                  TONE[toneOf(c)].text,
                )}
              >
                {classNumber(c)}
              </span>
              <span className="mt-auto flex flex-col gap-0.5">
                <span className="text-[18px] font-bold">{c.name}</span>
                <span className="text-[14px] text-subtle">{c.tagline}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section id="types" aria-labelledby="types-h" className="border-y border-line bg-surface">
        <div className="page-x flex flex-col gap-7 py-16">
          <div>
            <Eyebrow className="mb-1">Inside every chapter</Eyebrow>
            <h2 id="types-h" className={h2}>
              Four ways to practise
            </h2>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
            {WAYS.map((way) => (
              <div key={way.badge} className={cx("flex flex-col gap-2.5 rounded-2xl p-6", way.card)}>
                <span className={cx("self-start rounded-md px-3 py-1 font-bold text-white", way.solid)}>
                  {way.badge}
                </span>
                <h3 className="m-0 text-[20px] font-bold">{way.title}</h3>
                <p className="m-0 text-[15px] text-muted">{way.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="boards" aria-labelledby="board-h" className="page-x flex flex-wrap gap-8 py-16">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3">
          <Eyebrow>Board questions</Eyebrow>
          <h2 id="board-h" className={h2}>
            Jump straight to a board and year
          </h2>
          <p className="m-0 text-muted">
            Each board question also lives inside its chapter, so you can practise it in context.
          </p>
        </div>
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <div className="flex flex-wrap gap-2.5">
            {boards().map((b) => (
              <Link
                key={b}
                href={questionsHref({ board: b })}
                className="rounded-[10px] border border-line bg-surface px-4 py-2.5 font-medium text-ink no-underline hover:border-field hover:text-ink"
              >
                {b}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[14px] text-subtle">Year</span>
            {[...years().map(String), "Older"].map((y) => (
              <Link
                key={y}
                href={questionsHref({ year: y.toLowerCase() })}
                className="rounded-full bg-ink px-3.5 py-2 text-[14px] font-semibold text-white no-underline hover:bg-ink-soft hover:text-white"
              >
                {y}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
