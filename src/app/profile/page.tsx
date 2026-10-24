import type { Metadata } from "next";
import Link from "next/link";
import { logOutAction } from "@/app/(auth)/actions";
import { LevelCard, ProgressBar, StreakCard } from "@/components/stats-ui";
import { listTracks } from "@/lib/content/loader";
import { getProgressMap } from "@/lib/progress";
import { requireUser } from "@/lib/session";
import { getBadgeShelf, getStudentSummary, trackProgress } from "@/lib/stats";

export const metadata: Metadata = { title: "Profile" };

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

export default async function ProfilePage() {
  const user = await requireUser();
  const [summary, badges, progress, tracks] = await Promise.all([
    getStudentSummary(user.id),
    getBadgeShelf(user.id),
    getProgressMap(user.id),
    listTracks(),
  ]);
  if (!summary) return null;

  const perTrack = trackProgress(tracks, progress);
  const completedLessons = perTrack.reduce((n, t) => n + t.completed, 0);
  const totalLessons = perTrack.reduce((n, t) => n + t.total, 0);
  const earnedCount = badges.filter((b) => b.awardedAt).length;
  const displayName = summary.name ?? summary.email;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid size-16 place-items-center rounded-full bg-indigo-600 text-2xl font-bold text-white" aria-hidden>
          {displayName.charAt(0).toUpperCase()}
        </span>
        <div>
          <h1 className="text-3xl font-bold">{displayName}</h1>
          <p className="text-sm text-muted">
            Level {summary.level.level} · {completedLessons} of {totalLessons} lessons · learning since{" "}
            {dateFormat.format(summary.createdAt)}
          </p>
        </div>
        <form action={logOutAction} className="sm:ml-auto">
          <button type="submit" className="btn-secondary">
            Log out
          </button>
        </form>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <LevelCard level={summary.level} xp={summary.xp} />
        <StreakCard streak={summary.streak} longest={summary.longestStreak} atRisk={summary.streakAtRisk} />
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-bold">
          Badges <span className="text-base font-medium text-muted">({earnedCount} of {badges.length})</span>
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {badges.map((b) => (
            <li
              key={b.slug}
              className={`card flex items-start gap-3 p-4 ${b.awardedAt ? "" : "opacity-60"}`}
            >
              <span
                className={`grid size-12 shrink-0 place-items-center rounded-full text-2xl ${
                  b.awardedAt ? "bg-violet-100 dark:bg-violet-950" : "bg-border grayscale"
                }`}
                aria-hidden
              >
                {b.awardedAt ? b.icon : "🔒"}
              </span>
              <div>
                <p className="font-semibold">{b.title}</p>
                <p className="text-xs text-muted">{b.description}</p>
                <p className="mt-1 text-xs font-medium">
                  {b.awardedAt ? (
                    <span className="text-emerald-700 dark:text-emerald-400">Earned {dateFormat.format(b.awardedAt)}</span>
                  ) : (
                    <span className="text-muted">Locked</span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Progress</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {perTrack.map(({ track, completed, total }) => (
            <li key={track.slug}>
              <Link href={`/tracks/${track.slug}`} className="card group block p-4 hover:border-indigo-400">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{track.title}</span>
                  <span className="text-sm text-muted">
                    {completed === total ? "✓ Complete" : `${completed} / ${total}`}
                  </span>
                </div>
                <ProgressBar completed={completed} total={total} className="mt-2" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
