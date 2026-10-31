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
`/tanvir-ahmed` is an old address that redirects.

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
| `src/app/[handle]/` | A teacher's website: home (courses, lesson plan, notices, about, contact), `/courses/<n>`, `/notices` |
| `src/app/dashboard/` | The teacher's editors: theme, website (profile, photo, figures, contact, class times, address), courses and chapters, notices |
| `src/app/api/media/`, `src/app/media/` | Photo upload (the file type is read from its bytes, not its name) and serving of locally stored uploads |
| `src/proxy.ts` | Real 404 / 308 / 307 answers decided before rendering; the comment there explains why |
| `src/server/` | Schema, sessions, data access. Teacher-owned data is always read for the teacher in the session or the address, never an id from the browser |
| `src/i18n/` | `bn.ts` is the source; `en.ts` is typed against it, so a missing translation fails the type check |
| `src/app/globals.css` | The three themes as tokens on `[data-style]`, mapped to Tailwind utilities |
| `drizzle/` | SQL migrations; run `npm run db:generate` after changing `src/server/db/schema.ts` |

Settings are listed in `.env.example`.
