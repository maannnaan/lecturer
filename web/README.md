# Lecturer.bd · web

The platform site, the teacher dashboard, the admin panel and every teacher's own website
(`lecturer.bd/<handle>`). Next.js (App Router, Cache Components) with PostgreSQL through Drizzle.
Bangla first, with an English switch. The platform's own pages and every dashboard wear one look
(`app`: clean, neutral, one green accent, the question bank's palette); each teacher picks one of
three themes for their public website: `ink`, `mist`, `sage`.

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
| Students of Tanvir | `/tanvir/login` | `01900000001` (enrolled), `01900000002` (request waiting) | `student-password` |

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
| `src/app/[handle]/` | A teacher's website: home (in the order a visiting student or guardian asks: admission and who, courses, class times, about, the question bank to try, where the batch is in its lesson plan, notices, contact; on a phone a call / WhatsApp bar stays at the foot of the screen), `/courses/<n>` (what the teacher advertises), the question bank (`/bank` › `/bank/<class>` › `/bank/<class>/<subject>` › `/bank/<class>/<subject>/<chapter>?tab=<tab>`, each by number; an old address with a fixed class key such as `/bank/hsc/1/4` is redirected), `/notices` |
| `src/app/dashboard/` | The teacher's editors: theme, website (profile, photo, figures, contact, class times, address), courses and their lesson plans, the question bank (the teacher adds a class with “নতুন শ্রেণি”, naming it as they like; then its subjects inside it, and questions inside a subject's chapters: class › subject › chapter › tab; a class can be renamed, and removed while empty), notices |
| `src/lib/students.ts`, `src/server/students.ts`, `src/server/batches.ts`, `src/server/enrollments.ts` | Students, batches and admission. A student belongs to one teacher (the same phone can be another teacher's student). On a live site a student opens an account (`/<handle>/join`), signs in (`/<handle>/login`), sees their courses (`/<handle>/me`) and asks to join a course from its page: a free course lets them straight in, any other waits in the dashboard's requests, where the teacher admits (batch, roll, fee) or declines. A roll is digits only, at most 8, unique in its course (the OMR sheet carries it); left empty, the next one is given. The dashboard also lists students (search, filters), adds offline ones, gives or resets a login, and keeps each course's batches with a printable list. The list downloads as a CSV file (`/dashboard/students/export`: a byte-order mark so Excel reads the Bangla, formula-like cells made plain text) and many students can be added from one (`src/lib/student-csv.ts`, `/dashboard/students/import`: headings in Bangla or English, every row checked first, nothing added unless all are right) |
| `src/lib/dues.ts`, `src/lib/payments.ts`, `src/server/payments.ts` | Payments and dues, in whole taka. A course is paid by the month (owed for every month since the student's `start_month`, "YYYY-MM" in Bangladesh time) or in one go. The teacher writes down what they have in hand (`/dashboard/payments/new`): verified at once, with the next receipt number (`teachers.receipt_counter`, never reused). A student reports a Send Money or bank payment with its TxnID (`/<handle>/me/pay`, to the numbers the teacher set in `/dashboard/payments/settings`): the amount is worked out on the server, it waits as pending, and the teacher verifies or rejects it. `payment_months` has one row per month covered, and its unique index is what stops a month being paid twice; rejecting or cancelling a payment deletes its rows, so the months are owed again. Receipts print for the teacher and for the student who paid (`src/components/receipt.tsx`); nobody else's opens |
| `src/lib/exams.ts`, `src/server/exams.ts` | Live MCQ exams. The teacher sets one for a course (or one batch) in `/dashboard/exams`: when it opens and closes (Bangladesh time), minutes per sitting, marks per question and off for a wrong one, shuffling, and whether results show at hand-in or after it closes. Questions come from the teacher's own bank MCQs, ticked or picked at random. Publishing freezes each question as a snapshot, so later bank edits don't change it; once anyone has started, the questions and marking are locked. A student in the course sits it at `/<handle>/exams/<n>`: the server's clock decides start and deadline (the earlier of start + minutes and the close), each pick is saved at once, the page hands itself in at zero, and a sitting left open is closed at its deadline the next time anything reads it. Each student gets their own order, seeded from the sitting. Answers and explanations never reach the page before the result may be shown, and the score is worked out on the server. Results: a merit list (score, then time taken), who didn't sit it, and how each question went (`/dashboard/exams/<id>/results`, printable) |
| `src/lib/papers.ts`, `src/server/papers.ts` | Question papers to print. The teacher makes one for a course (or one batch) in `/dashboard/papers`: what the top of the paper says (institution, subject, class, date, time, full marks, instructions), how many sets (codes from 101, three digits, as the OMR sheet's set-code grid reads them), what each set shuffles (the MCQs' order, and their options too if chosen) and the marking. Questions come from the teacher's bank: MCQs (at most 100, what one OMR sheet holds) and a written part (CQ, SQ, problems), ticked or at random (`src/components/question-picker.tsx`, shared with exams). The first set keeps the teacher's order; every other set is shuffled from the paper's own seed and the set's code, so a set prints the same every time. Making the paper final freezes its questions as snapshots, and with them every set and its answer key. `/print?sets=101-110` prints up to ten sets, each on its own A4 pages with its set code; `/key` lists every set's answers. A printed paper never carries answers or explanations |
| `src/lib/omr.ts`, `src/server/paper-results.ts` | A final paper's answer sheets and results. A sheet is a roll, a set code and what was marked on each MCQ, kept as the OMR Scanner app's own mark string (`2` an option, `-` a blank, `d1.3` two marks), so sheets typed in at `/dashboard/papers/<id>/results` (one letter a question: কখগঘ, `-` for a blank, `*` for two marks) and, later, sheets scanned by the app are kept alike. Each is marked on the server against its own set's key: a mark for each right answer, less the negative mark for each wrong one, two marks counting as wrong. Typing a roll again replaces its sheet. Who a sheet is comes from the course's rolls whenever it is read. The written part's marks are given per sheet; the merit list goes by the total, then the MCQs, and downloads as CSV. Once sheets are in, the paper can't go back to a draft and its course stays; a change in its marking marks every sheet again. Once published, each student sees their own marks and place on `/<handle>/me`, and no one else's |
| Question visibility | `public` (everyone), `private` (the teacher only) or `enrolled`: counted and listed for everyone, but its text is handed only to a signed-in student who is in one of the teacher's courses, or the teacher. `src/server/questions.ts` blanks it for anyone else (`lockedQuestion`), so a page can't show it by mistake; the website draws a locked card with the way in |
| `src/components/qbank/` | The question bank's pages in the QBank design (`../qbank-handoff/`), shared by the dashboard and the website: class and subject cards (subjects tabbed by group), chapter rows with each tab's count, and a chapter's six tabs with the filter sidebar (source, board, year, difficulty; kept in the address), answers to reveal, MCQs checked on the first tap, the board list with Open, a printable sheet (`?print=chapter`/`board`) and bookmarks. Its colours and fonts (`qb-*`; Space Grotesk and Hind Siliguri for Latin text, Kalpurush for Bangla) are the same in every theme |
| `src/lib/questions.ts`, `src/server/questions.ts` | Question types, a chapter's tabs (`BANK_TABS`: textbook problems, practice problems, MCQ, SQ, CQ, then board questions of every type), the chapter filters and validation; the bank's data access. A question's text is rich text (below); maths typed as `$…$`/`$$…$$` (`src/lib/math.ts`) still works, typeset with KaTeX on the server (`src/components/math-text.tsx`) |
| `src/lib/rich-text.ts`, `src/components/rich-editor/`, `src/components/rich-view.tsx` | Rich text, for question text, the website's "about me", course descriptions and notices. The editor (Tiptap) has bold, italic, underline, subscript, superscript, lists, tables, pictures (drag a corner to resize; only the width is kept; placed alone, centred, or left or right with the text after it beside it) and an equation box with a live preview; an MCQ option's editor keeps to one line of text and maths. It posts a small JSON document, which the server checks (only the editor's own nodes and marks, sensible sizes, pictures only the teacher's own uploads, their addresses set by the server) and pages draw with our own renderer, never as HTML. Text from before the editor still shows as it did, and becomes a document when next edited. Website texts keep a plain copy for previews and page descriptions |
| `src/lib/grades.ts`, `src/lib/bank.ts`, `src/lib/bank-tree.ts`, `src/lib/bank-look.ts`, `src/server/bank.ts` | The fixed class list (courses use it); the bank's own classes (`bank_classes`: named by the teacher, numbered for the website, listed even while empty, in the order their names read as, ৬ষ্ঠ before এসএসসি), subjects (with their group), chapters (a pasted chapter list loses its numbering) and each chapter's sub-chapters (`bank_topics`: managed in the chapter's panel on the subject's edit page, shown as "৪.১"; a question may be filed under one, and a chapter page filters by it with `?sub=<number>`); the class › subject › chapter tree with each tab's counts; each class's big number and colour, read from its name, and each subject's abbreviation and colour |
| `src/components/navigation-progress.tsx`, `loading.tsx` files | Something on screen the moment a link is clicked: a placeholder for the page, and a bar across the top while it arrives. Buttons that save show a spinner (`PendingButton`, `SubmitButton` in `src/components/form.tsx`) |
| `src/app/api/media/`, `src/app/media/` | Photo upload (the file type is read from its bytes, not its name) and serving of locally stored uploads |
| `src/proxy.ts` | Real 404 / 308 / 307 answers decided before rendering; the comment there explains why |
| `src/server/` | Schema, sessions, data access. Teacher-owned data is always read for the teacher in the session or the address, never an id from the browser |
| `src/i18n/` | `bn.ts` is the source; `en.ts` is typed against it, so a missing translation fails the type check |
| `src/app/globals.css` | The looks as tokens on `[data-style]` (`app` for the platform and dashboards; `ink`, `mist`, `sage` for teachers' websites), mapped to Tailwind utilities. `tests/unit/contrast.test.ts` checks each one's text colours against its surfaces (4.5:1) |
| `src/app/fonts.ts`, `src/fonts/` | The fonts. Bangla is Kalpurush everywhere: the original file from the Avro Font Development Project, under the SIL Open Font License (`src/fonts/Kalpurush-OFL.txt`; keep it with the font). It answers only for Bangla characters, so each theme's own face draws Latin text |
| `drizzle/` | SQL migrations; run `npm run db:generate` after changing `src/server/db/schema.ts` |

Settings are listed in `.env.example`.
