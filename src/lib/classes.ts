import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { listTracks } from "@/lib/content/loader";
import { db } from "@/lib/db";
import { activeStreak } from "@/lib/gamification/streaks";
import { levelForXp } from "@/lib/gamification/levels";
import type { CurrentUser } from "@/lib/session";

/**
 * Classes: a teacher creates one and shares its join code; students join
 * with the code. Every teacher-facing read takes the current user and checks
 * they own the class (admins can see all classes), so a teacher can never
 * load another teacher's students by guessing an id.
 */

// No 0/O or 1/I/L, so codes are easy to read out loud and type.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function generateClassCode(): string {
  return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

export const classNameSchema = z.string().trim().min(1, "Give your class a name.").max(80, "That name is too long.");

/** Accepts "k7q-4mz", " K7Q4MZ " etc. */
export const classCodeSchema = z
  .string()
  .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ""))
  .pipe(z.string().length(CODE_LENGTH, "Class codes have 6 letters and numbers."));

export const isStaff = (user: CurrentUser) => user.role === "TEACHER" || user.role === "ADMIN";

export async function createClassroom(teacher: CurrentUser, name: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.classroom.create({
        data: { name, code: generateClassCode(), teacherId: teacher.id },
        select: { id: true, code: true },
      });
    } catch (err) {
      // Code already taken (about 1 in a billion): try another.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("Couldn't generate a unique class code.");
}

/** Give a class a fresh join code (the old one stops working). */
export async function regenerateClassCode(classroomId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { code } = await db.classroom.update({ where: { id: classroomId }, data: { code: generateClassCode() }, select: { code: true } });
      return code;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("Couldn't generate a unique class code.");
}

export type JoinResult = { ok: true; className: string; alreadyMember: boolean } | { ok: false; error: string };

export async function joinClassroom(userId: string, code: string): Promise<JoinResult> {
  const classroom = await db.classroom.findUnique({ where: { code }, select: { id: true, name: true, teacherId: true } });
  if (!classroom) return { ok: false, error: "We couldn't find a class with that code. Check it with your teacher." };
  if (classroom.teacherId === userId) return { ok: false, error: "That's your own class: you're its teacher." };

  const existing = await db.classMembership.findUnique({
    where: { classroomId_userId: { classroomId: classroom.id, userId } },
  });
  if (!existing) await db.classMembership.create({ data: { classroomId: classroom.id, userId } });
  return { ok: true, className: classroom.name, alreadyMember: Boolean(existing) };
}

/** Classes a student belongs to (for their profile). */
export function getStudentClassrooms(userId: string) {
  return db.classMembership.findMany({
    where: { userId },
    orderBy: { joinedAt: "desc" },
    select: { joinedAt: true, classroom: { select: { name: true, teacher: { select: { name: true } } } } },
  });
}

/** Classes this teacher can see, with member counts. Admins see every class. */
export function getTeacherClassrooms(user: CurrentUser) {
  return db.classroom.findMany({
    where: user.role === "ADMIN" ? {} : { teacherId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      code: true,
      createdAt: true,
      teacher: { select: { name: true, email: true } },
      _count: { select: { members: true } },
    },
  });
}

/** The class if this user may manage it, else null. */
export function getManagedClassroom(user: CurrentUser, classroomId: string) {
  return db.classroom.findFirst({
    where: { id: classroomId, ...(user.role === "ADMIN" ? {} : { teacherId: user.id }) },
    select: { id: true, name: true, code: true, createdAt: true, teacher: { select: { name: true } } },
  });
}

export type StudentRow = {
  id: string;
  name: string | null;
  email: string;
  xp: number;
  level: number;
  streak: number;
  completed: number;
  joinedAt: Date;
  lastActive: Date | null;
};

/** One row per student in the class, in a single query. */
export async function getClassStudents(classroomId: string, now = new Date()): Promise<StudentRow[]> {
  const rows = await db.$queryRaw<
    {
      id: string;
      name: string | null;
      email: string;
      xp: number;
      currentStreak: number;
      lastActiveDate: Date | null;
      timezone: string | null;
      joinedAt: Date;
      completed: number;
      lastSubmissionAt: Date | null;
    }[]
  >`
    SELECT u."id", u."name", u."email", u."xp", u."currentStreak", u."lastActiveDate", u."timezone", m."joinedAt",
      (SELECT COUNT(*)::int FROM "LessonProgress" lp WHERE lp."userId" = u."id" AND lp."status" = 'COMPLETED') AS "completed",
      (SELECT MAX(s."createdAt") FROM "Submission" s WHERE s."userId" = u."id") AS "lastSubmissionAt"
    FROM "ClassMembership" m
    JOIN "User" u ON u."id" = m."userId"
    WHERE m."classroomId" = ${classroomId}
    ORDER BY LOWER(COALESCE(u."name", u."email"))`;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    xp: r.xp,
    level: levelForXp(r.xp),
    streak: activeStreak(r, now, r.timezone),
    completed: r.completed,
    joinedAt: r.joinedAt,
    lastActive: r.lastSubmissionAt ?? r.lastActiveDate,
  }));
}

/** The latest submissions from anyone in the class. */
export function getClassSubmissions(classroomId: string, take = 25) {
  return db.submission.findMany({
    where: { user: { memberships: { some: { classroomId } } } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      passed: true,
      score: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
      lesson: { select: { title: true, slug: true, track: { select: { slug: true, title: true } } } },
    },
  });
}

/** A student's detail for their teacher, or null if they aren't in this class. */
export async function getClassStudentDetail(classroomId: string, studentId: string) {
  const membership = await db.classMembership.findUnique({
    where: { classroomId_userId: { classroomId, userId: studentId } },
    select: {
      joinedAt: true,
      user: {
        select: { id: true, name: true, email: true, xp: true, currentStreak: true, longestStreak: true, lastActiveDate: true, timezone: true },
      },
    },
  });
  if (!membership) return null;

  const [progress, attempts, submissions, tracks, lessonIds] = await Promise.all([
    db.lessonProgress.findMany({
      where: { userId: studentId },
      select: { status: true, bestScore: true, completedAt: true, lesson: { select: { slug: true, track: { select: { slug: true } } } } },
    }),
    db.submission.groupBy({ by: ["lessonId"], where: { userId: studentId }, _count: { _all: true } }),
    db.submission.findMany({
      where: { userId: studentId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        passed: true,
        score: true,
        code: true,
        hintsUsed: true,
        resultsJson: true,
        createdAt: true,
        lessonId: true,
        lesson: { select: { title: true, slug: true, track: { select: { slug: true, title: true } } } },
      },
    }),
    listTracks(),
    db.lesson.findMany({ select: { id: true, slug: true, track: { select: { slug: true } } } }),
  ]);

  const idByKey = new Map(lessonIds.map((l) => [`${l.track.slug}/${l.slug}`, l.id]));
  const attemptsById = new Map(attempts.map((a) => [a.lessonId, a._count._all]));
  const progressByKey = new Map(progress.map((p) => [`${p.lesson.track.slug}/${p.lesson.slug}`, p]));

  const lessons = tracks.map((t) => ({
    track: t,
    lessons: t.lessons.map((l) => {
      const key = `${t.slug}/${l.slug}`;
      const p = progressByKey.get(key);
      const id = idByKey.get(key);
      return {
        meta: l,
        status: p?.status ?? "NOT_STARTED",
        bestScore: p?.bestScore ?? 0,
        completedAt: p?.completedAt ?? null,
        attempts: id ? (attemptsById.get(id) ?? 0) : 0,
      };
    }),
  }));

  return { ...membership, lessons, submissions };
}
