import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { maskEmail } from "@/lib/admin-rules";
import { getBadgeDefinitions, listTracks } from "@/lib/content/loader";
import { db, type DbTx } from "@/lib/db";
import { requireRole, type CurrentUser } from "@/lib/session";

/**
 * Admin area data access. Every exported read checks the role itself, so a
 * page can't forget to; actions additionally re-check inside their
 * transaction. Queries are single, small statements for the free database.
 */

export const PAGE_SIZE = 20;

export const requireAdmin = () => requireRole("ADMIN");

export const userLabel = (u: { name: string | null; email: string }) =>
  u.name ? `${u.name} (${maskEmail(u.email)})` : maskEmail(u.email);

export async function writeAudit(
  tx: DbTx,
  actor: Pick<CurrentUser, "id" | "name" | "email"> | null,
  entry: { action: string; targetType: string; targetId?: string | null; targetLabel: string; details?: Prisma.InputJsonValue },
) {
  await tx.auditLog.create({
    data: {
      actorId: actor?.id ?? null,
      actorLabel: actor ? userLabel(actor) : "set-role script",
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      targetLabel: entry.targetLabel,
      details: entry.details,
    },
  });
}

/** Row-locks every admin and returns how many are enabled (for the "last admin" rule). */
export async function lockAdmins(tx: DbTx): Promise<number> {
  const rows = await tx.$queryRaw<{ disabledAt: Date | null }[]>`
    SELECT "disabledAt" FROM "User" WHERE "role" = 'ADMIN' FOR UPDATE`;
  return rows.filter((r) => r.disabledAt === null).length;
}

// --- Overview -----------------------------------------------------------------

export async function getOverview(now = new Date()) {
  await requireAdmin();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const [row] = await db.$queryRaw<
    {
      users: number;
      students: number;
      teachers: number;
      admins: number;
      disabled: number;
      classes: number;
      submissions: number;
      completed: number;
      activeWeek: number;
      newWeek: number;
    }[]
  >`
    SELECT
      (SELECT COUNT(*)::int FROM "User") AS "users",
      (SELECT COUNT(*)::int FROM "User" WHERE "role" = 'STUDENT') AS "students",
      (SELECT COUNT(*)::int FROM "User" WHERE "role" = 'TEACHER') AS "teachers",
      (SELECT COUNT(*)::int FROM "User" WHERE "role" = 'ADMIN') AS "admins",
      (SELECT COUNT(*)::int FROM "User" WHERE "disabledAt" IS NOT NULL) AS "disabled",
      (SELECT COUNT(*)::int FROM "Classroom") AS "classes",
      (SELECT COUNT(*)::int FROM "Submission") AS "submissions",
      (SELECT COUNT(*)::int FROM "LessonProgress" WHERE "status" = 'COMPLETED') AS "completed",
      (SELECT COUNT(DISTINCT "userId")::int FROM "Submission" WHERE "createdAt" >= ${weekAgo}) AS "activeWeek",
      (SELECT COUNT(*)::int FROM "User" WHERE "createdAt" >= ${weekAgo}) AS "newWeek"`;
  return row!;
}

// --- Users --------------------------------------------------------------------

export const userFilterSchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  role: z.enum(["STUDENT", "TEACHER", "ADMIN", "DISABLED", ""]).optional().default(""),
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
});
export type UserFilter = z.infer<typeof userFilterSchema>;

export type AdminUserRow = {
  id: string;
  name: string | null;
  maskedEmail: string;
  role: "STUDENT" | "TEACHER" | "ADMIN";
  xp: number;
  createdAt: Date;
  lastActive: Date | null;
  disabled: boolean;
  classesTaught: number;
};

