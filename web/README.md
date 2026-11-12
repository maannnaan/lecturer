# Lecturer.bd · web

The platform site, the teacher dashboard, the admin panel and every teacher's own website
(`lecturer.bd/<handle>`). Next.js (App Router, Cache Components) with PostgreSQL through Drizzle.
Bangla first, with an English switch. Each teacher picks one of three themes: `ink`, `mist`, `sage`.

## Run it locally

```sh
npm install
npm run seed:demo   # a local admin and three demo teachers (one per theme) with websites, courses and notices
npm run dev         # http://localhost:3000
```

No database server is needed locally: without `DATABASE_URL` the app keeps an embedded Postgres
(PGlite) in `.data/pglite`. Only one process can open it at a time, so run the seed scripts while
`npm run dev` is stopped.

Photos go to Cloudinary once its three settings are filled in. Without them, `npm run dev` keeps
uploads in `.data/uploads`, so the photo uploader works locally with no account.

Demo sign-ins (local data only):

| Who | Where | Login | Password |
|---|---|---|---|
| Admin | `/admin` | `admin@lecturer.test` | `admin-password` |
| Teachers | `/login` | `01710000001`, `01710000002`, `01710000003` | `teacher-password` |

`/tanvir` (Ink & Paper) and `/nusrat` (Mist) are live, with courses, lesson plans and notices;
`/rafi` (Sage) is waiting for approval, so only Rafi sees it (signed in, with a preview banner).
`/tanvir-ahmed` is an old address that redirects. Tanvir's question bank (`/tanvir/bank`), which is
separate from his courses, has the classes এইচএসসি (1) and এসএসসি (2). It fills `/tanvir/bank/1/1/3`
and `/4` (every tab, maths, board questions with their difficulty, and one private question that
must never appear on the site) and `/tanvir/bank/2/2/2`.

## Checks

```sh
npm run typecheck   # route types, then tsc
npm run lint
npm test            # unit and integration tests, each file on a fresh in-memory Postgres
npm run build
npm run test:e2e    # Playwright against the production build, using the installed Chrome
```

## Where things are

| Path | What |
|---|---|
| `src/app/` | Routes: `/` (platform), `/register`, `/login`, `/dashboard`, `/admin`, `/[handle]` (a teacher's site) |
| `src/app/[handle]/` | A teacher's website: home (courses, lesson plan, notices, about, contact), `/courses/<n>` (what the teacher advertises), the question bank (`/bank` › `/bank/<class>` › `/bank/<class>/<subject>` › `/bank/<class>/<subject>/<chapter>?tab=<tab>`, each by number; an old address with a fixed class key such as `/bank/hsc/1/4` is redirected), `/notices` |
| `src/app/dashboard/` | The teacher's editors: theme, website (profile, photo, figures, contact, class times, address), courses and their lesson plans, the question bank (the teacher adds a class with “নতুন শ্রেণি”, naming it as they like; then its subjects inside it, and questions inside a subject's chapters: class › subject › chapter › tab; a class can be renamed, and removed while empty), notices |
| `src/components/qbank/` | The question bank's pages in the QBank design (`../qbank-handoff/`), shared by the dashboard and the website: class and subject cards (subjects tabbed by group), chapter rows with each tab's count, and a chapter's six tabs with the filter sidebar (source, board, year, difficulty; kept in the address), answers to reveal, MCQs checked on the first tap, the board list with Open, a printable sheet (`?print=chapter`/`board`) and bookmarks. Its colours and fonts (`qb-*`; Space Grotesk and Hind Siliguri for Latin text, Kalpurush for Bangla) are the same in every theme |
| `src/lib/questions.ts`, `src/server/questions.ts` | Question types, a chapter's tabs (`BANK_TABS`: textbook problems, practice problems, MCQ, SQ, CQ, then board questions of every type), the chapter filters and validation; the bank's data access. A question's text is rich text (below); maths typed as `$…$`/`$$…$$` (`src/lib/math.ts`) still works, typeset with KaTeX on the server (`src/components/math-text.tsx`) |
| `src/lib/rich-text.ts`, `src/components/rich-editor/`, `src/components/rich-view.tsx` | Rich text, for question text, the website's "about me", course descriptions and notices. The editor (Tiptap) has bold, italic, underline, subscript, superscript, lists, tables, pictures (drag a corner to resize; only the width is kept) and an equation box with a live preview; an MCQ option's editor keeps to one line of text and maths. It posts a small JSON document, which the server checks (only the editor's own nodes and marks, sensible sizes, pictures only the teacher's own uploads, their addresses set by the server) and pages draw with our own renderer, never as HTML. Text from before the editor still shows as it did, and becomes a document when next edited. Website texts keep a plain copy for previews and page descriptions |
| `src/lib/grades.ts`, `src/lib/bank.ts`, `src/lib/bank-tree.ts`, `src/lib/bank-look.ts`, `src/server/bank.ts` | The fixed class list (courses use it); the bank's own classes (`bank_classes`: named by the teacher, numbered for the website, listed even while empty, in the order their names read as, ৬ষ্ঠ before এসএসসি), subjects (with their group) and chapters (a pasted chapter list loses its numbering); the class › subject › chapter tree with each tab's counts; each class's big number and colour, read from its name, and each subject's abbreviation and colour |
| `src/components/navigation-progress.tsx`, `loading.tsx` files | Something on screen the moment a link is clicked: a placeholder for the page, and a bar across the top while it arrives. Buttons that save show a spinner (`PendingButton`, `SubmitButton` in `src/components/form.tsx`) |
| `src/app/api/media/`, `src/app/media/` | Photo upload (the file type is read from its bytes, not its name) and serving of locally stored uploads |
| `src/proxy.ts` | Real 404 / 308 / 307 answers decided before rendering; the comment there explains why |
| `src/server/` | Schema, sessions, data access. Teacher-owned data is always read for the teacher in the session or the address, never an id from the browser |
| `src/i18n/` | `bn.ts` is the source; `en.ts` is typed against it, so a missing translation fails the type check |
| `src/app/globals.css` | The three themes as tokens on `[data-style]`, mapped to Tailwind utilities |
| `src/app/fonts.ts`, `src/fonts/` | The fonts. Bangla is Kalpurush everywhere: the original file from the Avro Font Development Project, under the SIL Open Font License (`src/fonts/Kalpurush-OFL.txt`; keep it with the font). It answers only for Bangla characters, so each theme's own face draws Latin text |
| `drizzle/` | SQL migrations; run `npm run db:generate` after changing `src/server/db/schema.ts` |

Settings are listed in `.env.example`.
