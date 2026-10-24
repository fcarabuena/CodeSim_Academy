import "server-only";
import type { ProgressStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

/** Key used to match database rows to content: "<track>/<lesson>". */
export const lessonKey = (trackSlug: string, lessonSlug: string) => `${trackSlug}/${lessonSlug}`;

export type ProgressMap = Map<string, ProgressStatus>;

/**
 * A student's lesson statuses keyed by lessonKey(). Pages render from the
 * content files and only overlay progress, so if the database is unreachable
 * we return null and the page still works.
 */
export async function getProgressMap(userId: string, trackSlug?: string): Promise<ProgressMap | null> {
  try {
    const rows = await db.lessonProgress.findMany({
      where: { userId, ...(trackSlug && { lesson: { track: { slug: trackSlug } } }) },
      select: { status: true, lesson: { select: { slug: true, track: { select: { slug: true } } } } },
    });
    return new Map(rows.map((r) => [lessonKey(r.lesson.track.slug, r.lesson.slug), r.status]));
  } catch (err) {
    console.error("Could not load progress", err);
    return null;
  }
}
