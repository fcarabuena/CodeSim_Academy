import type { BadgeCriteria, BadgeDefinition } from "@/lib/content/schema";

/**
 * Decides which badges a student has newly earned. Pure; called by the
 * server inside the submission transaction after each passing submission.
 */

export type BadgeContext = {
  /** Lessons completed in total (including the one just completed). */
  completedLessons: number;
  /** Per track slug: lessons completed and lessons in the track. */
  tracks: Record<string, { completed: number; total: number }>;
  currentStreak: number;
  level: number;
  /** The submission completed a lesson for the first time with no hints revealed. */
  firstCompletionWithoutHints: boolean;
};

export function meetsCriteria(c: BadgeCriteria, ctx: BadgeContext): boolean {
  const trackDone = (t?: { completed: number; total: number }) => !!t && t.total > 0 && t.completed >= t.total;
  switch (c.type) {
    case "lessons_completed":
      return ctx.completedLessons >= c.count;
    case "track_completed":
      return trackDone(ctx.tracks[c.track]);
    case "any_track_completed":
      return Object.values(ctx.tracks).some(trackDone);
    case "streak":
      return ctx.currentStreak >= c.days;
    case "level":
      return ctx.level >= c.level;
    case "no_hints":
      return ctx.firstCompletionWithoutHints;
  }
}

/** Badges the student qualifies for and doesn't have yet, in definition order. */
export function newBadges(definitions: BadgeDefinition[], ctx: BadgeContext, owned: ReadonlySet<string>): BadgeDefinition[] {
  return definitions.filter((b) => !owned.has(b.slug) && meetsCriteria(b.criteria, ctx));
}
