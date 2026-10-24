# CodeSim Academy

An e-learning platform where students learn programming through interactive,
auto-graded coding challenges and earn XP, levels, streaks and badges.

> **Status:** Phase 3 of 6 (setup, auth, lessons, code editor, in-browser code
> runners, grading, submissions and progress). XP, badges and leaderboards arrive
> next; the full free deployment guide (Render + Neon) arrives in Phase 6.

## Tech stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- PostgreSQL via Prisma 7 (`@prisma/adapter-pg`)
- Auth.js v5 (email/password with bcrypt, optional GitHub OAuth)
- Zod validation, Vitest unit tests, Playwright end-to-end tests

## Run locally

You need **Node.js 22 or newer** ([download](https://nodejs.org)). Then pick one of the
two ways to get a database below.

### Option A: Local setup without Docker (free Neon database)

Neon is a hosted PostgreSQL database with a free plan that never expires. You can use
the same database for development and for the deployed site, or create two (one per
"branch" in Neon) to keep test data separate.

1. Sign up at [neon.tech](https://neon.tech) (no credit card needed) and create a
   project. Pick the region closest to you (or to your Render region later).
2. On the project dashboard click **Connect**. You need **two** connection strings:
   - With **Connection pooling ON**, copy the string. Its host contains `-pooler`,
     e.g. `ep-cool-name-123456-pooler.eu-central-1.aws.neon.tech`.
     This is your `DATABASE_URL` (used by the app).
   - With **Connection pooling OFF**, copy the string again (same host *without*
     `-pooler`). This is your `DIRECT_URL` (used for migrations and seeding).
3. Create your `.env` file and paste them in:

   ```bash
   cp .env.example .env
   ```

   ```env
   DATABASE_URL="postgresql://neondb_owner:...@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require"
   DIRECT_URL="postgresql://neondb_owner:...@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
   AUTH_SECRET="paste the output of: npx auth secret"
   AUTH_URL="http://localhost:3000"
   ```

4. Install, create the tables, load the lessons and start the app:

   ```bash
   npm install          # also generates the Prisma client
   npm run db:deploy    # creates the tables in Neon (uses DIRECT_URL)
   npm run db:seed      # copies tracks and lessons from /content into the database
   npm run dev          # open http://localhost:3000
   ```

   `db:deploy` should end with *"All migrations have been successfully applied."*
   Running it again later is safe: it only applies new migrations.

> **Why two URLs?** The pooled URL lets many app requests share a few database
> connections, which is what you want for the website. Migrations need a direct
> connection, so the Prisma CLI uses `DIRECT_URL` (see `prisma.config.ts`).
>
> **First request slow?** Neon's free database goes to sleep after about 5 minutes
> without queries and takes a few seconds to wake. The app waits up to 15 seconds and
> retries once, so you may just see the loading screen briefly.

### Option B: Docker

```bash
npm install
cp .env.example .env        # the default URLs already point at the Docker database
docker compose up -d        # start Postgres on localhost:5432
npm run db:deploy
npm run db:seed
npm run dev
```

Any other PostgreSQL 13+ server also works: put its URL in both `DATABASE_URL` and
`DIRECT_URL`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run check` | Lint + type-check + unit tests |
| `npm run db:migrate` | Create a new migration after editing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply migrations |
| `npm run db:seed` | Sync tracks and lessons from `/content` into the database (safe to re-run) |
| `npm run content:expected` | Regenerate `expected.json` for SQL lessons after changing a solution |
| `npm run db:studio` | Browse the database |

## Project layout

```
prisma/              schema, migrations
src/auth.ts          Auth.js configuration
src/proxy.ts         redirects signed-out visitors away from private pages
src/lib/db.ts        Prisma client (pooled URL, 15 s connect timeout, one retry)
src/lib/session.ts   getCurrentUser / requireUser / requireRole (server-side)
src/lib/rate-limit.ts in-memory rate limiter (auth + submissions)
src/app/(auth)/      log in, sign up, server actions
src/app/tracks/      tracks list, track map, lesson page
src/lib/content/     lesson file loader + Zod schemas for /content
src/lib/runners/     Runner interface, browser runners, page probe, loop guard
src/lib/grading/     pure grading functions (server-side)
src/app/api/submissions/  grades and saves submissions
public/runners/      worker scripts for JavaScript, Python (Pyodide), SQL (sql.js)
content/             lessons (see "Writing lessons")
```

## How code runs and gets graded

All student code runs **in the student's browser**, so the free server never
executes code:

| Lesson type | Runs in | Time limit |
| --- | --- | --- |
| HTML / CSS / Bootstrap ("Build the page") | the visible preview iframe | loops in the page's scripts are stopped after 1 s; 5 s overall |
| JavaScript ("Write the function") | a Web Worker | 5 s, then the worker is killed |
| Python | Pyodide 0.29 (WebAssembly) in a Web Worker, loaded from the jsDelivr CDN | 5 s (download time not counted) |
| SQL ("Query the data") | sql.js (SQLite in WebAssembly) in a Web Worker, fresh copy of the dataset each run | 5 s |

Every runner lives inside an iframe with `sandbox="allow-scripts"` and **no**
`allow-same-origin`, so student code gets an opaque origin: it can't read the
app's cookies, call its API or touch the main page. Workers inside that iframe can
be killed instantly, so an infinite loop never freezes the tab. Page previews
can't use a worker (they need a DOM), so their scripts get automatic loop
protection (`src/lib/runners/loop-guard.ts`), as on CodePen.

**Grading.** The browser runner only *observes* (printed output, return values,
DOM facts, result rows) and sends that to `POST /api/submissions`. The server
grades the observations against `tests.json` (and `expected.json` for SQL), which
**never leave the server**, then saves the submission and the student's progress.
A client-sent "passed" is never trusted. Submissions are rate-limited (20 per
minute per student).

**Known limitation.** Because the code runs on the student's device, a determined
student could hand-craft observations (for example, post the expected output
without writing the code). The server can't detect that without running the code
itself. That's acceptable for a learning platform; for exams, plug in a
server-side runner (below).

**Adding a server-side runner later** (planned: self-hosted Judge0 or Piston for
Java, PHP, Node, Django, Flask...): implement the `Runner` interface in
`src/lib/runners/types.ts` so it produces the same `Observations`, and the
existing grading and submission code works unchanged.

## Writing lessons

Lessons are plain files, so anyone can add one with a pull request:

```
content/<track>/track.json            title, description, order, colour
content/<track>/<lesson>/lesson.md    frontmatter + lesson text (Markdown)
content/<track>/<lesson>/starter.*    code the editor starts with
content/<track>/<lesson>/solution.*   reference answer (never sent to browsers)
content/<track>/<lesson>/tests.json   grading tests
content/datasets/<name>.sql           SQLite datasets for SQL lessons
```

`lesson.md` frontmatter:

```yaml
title: Your first web page
order: 1                # position in the track
difficulty: beginner    # beginner | intermediate | advanced
xp: 20                  # awarded on first completion
type: page              # page (HTML/CSS) | function (JS/Python) | query (SQL)
language: html          # html | javascript | python | sql
summary: One line for the lesson map.
hints:                  # revealed one at a time
  - First hint
```

The exact formats of `tests.json` are defined (and documented) in
`src/lib/content/schema.ts`. For SQL lessons, run `npm run content:expected` to
generate `expected.json` from `solution.sql`.

`npm test` validates every lesson: files load, nothing secret reaches the browser,
and (for HTML, JavaScript and SQL) the solution passes every test while the starter
code does not. A typo fails the tests instead of breaking a page. After adding or
changing lessons, run `npm run db:seed` again.

## Notes

- **Roles are always checked on the server** against the database
  (`requireRole`), never only by hiding links.
- The rate limiter is in memory: fine for one free instance, and it resets when
  the service sleeps or restarts.
- GitHub sign-in links accounts by email address and needs a public email on
  the GitHub account.