export async function listUsers(filter: UserFilter): Promise<{ rows: AdminUserRow[]; total: number; pages: number }> {
  await requireAdmin();
  const where: Prisma.UserWhereInput = {
    ...(filter.q && {
      OR: [{ name: { contains: filter.q, mode: "insensitive" } }, { email: { contains: filter.q, mode: "insensitive" } }],
    }),
    ...(filter.role === "DISABLED" ? { disabledAt: { not: null } } : filter.role ? { role: filter.role } : {}),
  };
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        xp: true,
        createdAt: true,
        lastActiveDate: true,
        disabledAt: true,
        _count: { select: { classesTaught: true } },
      },
    }),
  ]);
  // Latest submission per user on this page: one grouped query for 20 ids.
  const latest = users.length
    ? await db.submission.groupBy({ by: ["userId"], where: { userId: { in: users.map((u) => u.id) } }, _max: { createdAt: true } })
    : [];
  const lastSubmission = new Map(latest.map((l) => [l.userId, l._max.createdAt]));
  return {
    total,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows: users.map((u) => ({
      id: u.id,
      name: u.name,
      maskedEmail: maskEmail(u.email),
      role: u.role,
      xp: u.xp,
      createdAt: u.createdAt,
      lastActive: lastSubmission.get(u.id) ?? u.lastActiveDate,
      disabled: u.disabledAt !== null,
      classesTaught: u._count.classesTaught,
    })),
  };
}

// --- Classes ------------------------------------------------------------------

export async function listAllClasses() {
  await requireAdmin();
  const [classes, staff] = await Promise.all([
    db.classroom.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        code: true,
        createdAt: true,
        teacher: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true } },
      },
    }),
    // Possible new owners: enabled teachers and admins.
    db.user.findMany({
      where: { role: { in: ["TEACHER", "ADMIN"] }, disabledAt: null },
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true, email: true },
    }),
  ]);
  return {
    classes: classes.map((c) => ({ ...c, teacherLabel: userLabel(c.teacher) })),
    staff: staff.map((s) => ({ id: s.id, label: userLabel(s) })),
  };
}

// --- Content ------------------------------------------------------------------

export async function getContentStats() {
  await requireAdmin();
  const [tracks, badges, lessonRows, badgeRows] = await Promise.all([
    listTracks(),
    getBadgeDefinitions(),
    db.$queryRaw<{ track: string; slug: string; completed: number; attempted: number }[]>`
      SELECT t."slug" AS "track", l."slug",
        COUNT(*) FILTER (WHERE lp."status" = 'COMPLETED')::int AS "completed",
        COUNT(lp."userId")::int AS "attempted"
      FROM "Lesson" l
      JOIN "Track" t ON t."id" = l."trackId"
      LEFT JOIN "LessonProgress" lp ON lp."lessonId" = l."id"
      GROUP BY t."slug", l."slug"`,
    db.$queryRaw<{ slug: string; awarded: number }[]>`
      SELECT b."slug", COUNT(ub."userId")::int AS "awarded"
      FROM "Badge" b LEFT JOIN "UserBadge" ub ON ub."badgeId" = b."id"
      GROUP BY b."slug"`,
  ]);
  const lessonStats = new Map(lessonRows.map((r) => [`${r.track}/${r.slug}`, r]));
  const badgeStats = new Map(badgeRows.map((r) => [r.slug, r.awarded]));
  return {
    tracks: tracks.map((t) => ({
      ...t,
      lessons: t.lessons.map((l) => {
        const s = lessonStats.get(`${t.slug}/${l.slug}`);
        return { ...l, completed: s?.completed ?? 0, attempted: s?.attempted ?? 0, seeded: Boolean(s) };
      }),
    })),
    badges: badges.map((b) => ({ ...b, awarded: badgeStats.get(b.slug) ?? 0, seeded: badgeStats.has(b.slug) })),
  };
}

// --- Audit log ----------------------------------------------------------------

export const auditFilterSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
});

export async function listAudit(page: number) {
  await requireAdmin();
  const [total, rows] = await Promise.all([
    db.auditLog.count(),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50 }),
  ]);
  return { total, pages: Math.max(1, Math.ceil(total / 50)), rows };
}
