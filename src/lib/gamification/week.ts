/**
 * Leaderboard weeks run Monday 00:00 to Monday 00:00 UTC, the same for every
 * student so they compete over the same window. Computed from the clock when
 * requested, so there is no reset job to schedule.
 */
export function weekBounds(now: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}
