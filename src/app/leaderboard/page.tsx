import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getWeeklyLeaderboard } from "@/lib/stats";

export const metadata: Metadata = { title: "Leaderboard" };

const dayFormat = new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const MEDALS = ["🥇", "🥈", "🥉"];

export default async function LeaderboardPage() {
  const user = await requireUser();
  const now = new Date();
  const board = await getWeeklyLeaderboard(user.id, now);
  const daysLeft = Math.ceil((board.end.getTime() - now.getTime()) / 86_400_000);
  const lastDay = new Date(board.end.getTime() - 1);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Weekly leaderboard</h1>
      <p className="mt-2 text-muted">
        XP from lessons completed this week ({dayFormat.format(board.start)} to {dayFormat.format(lastDay)}). Resets
        every Monday at 00:00 UTC, {daysLeft <= 1 ? "in less than a day" : `in ${daysLeft} days`}.
      </p>

      {board.me && board.me.rank > board.top.length && (
        <p className="mt-6 rounded-lg bg-indigo-50 px-4 py-3 text-sm dark:bg-indigo-950/50">
          You&apos;re <b>#{board.me.rank}</b> this week with {board.me.xp} XP. Complete more lessons to climb!
        </p>
      )}

      {board.top.length === 0 ? (
        <div className="card mt-8 text-center">
          <p className="text-4xl" aria-hidden>
            🏆
          </p>
          <p className="mt-2 font-semibold">No one has scored this week yet.</p>
          <p className="text-sm text-muted">Complete a lesson to take the top spot.</p>
        </div>
      ) : (
        <div className="card mt-8 overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-border/40 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">Rank</th>
                <th className="px-4 py-2 font-semibold">Student</th>
                <th className="hidden px-4 py-2 text-right font-semibold sm:table-cell">Lessons</th>
                <th className="px-4 py-2 text-right font-semibold">XP</th>
              </tr>
            </thead>
            <tbody>
              {board.top.map((r) => {
                const isMe = r.userId === user.id;
                return (
                  <tr
                    key={r.userId}
                    className={`border-t border-border ${isMe ? "bg-indigo-50 font-semibold dark:bg-indigo-950/50" : ""}`}
                    aria-current={isMe ? "true" : undefined}
                  >
                    <td className="px-4 py-3">{MEDALS[r.rank - 1] ?? `#${r.rank}`}</td>
                    <td className="px-4 py-3">
                      {r.name}
                      {isMe && <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400">(you)</span>}
                    </td>
                    <td className="hidden px-4 py-3 text-right sm:table-cell">{r.lessons}</td>
                    <td className="px-4 py-3 text-right">{r.xp}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-muted">Only first-time lesson completions count, so re-solving a lesson won&apos;t move you up.</p>
    </div>
  );
}
