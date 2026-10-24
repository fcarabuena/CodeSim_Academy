import type { Metadata } from "next";
import Link from "next/link";
import { JoinClassForm } from "@/components/class-forms";
import { LevelCard, ProgressBar, StreakCard } from "@/components/stats-ui";
import { listTracks } from "@/lib/content/loader";
import { getProgressMap } from "@/lib/progress";
import { requireUser } from "@/lib/session";
import { getBadgeShelf, getContinueLesson, getStudentSummary, getWeeklyLeaderboard, trackProgress } from "@/lib/stats";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const [summary, badges, progress, tracks, board] = await Promise.all([
    getStudentSummary(user.id),
    getBadgeShelf(user.id),
    getProgressMap(user.id),
    listTracks(),
    getWeeklyLeaderboard(user.id, new Date(), 3),
  ]);
  if (!summary) return null;
  const next = await getContinueLesson(user.id, progress);

  const earned = badges
    .filter((b) => b.awardedAt)
    .sort((a, b) => b.awardedAt!.getTime() - a.awardedAt!.getTime());
  const perTrack = trackProgress(tracks, progress);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Hi, {summary.name ?? "there"} 👋</h1>
      <p className="mt-1 text-muted">Here&apos;s how you&apos;re doing.</p>

      {next ? (
        <Link
          href={`/tracks/${next.track.slug}/${next.lesson.slug}`}
          className="card mt-6 flex flex-col gap-3 border-indigo-200 bg-indigo-50 transition hover:border-indigo-400 sm:flex-row sm:items-center sm:justify-between dark:border-indigo-900 dark:bg-indigo-950/40"
        >
          <div>
            <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
              {next.started ? "Continue where you left off" : "Start your first lesson"}
            </p>
            <p className="mt-1 text-xl font-bold">{next.lesson.title}</p>
            <p className="text-sm text-muted">
              {next.track.title} · {next.lesson.xp} XP
            </p>
          </div>
          <span className="btn-primary self-start px-5 py-2.5 sm:self-auto">{next.started ? "Continue" : "Start"} →</span>
        </Link>
      ) : (
        <div className="card mt-6 bg-emerald-50 dark:bg-emerald-950/40">
          <p className="text-xl font-bold">🎓 You&apos;ve completed every lesson!</p>
          <p className="text-sm text-muted">New lessons are on the way. Revisit any lesson to practise and keep your streak.</p>
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <LevelCard level={summary.level} xp={summary.xp} />
        <StreakCard streak={summary.streak} longest={summary.longestStreak} atRisk={summary.streakAtRisk} />

        <div className="card">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-muted">Badges</p>
            <Link href="/profile" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              See all →
            </Link>
          </div>
          <p className="mt-1 text-4xl font-extrabold">
            {earned.length}
            <span className="text-base font-medium text-muted"> / {badges.length}</span>
          </p>
          {earned.length > 0 ? (
            <ul className="mt-3 flex gap-2">
              {earned.slice(0, 4).map((b) => (
                <li key={b.slug} title={`${b.title}: ${b.description}`} className="grid size-10 place-items-center rounded-full bg-violet-100 text-xl dark:bg-violet-950">
                  <span aria-hidden>{b.icon}</span>
                  <span className="sr-only">{b.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted">Complete your first lesson to earn a badge.</p>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <section className="card md:col-span-2">
          <h2 className="font-semibold">Your tracks</h2>
          <ul className="mt-4 space-y-4">
            {perTrack.map(({ track, completed, total }) => (
              <li key={track.slug}>
                <Link href={`/tracks/${track.slug}`} className="group block">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{track.title}</span>
                    <span className="text-muted">
                      {completed} / {total}
                    </span>
                  </div>
                  <ProgressBar completed={completed} total={total} className="mt-1.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">This week</h2>
            <Link href="/leaderboard" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Leaderboard →
            </Link>
          </div>
          {board.top.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nobody has scored this week yet. Be the first!</p>
          ) : (
            <ol className="mt-3 space-y-2 text-sm">
              {board.top.map((r) => (
                <li key={r.userId} className={`flex justify-between ${r.userId === user.id ? "font-semibold" : ""}`}>
                  <span>
                    {r.rank}. {r.name}
                  </span>
                  <span>{r.xp} XP</span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 border-t border-border pt-3 text-sm">
            {board.me ? (
              <>
                You&apos;re <b>#{board.me.rank}</b> with {board.me.xp} XP this week.
              </>
            ) : (
              <span className="text-muted">Complete a lesson this week to join the leaderboard.</span>
            )}
          </p>
        </section>
      </div>

      <section className="card mt-6 md:max-w-md">
        <h2 className="font-semibold">Join a class</h2>
        <p className="mt-1 mb-3 text-sm text-muted">Got a code from your teacher? Enter it here so they can follow your progress.</p>
        <JoinClassForm />
      </section>
    </div>
  );
}
