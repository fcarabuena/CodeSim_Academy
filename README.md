# CodeSim Academy

An e-learning platform where students learn programming through interactive,
auto-graded coding challenges and earn XP, levels, streaks and badges.

> **Status:** Phase 2 of 6 (setup, auth, lesson content, tracks and lesson pages,
> code editor). Running code, grading and XP arrive in the next phases; the full
> free deployment guide (Render + Neon) arrives in Phase 6.

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
content/             lessons (see "Writing lessons")
```

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
`src/lib/content/schema.ts`. `npm test` validates every lesson, so a typo fails the
tests instead of breaking a page. After adding or changing lessons, run
`npm run db:seed` again.

## Notes

- **Roles are always checked on the server** against the database
  (`requireRole`), never only by hiding links.
- The rate limiter is in memory: fine for one free instance, and it resets when
  the service sleeps or restarts.
- GitHub sign-in links accounts by email address and needs a public email on
  the GitHub account.
