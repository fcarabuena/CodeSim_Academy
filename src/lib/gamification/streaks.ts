/**
 * Daily streaks, computed from timestamps (nothing scheduled, so it works on
 * a free server that sleeps).
 *
 * A streak grows by one when a student solves a challenge on a new calendar
 * day in their own timezone (UTC if unknown), and starts over at 1 when they
 * skip a day. "Solves a challenge" means any passing submission, including
 * re-solving a lesson for practice.
 */

/** Calendar day "YYYY-MM-DD" of `date` in `timeZone` (falls back to UTC). */
export function localDay(date: Date, timeZone?: string | null): string {
  const format = (tz: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  try {
    return format(timeZone || "UTC");
  } catch {
    return format("UTC");
  }
}

/** Whole days from day `a` to day `b` (both "YYYY-MM-DD"). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
};

export type StreakUpdate = StreakState & {
  /** True when this solve made the streak longer (or started it). */
  extended: boolean;
};

/** New streak state after a passing submission at `now`. */
export function recordSolve(state: StreakState, now: Date, timeZone?: string | null): StreakUpdate {
  const today = localDay(now, timeZone);
  const last = state.lastActiveDate ? localDay(state.lastActiveDate, timeZone) : null;
  const gap = last ? daysBetween(last, today) : null;

  let current: number;
  if (gap === 0) current = Math.max(state.currentStreak, 1); // already counted today
  else if (gap === 1) current = state.currentStreak + 1; // consecutive day
  else current = 1; // first solve ever, a missed day, or a clock/timezone jump backwards

  return {
    currentStreak: current,
    longestStreak: Math.max(state.longestStreak, current),
    lastActiveDate: now,
    extended: gap !== 0,
  };
}

/**
 * The streak to display at `now`: the stored streak is only still alive if
 * the student solved something today or yesterday.
 */
export function activeStreak(state: StreakState, now: Date, timeZone?: string | null): number {
  if (!state.lastActiveDate) return 0;
  const gap = daysBetween(localDay(state.lastActiveDate, timeZone), localDay(now, timeZone));
  return gap === 0 || gap === 1 ? state.currentStreak : 0;
}

/** True when the streak is alive but nothing has been solved yet today. */
export function streakAtRisk(state: StreakState, now: Date, timeZone?: string | null): boolean {
  if (!state.lastActiveDate) return false;
  return daysBetween(localDay(state.lastActiveDate, timeZone), localDay(now, timeZone)) === 1;
}
