# CodeSim Academy

An e-learning platform where students learn programming through interactive,
auto-graded coding challenges and earn XP, levels, streaks and badges.

> **Status:** Phase 1 of 6 (project setup, auth, landing page). Full beginner
> setup and free deployment guides (Render + Neon) arrive in Phase 6.

## Tech stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- PostgreSQL via Prisma 7 (`@prisma/adapter-pg`)
- Auth.js v5 (email/password with bcrypt, optional GitHub OAuth)
- Zod validation, Vitest unit tests, Playwright end-to-end tests

## Run locally

Requirements: Node.js 22+, and Docker (for the local database).

```bash
npm install                 # also generates the Prisma client
cp .env.example .env        # then set AUTH_SECRET (npx auth secret)
docker compose up -d        # start Postgres on localhost:5432
npm run db:deploy           # create the tables
npm run dev                 # http://localhost:3000
```

No Docker? Any PostgreSQL 13+ works: put its URL in `DATABASE_URL` and `DIRECT_URL`.
A free [Neon](https://neon.tech) database works too.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run check` | Lint + type-check + unit tests |
| `npm run db:migrate` | Create a new migration after editing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply migrations |
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
```

## Notes

- **Roles are always checked on the server** against the database
  (`requireRole`), never only by hiding links.
- The rate limiter is in memory: fine for one free instance, and it resets when
  the service sleeps or restarts.
- GitHub sign-in links accounts by email address and needs a public email on
  the GitHub account.
