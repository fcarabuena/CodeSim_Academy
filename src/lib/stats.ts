import "server-only";
import { getBadgeDefinitions, listTracks, type LessonMeta, type Track } from "@/lib/content/loader";
import { db } from "@/lib/db";
import { levelProgress } from "@/lib/gamification/levels";
import { activeStreak, streakAtRisk } from "@/lib/gamification/streaks";
import { weekBounds } from "@/lib/gamification/week";
import { lessonKey, type ProgressMap } from "@/lib/progress";

/**
 * Read-side queries for the dashboard, profile and leaderboard. Each one is a
 * single small query on indexed columns, to stay light on the free database.
 */

export async function getStudentSummary(userId: string, now = new Date()) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      xp: true,
      currentStreak: true,
      longestStreak: true,
      lastActiveDate: true,
      timezone: true,
      createdAt: true,
    },
  });
  if (!user) return null;
  return {
    ...user,
    level: levelProgress(user.xp),
    streak: activeStreak(user, now, user.timezone),
    streakAtRisk: streakAtRisk(user, now, user.timezone),
  };
}

export type BadgeView = {
  slug: string;
  title: string;
  description: string;
  icon: string;
  awardedAt: Date | null;
};

/** Every badge from content/badges.json, with the date this student earned it (or null). */
export async function getBadgeShelf(userId: string): Promise<BadgeView[]> {
  const [definitions, owned] = await Promise.all([
    getBadgeDefinitions(),
    db.userBadge.findMany({ where: { userId }, select: { awardedAt: true, badge: { select: { slug: true } } } }),
  ]);
  const awarded = new Map(owned.map((o) => [o.badge.slug, o.awardedAt]));
  return definitions.map(({ slug, title, description, icon }) => ({
    slug,
    title,
    description,
    icon,
    awardedAt: awarded.get(slug) ?? null,
  }));
}

export type TrackProgress = { track: Track; completed: number; total: number };

export function trackProgress(tracks: Track[], progress: ProgressMap | null): TrackProgress[] {
  return tracks.map((track) => ({
    track,
    total: track.lessons.length,
    completed: track.lessons.filter((l) => progress?.get(lessonKey(track.slug, l.slug)) === "COMPLETED").length,
  }));
}

/**
 * "Continue where you left off": the next unfinished lesson in the track the
 * student last submitted to, else the first unfinished lesson anywhere.
 */
export async function getContinueLesson(
  userId: string,
  progress: ProgressMap | null,
): Promise<{ lesson: LessonMeta; track: Track; started: boolean } | null> {
  const [tracks, last] = await Promise.all([
    listTracks(),
    db.submission.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { lesson: { select: { slug: true, track: { select: { slug: true } } } } },
    }),
  ]);
  const done = (t: Track, l: LessonMeta) => progress?.get(lessonKey(t.slug, l.slug)) === "COMPLETED";

  const lastTrack = last && tracks.find((t) => t.slug === last.lesson.track.slug);
  if (lastTrack) {
    const lastIndex = lastTrack.lessons.findIndex((l) => l.slug === last.lesson.slug);
    const ordered = [...lastTrack.lessons.slice(lastIndex), ...lastTrack.lessons.slice(0, lastIndex)];
    const next = ordered.find((l) => !done(lastTrack, l));
    if (next) return { lesson: next, track: lastTrack, started: true };
  }
  for (const t of tracks) {
    const next = t.lessons.find((l) => !done(t, l));
    if (next) return { lesson: next, track: t, started: Boolean(last) };
  }
  return null;
}

export type LeaderboardRow = {
  userId: string;
  name: string;
  xp: number;
  lessons: number;
  rank: number;
};

/**
 * This week's leaderboard (Monday to Monday, UTC): XP from lessons first
 * completed this week. Students only. Returns the top `limit` plus the
 * current student's own row if they're further down, in one query.
 */
export async function getWeeklyLeaderboard(currentUserId: string | null, now = new Date(), limit = 20) {
  const { start, end } = weekBounds(now);
  const rows = await db.$queryRaw<{ userId: string; name: string | null; xp: number; lessons: number; rank: bigint }[]>`
    WITH weekly AS (
      SELECT u."id" AS "userId", u."name", SUM(l."xpReward")::int AS "xp", COUNT(*)::int AS "lessons",
             MAX(lp."completedAt") AS "reachedAt"
      FROM "LessonProgress" lp
      JOIN "Lesson" l ON l."id" = lp."lessonId"
      JOIN "User" u ON u."id" = lp."userId"
      WHERE lp."completedAt" >= ${start} AND lp."completedAt" < ${end} AND u."role" = 'STUDENT' AND u."disabledAt" IS NULL
      GROUP BY u."id", u."name"
    ),
    ranked AS (
      SELECT *, RANK() OVER (ORDER BY "xp" DESC, "reachedAt" ASC) AS "rank" FROM weekly
    )
    SELECT "userId", "name", "xp", "lessons", "rank" FROM ranked
    WHERE "rank" <= ${limit} OR "userId" = ${currentUserId ?? ""}
    ORDER BY "rank" ASC`;

  const all: LeaderboardRow[] = rows.map((r) => ({
    userId: r.userId,
    name: r.name?.trim() || "Anonymous learner",
    xp: r.xp,
    lessons: r.lessons,
    rank: Number(r.rank),
  }));
  return {
    start,
    end,
    top: all.filter((r) => r.rank <= limit),
    me: all.find((r) => r.userId === currentUserId) ?? null,
  };
}

