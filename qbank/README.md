# QBank

A question bank organised as **Class → Subject → Chapter → Question type (CQ / MCQ / SQ / Board)**,
built from the approved mockups in `../qbank-handoff/design/`. Next.js 16 (App Router, TypeScript)
and Tailwind CSS 4. The sample content is in `data/` as JSON; there is no database.

## Run it

```sh
npm install
npm run dev          # http://localhost:3000
```

Checks:

```sh
npm run typecheck
npm run lint
npm run build
npm run test:e2e     # Playwright against the production build (run `npm run build` first), using the installed Chrome
```

## Pages

| Route | Mockup | What it does |
|---|---|---|
| `/` | `Main.dc.html` | Search, class picker, the four question types, board and year shortcuts |
| `/class/[classId]` | `Class.dc.html` | A class's subjects, tabbed by group (`?group=science`); switch class with the pills |
| `/class/[classId]/[subjectId]` | `Subject.dc.html` | The subject's chapters with CQ / MCQ / SQ / Board counts; "Find a chapter" filters the list |
| `/class/[classId]/[subjectId]/[chapterNo]` | `Chapter.dc.html` | The chapter's questions (see below) |
| `/questions` | — (not in the handoff) | Questions from many chapters: search results (`?q=`), board questions (`?board=any`, `?board=Dhaka`, `?year=2024`), a subject's mixed MCQs (`?subject=physics&type=mcq`). The home search, the board and year shortcuts, "Board Questions" in the nav and "Start a mixed MCQ test" land here. |

Example: `/class/9-10/physics/2?type=mcq` is SSC Physics, chapter 2 (Motion), MCQ tab.
Unknown classes, subjects and chapters answer with a real 404.

### Chapter page

- **Tabs** CQ / MCQ / SQ / Board, each with a count, kept in `?type=` (Back and reload keep the tab; arrow keys move between tabs).
- **CQ**: stem and parts a–d with level and marks; "Show answers" opens the model answers.
- **MCQ**: tap an option to check it. The question locks; the right answer turns green ✓, a wrong pick red ✗, and the explanation appears. Multi-statement questions keep their line breaks.
- **SQ**: show or hide each answer.
- **Board**: board chips and rows (type, question, board · year, **Open**, which jumps to the question in its own tab).
- **Show all / Hide all answers** above the list (on MCQ: **Reveal all answers / Reset answers**).
- **Filters** (sidebar; folded into a "Filters" button when it stacks above the questions): source, board, year, difficulty. They apply to every tab and live in the address too (`?board=Dhaka&year=2024&diff=easy&src=board,school,practice`). The board chips and the Board select are the same filter.
- **Download chapter PDF** and **Download board set** open the print dialog with a clean printable sheet of the questions the filters show, with answers ("Save as PDF" downloads it).
- **Bookmark** is kept in this browser (localStorage).

Picked options and opened answers stay put while you switch tabs or filters.

## Data

`data/*.json` follows the model in `qbank-handoff/HANDOFF.md`. `src/lib/data.ts` loads it and checks
every reference when the server starts (a broken id fails the build with a list of problems).

- Ids are paths: a subject is `"9-10/physics"`, its chapter 2 is `"9-10/physics/2"`, so a page's address is `/class/` + its id.
- Fields the suggested model didn't have, all optional: `ClassLevel.defaultGroup`, `tagline`, `tone`;
  `Subject.tone`, `blurb` (shown instead of "N chapters"); `Question.source` (where a non-board
  question comes from, e.g. "Model test" — no board and no source means a practice question) and
  `Question.level` (an SQ's "Knowledge" / "Comprehension").
- `data/boards.json` lists the boards and the years the home page offers ("Older" is anything before the last one).
- Counts on every page are counted from the data, so they are small next to the mockups' placeholder numbers.

The sample questions sit in SSC Physics chapters 1–4 (chapter 2, Motion, has the mockup's questions
plus a few more), SSC Chemistry 3, SSC Higher Mathematics 1 and HSC Physics 1st Paper chapter 2.
Subjects without chapters in the data say "Chapters coming soon".

## Where things are

| Path | What |
|---|---|
| `src/app/globals.css` | Design tokens from the handoff (colours, fonts, the 1200px container) as Tailwind theme values |
| `src/app/layout.tsx`, `src/components/site-*.tsx` | Shared layout: header (nav, Bangla toggle, Sign in), footer, the page-loading bar |
| `src/components/questions/` | The CQ / MCQ / SQ cards, the board list, the print sheet, bookmarks |
| `src/lib/data.ts` | Loading, checking and searching the JSON (server only) |
| `src/lib/questions.ts` | Filters, counts and labels shared by the server pages and the interactive lists |
| `e2e/qbank.spec.ts` | Every interaction above, plus 404s and phone widths |

Not built yet: sign-in and the Bangla version (their buttons say so), model tests, and pages behind
the footer links.
