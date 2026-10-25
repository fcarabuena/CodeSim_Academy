# CodeSim Academy

A free e-learning platform where students learn to code through short lessons and
interactive, auto-graded challenges, and earn XP, levels, daily streaks and badges.
Teachers create classes and follow their students' progress.

- **14 beginner lessons** in 5 tracks: HTML & CSS, Bootstrap, JavaScript, Python and SQL
- **In-browser code editor** (Monaco, the editor behind VS Code) with Run and Submit
- **All code runs in the student's browser**: web pages in a sandboxed preview,
  JavaScript, Python (Pyodide) and SQL (sql.js) in sandboxed workers with time limits
- **Graded on the server** against hidden tests, with friendly per-test feedback and hints
- **Gamification**: XP, levels, daily streaks, 11 badges, a weekly leaderboard
- **Teachers**: create a class, share a join code, see every student's progress and code
- **Costs $0** to run: one free Render web service plus a free Neon database

**Contents**

1. [Run it on your computer](#1-run-it-on-your-computer)
2. [Deploy it for free (Render + Neon)](#2-deploy-it-for-free-render--neon)
3. [What to expect on the free tier](#3-what-to-expect-on-the-free-tier)
4. [Teachers and classes](#4-teachers-and-classes)
5. [Commands](#5-commands)
6. [Tests](#6-tests)
7. [How code runs and gets graded](#7-how-code-runs-and-gets-graded)
8. [XP, levels, streaks and badges](#8-xp-levels-streaks-and-badges)
9. [Writing lessons](#9-writing-lessons)
10. [Project layout](#10-project-layout)
11. [Security notes](#11-security-notes)
12. [Roadmap](#12-roadmap)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Run it on your computer

### What you need

1. **Node.js 24.22.1 or newer** (the version is also in `.nvmrc`). Download the
   "LTS" installer from [nodejs.org](https://nodejs.org) and run it. Check it worked
   by opening a terminal (on Windows: *PowerShell*; on macOS: *Terminal*) and typing:

   ```bash
   node -v     # should print v24.22.1 or higher
   ```

   Use the **24 LTS** line (what the live site runs). Node 26 currently makes
   `npm run dev` reload the page in an endless loop (the dev server's own log file
   triggers its file watcher); production isn't affected, but development is.

   Already have an older Node? Run the newer installer over it, or on Windows run
   `winget upgrade OpenJS.NodeJS.LTS`. If you use a version manager (nvm, fnm,
   nvm-windows), `nvm install 24.22.1` then `nvm use 24.22.1`.

2. **Git**, to download the code and later publish it. Get it from
   [git-scm.com](https://git-scm.com/downloads).
3. **A database.** The easiest is a free Neon database (Option A below). If you
   already use Docker, Option B runs one on your computer.

### Get the code and install

```bash
git clone https://github.com/<you>/codesim-academy.git
cd codesim-academy
npm install          # downloads everything and generates the database client
cp .env.example .env # your private settings file (never commit it)
```

On Windows PowerShell, use `copy .env.example .env` instead of `cp`.

Open `.env` in a text editor. Set `AUTH_SECRET` to a long random value. You can
generate one with:

```bash
npx auth secret
```

### Option A: a free Neon database (no Docker needed)

Neon is hosted PostgreSQL with a free plan that never expires. You can use the same
database for your computer and for the deployed site, or make a separate Neon
*branch* for testing.

1. Sign up at [neon.tech](https://neon.tech) (no credit card) and create a project.
   Pick the region closest to where you'll host the app (see step 2.3).
2. On the project dashboard click **Connect**. You need **two** connection strings:
   - **Connection pooling ON**: copy the string. Its host contains `-pooler`.
     This is your `DATABASE_URL` (used by the app).
   - **Connection pooling OFF**: copy it again (same host *without* `-pooler`).
     This is your `DIRECT_URL` (used for migrations and seeding).
3. Paste them into `.env`, keeping the quotes:

   ```env
   DATABASE_URL="postgresql://neondb_owner:...@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require"
   DIRECT_URL="postgresql://neondb_owner:...@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
   AUTH_SECRET="the value from npx auth secret"
   AUTH_URL="http://localhost:3000"
   ```

### Option B: Docker

```bash
docker compose up -d   # starts Postgres on localhost:5432
```

The default URLs in `.env.example` already point at it. Any other PostgreSQL 13+
server works too: put its URL in both `DATABASE_URL` and `DIRECT_URL`.

### Create the tables, load the lessons, start the app

```bash
npm run db:deploy   # creates the tables ("All migrations have been successfully applied.")
npm run db:seed     # copies tracks, lessons and badges from /content into the database
npm run dev         # open http://localhost:3000
```

Sign up, and you're in. To get the teacher dashboard, see
[Teachers and classes](#4-teachers-and-classes).

> **Why two database URLs?** The pooled URL lets many app requests share a few
> connections, which is right for a website. Migrations need a direct connection,
> so the Prisma tools use `DIRECT_URL` (see `prisma.config.ts`).

---

## 2. Deploy it for free (Render + Neon)

You'll put the code on GitHub, then Render builds and runs it from there. Every step
uses free plans; you won't be asked for a credit card.

### 2.1 Create the Neon database

If you followed Option A above you already have one. Otherwise follow Option A
steps 1 and 2 and keep both connection strings handy. Note the **region** you
picked (e.g. *AWS US East 2 (Ohio)*).

> Don't use Render's own free PostgreSQL: it's deleted about 30 days after you
> create it. Neon's free plan doesn't expire. (Supabase's free Postgres also works,
> but it pauses after a week without activity.)

### 2.2 Put the code on GitHub

1. Create a free account at [github.com](https://github.com) if you don't have one.
2. Click **New repository**, name it (e.g. `codesim-academy`), leave it empty (no
   README), and create it. Private is fine.
3. In your project folder, run the commands GitHub shows under "push an existing
   repository", which look like:

   ```bash
   git remote add origin https://github.com/<you>/codesim-academy.git
   git push -u origin main
   ```

Your `.env` file is **not** uploaded (it's in `.gitignore`), so your passwords stay
on your computer.

### 2.3 Create the Render service from the Blueprint

1. Sign up at [render.com](https://render.com) with your GitHub account.
2. In the Render dashboard click **New +** then **Blueprint**.
3. Connect your GitHub account if asked, and pick your `codesim-academy` repository.
   Render reads `render.yaml` and shows one free **web service**.
4. Fill in the values it asks for:

   | Variable | What to paste |
   | --- | --- |
   | `DATABASE_URL` | Neon **pooled** string (host contains `-pooler`) |
   | `DIRECT_URL` | Neon **direct** string (no `-pooler`) |
   | `AUTH_URL` | `https://codesim-academy.onrender.com` (fix it in step 2.5 if Render picks a different name) |
   | `GITHUB_ID`, `GITHUB_SECRET` | leave empty (optional, see 2.7) |

   `AUTH_SECRET` is generated for you.

   The Blueprint puts the service in the **ohio** region to sit next to a Neon
   project in *AWS US East 2 (Ohio)*. If your Neon project is somewhere else, change
   `region:` in `render.yaml` before this step (e.g. `frankfurt` or `singapore`) and
   push the change.
5. Click **Apply**. Render installs everything, applies the database migrations and
   builds the app. The first build takes a few minutes; watch the log until it says
   the service is **Live**.

### 2.4 Load the lessons into the database (from your computer)

Free Render services have no shell, so you run the seed script from your own
computer against the same Neon database:

```bash
# .env must contain the same Neon DIRECT_URL you gave Render
npm run db:seed
```

You should see a ✓ for each track and "✓ Badges: 11". Run it again whenever you
add or change lessons or badges.

### 2.5 Check the address and AUTH_URL

1. At the top of your service page Render shows its address, like
   `https://codesim-academy.onrender.com` (if the name was taken, it adds letters,
   e.g. `codesim-academy-x1y2.onrender.com`).
2. Go to **Environment**, make sure `AUTH_URL` is exactly that address (with
   `https://`, without a trailing `/`), and **Save**. Render redeploys
   automatically. Login won't work until this matches.

### 2.6 Try it and make yourself a teacher

Open your address, sign up, then from your computer:

```bash
npm run set-role -- you@example.com TEACHER   # or ADMIN to see every class
```

Log out and back in to see **Teacher** in the header.

### 2.7 Optional: "Continue with GitHub"

1. On GitHub go to **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Homepage URL: your Render address. Authorization callback URL:
   `https://<your-address>/api/auth/callback/github`.
3. Create it, generate a client secret, and paste the **Client ID** into `GITHUB_ID`
   and the secret into `GITHUB_SECRET` on Render. Save. The GitHub button appears
   after the redeploy.

### Updating the site

Push to GitHub (`git push`) and Render rebuilds and redeploys automatically. New
database migrations are applied during the build. If you changed lessons or
badges, run `npm run db:seed` from your computer afterwards.

---

## 3. What to expect on the free tier

Everything here is designed for free plans, but free plans have limits:

- **The site sleeps.** A free Render service stops after about **15 minutes** with
  no visitors. The next visitor waits **up to about a minute** while it wakes up
  (Render shows a loading page first). After that it's fast again.
- **The database sleeps too.** Neon's free compute pauses after about 5 minutes
  without queries, and the first query afterwards takes a few seconds. The app
  waits up to 15 seconds and retries once, and shows a friendly loading screen.
- **Monthly allowances.** Render gives free services a monthly number of running
  hours (enough for one service running all month), and Neon's free plan has a
  storage limit (0.5 GB, plenty for thousands of students' progress) and a monthly
  compute allowance. Check [render.com/pricing](https://render.com/pricing) and
  [neon.tech/pricing](https://neon.tech/pricing) for the current numbers.
- **512 MB of memory.** The server never runs student code (browsers do), so this
  is enough.
- **No shell, no persistent disk.** The server's disk is wiped on every deploy and
  restart, so the app stores nothing there: all data lives in Neon.
- **Nothing runs on a timer.** Streaks and the weekly leaderboard are calculated
  from timestamps when someone looks at them, so it doesn't matter that the server
  sleeps.
- **Rate limits reset on sleep.** Log-in and submission limits are kept in memory,
  so they reset when the service restarts. That only ever makes them more lenient.

---

## 4. Teachers and classes

1. A teacher signs up like everyone else, then you give them the role:
   `npm run set-role -- teacher@school.org TEACHER`. They log out and back in.
2. On **Teacher** they create a class and get a 6-character **join code**
   (e.g. `K7Q4MZ`). Codes avoid look-alike characters such as 0/O and 1/I.
3. Students enter the code under **Join a class** on their dashboard.
4. The class page shows every student's lessons completed, XP, level, streak and
   when they were last active, plus the latest submissions. Click a student to see
   their progress per lesson, attempts, best scores, and the exact code they
   submitted with its test results.

Teachers only ever see their own classes. On a class page a teacher can also
**remove a student** (they keep their account and progress) or make a **new join
code** (the old one stops working).

### Admins

Make someone an admin with `npm run set-role -- email ADMIN` (they log out and back
in). The **Admin** area (`/admin`) is separate from the Teacher side:

- **Overview:** totals for users, students, teachers, classes, submissions, lessons
  completed and active users this week.
- **Users:** search and page through everyone (emails are partly hidden), change a
  role, disable or re-enable an account (disabled users can't log in or submit, and
  are signed out), or delete an account after a confirmation.
- **Classes:** every class with its teacher, students and code; move a class to
  another teacher or delete it.
- **Content:** tracks, lessons and badges with how many students started, completed
  or earned them (read-only: lessons live in `content/`).
- **Audit log:** every admin action (and teachers' class changes) with who, what,
  target and when. The `set-role` script is logged too.

Safety rules: an admin can't change, disable or delete their own account, and the
last active admin can't be demoted, disabled or deleted (also enforced by
`set-role`). The proxy and every admin page and action check the role, and admin
actions are rate-limited. Every
teacher page checks the role and class ownership on the server. Joining is
rate-limited to stop code guessing.

---

## 5. Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app for development on http://localhost:3000 |
| `npm run build` / `npm start` | Production build / start it |
| `npm run check` | Lint + type-check + unit tests |
| `npm run test:e2e` | Browser smoke test (see below) |
| `npm run db:deploy` | Apply database migrations |
| `npm run db:seed` | Sync tracks, lessons and badges from `/content` (safe to re-run) |
| `npm run db:migrate` | Create a new migration after editing `prisma/schema.prisma` |
| `npm run db:studio` | Browse the database in your browser |
| `npm run content:expected` | Regenerate `expected.json` for SQL lessons |
| `npm run set-role -- <email> <STUDENT\|TEACHER\|ADMIN>` | Change someone's role |
| `npm install-scripts ls` | List dependencies whose install scripts haven't been reviewed |

---

## 6. Tests

```bash
npm run check        # lint, type-check and unit tests (no database needed)
```

The unit tests cover the XP/level formula, streaks (including timezones and
daylight saving), badge awarding, SQL result comparison, grading, loop protection,
and every lesson file: each HTML, JavaScript and SQL solution must pass its tests
and each starter must fail.

```bash
npm run build
npm run test:e2e     # browser smoke test
```

**Continuous integration.** `.github/workflows/ci.yml` runs lint, type-check,
unit tests and the production build on GitHub for every push to `main` and every
pull request. It uses a read-only token, actions pinned to commit SHAs, no
secrets and no database.

The smoke test opens a real browser, signs up a student, solves **all 14 lessons**
through the editor (so every runner, including Python, is exercised), checks that
infinite loops are stopped, and runs the teacher flow (create a class, a student
joins, the teacher sees their progress). It uses the database in `.env` (or
`E2E_DATABASE_URL`) and **deletes the accounts it created** when it finishes. It
starts the app on port 3100, or set `E2E_BASE_URL` to test a running site. The
first time, install the browser with `npx playwright install chromium`.

---

## 7. How code runs and gets graded

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

Pyodide is pinned to the 0.29 line because newer releases only run as *module*
workers, which browsers don't allow inside an opaque-origin sandbox.

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
server-side runner (see [Roadmap](#12-roadmap)).

---

## 8. XP, levels, streaks and badges

All rewards are decided **on the server, inside the same database transaction
that saves the submission**. The transaction first locks the student's row, so
two submissions arriving at once can't both award the same XP or badge.

- **XP**: each lesson's `xp` from its frontmatter, awarded on the **first**
  completion only. Re-solving a lesson is fine for practice but earns nothing.
- **Levels**: reaching level *n* takes `100 × (n − 1)^1.5` total XP (level 2 at
  100 XP, 3 at 283, 4 at 520, 5 at 800). The formula lives in one function,
  `src/lib/gamification/levels.ts`.
- **Daily streak**: grows by one when a student passes any challenge on a new
  calendar day in **their own timezone** (saved from the browser; UTC if unknown),
  and starts again at 1 after a missed day.
- **Badges**: defined in `content/badges.json` (criteria: lessons completed, a
  specific track or any track completed, streak length, level reached, or a lesson
  completed without revealing hints) and checked by one function after every
  passing submission. Run `npm run db:seed` after editing badges.
- **Weekly leaderboard**: XP from lessons first completed this week, Monday 00:00 to
  Monday 00:00 **UTC** (one shared window for everyone), students only.

"No Hints Needed" relies on the browser reporting how many hints were revealed,
so like the code observations it's an honour system.

---

## 9. Writing lessons

Lessons are plain files, so anyone can add one with a pull request:

```
content/<track>/track.json            title, description, order, colour
content/<track>/<lesson>/lesson.md    frontmatter + lesson text (Markdown)
content/<track>/<lesson>/starter.*    code the editor starts with
content/<track>/<lesson>/solution.*   reference answer (never sent to browsers)
content/<track>/<lesson>/tests.json   grading tests
content/<track>/<lesson>/expected.json  SQL only: generated from solution.sql
content/datasets/<name>.sql           SQLite datasets for SQL lessons
content/badges.json                   badges and their criteria
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

Test formats (`tests.json`) are defined and documented in
`src/lib/content/schema.ts`:

- **page**: DOM checks such as `exists`, `count`, `text`, `attr`, `hasClass` and
  `style` (CSS values like `#2563eb`, `yellow` or `rgb(...)` all compare equal).
- **function**: `returns` (call the function with `args`, compare to `expected`)
  or `stdout` (compare what the program printed).
- **query**: `columns` and `rows` checks against the solution's result; set
  `"ordered": true` when the lesson asks for `ORDER BY`. Run
  `npm run content:expected` after changing a solution.

Then run `npm test` (it validates every lesson) and `npm run db:seed`.

---

## 10. Project layout

```
content/                 lessons, datasets and badges
prisma/                  database schema, migrations, seed script
public/runners/          worker scripts: JavaScript, Python (Pyodide), SQL (sql.js)
scripts/                 content:expected and set-role helpers
src/app/                 pages (Next.js App Router)
  (auth)/                log in, sign up
  tracks/                tracks, lesson map, lesson page
  dashboard/ profile/ leaderboard/
  teacher/               teacher dashboard, class and student pages
  api/submissions/       grades and saves submissions
  api/health/            health check for Render (doesn't touch the database)
src/auth.ts              Auth.js configuration
src/proxy.ts             redirects signed-out visitors away from private pages
src/lib/content/         lesson loader + Zod schemas
src/lib/runners/         Runner interface, browser runners, page probe, loop guard
src/lib/grading/         grading (server-side, pure functions)
src/lib/gamification/    levels, streaks, badges, leaderboard week, award.ts
src/lib/classes.ts       classes and join codes
tests/e2e/               Playwright smoke test
render.yaml              Render Blueprint (one free web service)
```

Tech stack: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Prisma 7 with
PostgreSQL, Auth.js v5, Zod, Monaco editor, Vitest and Playwright.

---

## 11. Security notes

- Student code never runs on the server or in the main page: only in sandboxed
  iframes without `allow-same-origin`, mostly inside killable workers.
- Expected answers stay on the server; the browser only receives what it needs to
  run the code.
- Every API input is validated with Zod. Roles and class ownership are checked on
  the server against the database, never only by hiding links.
- Passwords are hashed with bcrypt; log-in, sign-up, submissions and class joining
  are rate-limited.
- No secrets in the repository: settings live in `.env` (local) and Render's
  environment variables. `render.yaml` only names the variables.
- Dependencies are installed with `npm ci` from the committed `package-lock.json`,
  so every install gets exactly the reviewed versions. npm 11 blocks dependency
  install scripts unless they're listed in `allowScripts` in `package.json`; only
  four are approved (Prisma, esbuild, unrs-resolver), each pinned to its version.
  After upgrading one of them, review and approve it again with
  `npm install-scripts approve <package>`.
- The proxy reads the signed session cookie to send signed-out visitors to log in
  and students away from teacher pages before anything renders; the pages then
  check the role again in the database.
- **Turn on two-factor authentication (2FA)** for every account that can change
  this app: GitHub (the code and CI), npm (if you publish packages), Render (the
  running site and its environment variables) and Neon (the database).
- GitHub sign-in links accounts by email address and needs a public email on the
  GitHub account.

---

## 12. Roadmap

The MVP leaves clean extension points for these planned phases:

1. **Server-side code runner** for languages browsers can't run (Java, PHP,
   Node.js, Laravel, Django, Flask), using a self-hosted
   [Judge0](https://judge0.com) or [Piston](https://github.com/engineer-man/piston).
   Implement the `Runner` interface in `src/lib/runners/types.ts` so it returns the
   same `Observations`; grading, submissions and rewards work unchanged. This also
   closes the "hand-crafted observations" gap for exams. (Needs a paid or
   self-hosted server: it won't fit the free tier.)
2. **Per-student practice databases** (PostgreSQL, MySQL, MongoDB) for real
   database lessons beyond SQLite: a new `query` runner that provisions a schema per
   student and reuses the existing SQL comparison.
3. **Cloud labs** with [LocalStack](https://localstack.cloud) (an AWS emulator), so
   students can practise AWS services without a cloud account.

---

## 13. Troubleshooting

| Problem | Fix |
| --- | --- |
| Login does nothing or redirects to the wrong site | `AUTH_URL` must exactly match the address in your browser (Render: `https://...onrender.com`, local: `http://localhost:3000`). |
| "This lesson isn't set up in the database yet" | Run `npm run db:seed` against the same database. |
| Build fails at `prisma migrate deploy` | Check `DIRECT_URL` on Render is the Neon string **without** `-pooler`. |
| First page load takes a long time | Normal on the free tier: the service and database are waking up. |
| Python "Loading…" for a while | The first Python run downloads Pyodide (about 10 MB) and caches it. Later runs are instant. |
| No **Teacher** link after `set-role` | Log out and back in. |
| `npm run set-role` says "No user" | The person has to sign up on the site first. |
| `npm ci` ends with "install scripts … skipped" | A dependency with an install script changed version. Review it with `npm install-scripts ls`, then `npm install-scripts approve <package>`. |
| `npm warn EBADENGINE` | Your Node is older than 24.22.1. Update it (see section 1). |
