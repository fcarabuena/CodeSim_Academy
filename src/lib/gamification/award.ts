import "server-only";
import { getBadgeDefinitions, listTracks } from "@/lib/content/loader";
import type { DbTx } from "@/lib/db";
import { newBadges } from "./badges";
import { levelForXp, levelProgress, type LevelProgress } from "./levels";
import { recordSolve } from "./streaks";

/**
 * Applies XP, level, streak and badge rewards for a passing submission.
 * Must run inside the submission's transaction, after lockUser(), so two
 * submissions arriving at once can't both award the same XP or badge.
 */

type Tx = DbTx;

export type Rewards = {
  xpGained: number;
  totalXp: number;
  previousLevel: number;
  level: LevelProgress;
  streak: { current: number; longest: number; extended: boolean };
  badges: { slug: string; title: string; description: string; icon: string }[];
};

/** Row-lock the student for the rest of the transaction (serialises their submissions). */
export async function lockUser(tx: Tx, userId: string) {
  const rows = await tx.$queryRaw<
    { xp: number; currentStreak: number; longestStreak: number; lastActiveDate: Date | null; timezone: string | null }[]
  >`SELECT "xp", "currentStreak", "longestStreak", "lastActiveDate", "timezone" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  const user = rows[0];
  if (!user) throw new Error("User not found");
  return user;
}

export async function applyRewards(
  tx: Tx,
  args: {
    userId: string;
    user: Awaited<ReturnType<typeof lockUser>>;
    lessonXp: number;
    firstCompletion: boolean;
    hintsUsed: number;
    now: Date;
  },
): Promise<Rewards> {
  const { userId, user, now } = args;

  // XP only for the first completion of a lesson.
  const xpGained = args.firstCompletion ? args.lessonXp : 0;
  const totalXp = user.xp + xpGained;
  const previousLevel = levelForXp(user.xp);
  const level = levelForXp(totalXp);
  const streak = recordSolve(user, now, user.timezone);

  await tx.user.update({
    where: { id: userId },
    data: {
      xp: totalXp,
      level,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastActiveDate: streak.lastActiveDate,
    },
  });

  // Badge context: completed lessons per track (one small grouped query).
  const [completedRows, ownedRows, tracks, definitions] = await Promise.all([
    tx.$queryRaw<{ slug: string; completed: number }[]>`
      SELECT t."slug", COUNT(*)::int AS "completed"
      FROM "LessonProgress" lp
      JOIN "Lesson" l ON l."id" = lp."lessonId"
      JOIN "Track" t ON t."id" = l."trackId"
      WHERE lp."userId" = ${userId} AND lp."status" = 'COMPLETED'
      GROUP BY t."slug"`,
    tx.userBadge.findMany({ where: { userId }, select: { badge: { select: { slug: true } } } }),
    listTracks(),
    getBadgeDefinitions(),
  ]);

  const completedBySlug = new Map(completedRows.map((r) => [r.slug, r.completed]));
  const trackStats = Object.fromEntries(
    tracks.map((t) => [t.slug, { completed: Math.min(completedBySlug.get(t.slug) ?? 0, t.lessons.length), total: t.lessons.length }]),
  );

  const earned = newBadges(
    definitions,
    {
      completedLessons: completedRows.reduce((sum, r) => sum + r.completed, 0),
      tracks: trackStats,
      currentStreak: streak.currentStreak,
      level,
      firstCompletionWithoutHints: args.firstCompletion && args.hintsUsed === 0,
    },
    new Set(ownedRows.map((r) => r.badge.slug)),
  );

  if (earned.length > 0) {
    const badgeRows = await tx.badge.findMany({
      where: { slug: { in: earned.map((b) => b.slug) } },
      select: { id: true, slug: true },
    });
    // Badges missing from the database (seed not re-run) are skipped, not fatal.
    await tx.userBadge.createMany({
      data: badgeRows.map((b) => ({ userId, badgeId: b.id, awardedAt: now })),
      skipDuplicates: true,
    });
    const inDb = new Set(badgeRows.map((b) => b.slug));
    earned.splice(0, earned.length, ...earned.filter((b) => inDb.has(b.slug)));
  }

  return {
    xpGained,
    totalXp,
    previousLevel,
    level: levelProgress(totalXp),
    streak: { current: streak.currentStreak, longest: streak.longestStreak, extended: streak.extended },
    badges: earned.map(({ slug, title, description, icon }) => ({ slug, title, description, icon })),
  };
}
