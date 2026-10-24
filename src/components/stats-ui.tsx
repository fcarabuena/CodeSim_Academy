import type { LevelProgress } from "@/lib/gamification/levels";

/** Small presentational pieces shared by the dashboard and profile. */

export function LevelCard({ level, xp }: { level: LevelProgress; xp: number }) {
  const toNext = level.xpForNextLevel - level.xpIntoLevel;
  return (
    <div className="card">
      <p className="text-sm font-medium text-muted">Level</p>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="text-4xl font-extrabold">{level.level}</span>
        <span className="text-sm text-muted">{xp} XP total</span>
      </div>
      <div
        className="mt-4 h-3 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-label={`Progress to level ${level.level + 1}`}
        aria-valuemin={0}
        aria-valuemax={level.xpForNextLevel}
        aria-valuenow={level.xpIntoLevel}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width]"
          style={{ width: `${Math.round(level.fraction * 100)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        {level.xpIntoLevel} / {level.xpForNextLevel} XP · {toNext} XP to level {level.level + 1}
      </p>
    </div>
  );
}

export function StreakCard({ streak, longest, atRisk }: { streak: number; longest: number; atRisk: boolean }) {
  return (
    <div className="card">
      <p className="text-sm font-medium text-muted">Daily streak</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`text-4xl ${streak > 0 ? "" : "grayscale"}`} aria-hidden>
          🔥
        </span>
        <span className="text-4xl font-extrabold">{streak}</span>
        <span className="text-sm text-muted">day{streak === 1 ? "" : "s"}</span>
      </div>
      <p className="mt-3 text-xs text-muted">
        {atRisk
          ? "Solve a challenge today to keep your streak!"
          : streak > 0
            ? "You've solved a challenge today. Nice!"
            : "Solve a challenge to start a streak."}{" "}
        Longest: {longest} day{longest === 1 ? "" : "s"}.
      </p>
    </div>
  );
}

export function ProgressBar({ completed, total, className = "" }: { completed: number; total: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-border ${className}`}>
      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${total ? (completed / total) * 100 : 0}%` }} />
    </div>
  );
}
