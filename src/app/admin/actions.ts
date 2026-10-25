"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { lockAdmins, requireAdmin, userLabel, writeAudit } from "@/lib/admin";
import { canChangeRole, canDeleteUser, canOwnClass, canSetDisabled, type Role, type RuleResult } from "@/lib/admin-rules";
import { db } from "@/lib/db";
import { adminLimiter } from "@/lib/rate-limit";

/**
 * Admin actions. Each one: checks the caller is an admin (in the database),
 * rate-limits, validates its input with Zod, then in one transaction locks the
 * admin rows, applies the safety rules, makes the change and writes the audit
 * log. Results come back as { ok, message } for the toast.
 */

export type ActionResult = { ok: boolean; message: string };

const id = z.string().min(1).max(64);
const fail = (message: string): ActionResult => ({ ok: false, message });

class RuleError extends Error {}
const enforce = (r: RuleResult) => {
  if (!r.ok) throw new RuleError(r.reason);
};

async function guard<T extends z.ZodType>(schema: T, formData: FormData) {
  const admin = await requireAdmin();
  if (!adminLimiter(`admin:${admin.id}`).ok) return { error: fail("Too many actions in a row. Please wait a minute.") } as const;
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: fail(parsed.error.issues[0]?.message ?? "Invalid request.") } as const;
  return { admin, input: parsed.data as z.infer<T> } as const;
}

async function run(work: () => Promise<string>): Promise<ActionResult> {
  try {
    const message = await work();
    revalidatePath("/admin", "layout");
    return { ok: true, message };
  } catch (err) {
    if (err instanceof RuleError) return fail(err.message);
    console.error("Admin action failed", err);
    return fail("Something went wrong. Please try again.");
  }
}

const userSelect = { id: true, name: true, email: true, role: true, disabledAt: true } as const;

export async function changeRoleAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard(z.object({ userId: id, role: z.enum(["STUDENT", "TEACHER", "ADMIN"]) }), formData);
  if ("error" in g) return g.error!;
  const { admin, input } = g;
  return run(() =>
    db.$transaction(async (tx) => {
      const activeAdmins = await lockAdmins(tx);
      const target = await tx.user.findUnique({ where: { id: input.userId }, select: userSelect });
      if (!target) throw new RuleError("That user no longer exists.");
      enforce(canChangeRole(admin.id, target, input.role as Role, activeAdmins));
      await tx.user.update({ where: { id: target.id }, data: { role: input.role } });
      await writeAudit(tx, admin, {
        action: "user.role_changed",
        targetType: "user",
        targetId: target.id,
        targetLabel: userLabel(target),
        details: { from: target.role, to: input.role },
      });
      return `${userLabel(target)} is now ${input.role.toLowerCase()}. They'll see the change after logging in again.`;
    }),
  );
}

export async function setDisabledAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard(z.object({ userId: id, disable: z.enum(["true", "false"]) }), formData);
  if ("error" in g) return g.error!;
  const { admin, input } = g;
  const disable = input.disable === "true";
  return run(() =>
    db.$transaction(async (tx) => {
      const activeAdmins = await lockAdmins(tx);
      const target = await tx.user.findUnique({ where: { id: input.userId }, select: userSelect });
      if (!target) throw new RuleError("That user no longer exists.");
      enforce(canSetDisabled(admin.id, target, disable, activeAdmins));
      await tx.user.update({ where: { id: target.id }, data: { disabledAt: disable ? new Date() : null } });
      await writeAudit(tx, admin, {
        action: disable ? "user.disabled" : "user.enabled",
        targetType: "user",
        targetId: target.id,
        targetLabel: userLabel(target),
      });
      return disable ? `${userLabel(target)} can no longer log in.` : `${userLabel(target)} can log in again.`;
    }),
  );
}

export async function deleteUserAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard(z.object({ userId: id }), formData);
  if ("error" in g) return g.error!;
  const { admin, input } = g;
  return run(() =>
    db.$transaction(async (tx) => {
      const activeAdmins = await lockAdmins(tx);
      const target = await tx.user.findUnique({
        where: { id: input.userId },
        select: { ...userSelect, xp: true, _count: { select: { classesTaught: true, submissions: true } } },
      });
      if (!target) throw new RuleError("That user no longer exists.");
      enforce(canDeleteUser(admin.id, target, activeAdmins));
      // Submissions, progress, badges, memberships and their classes go too (cascade).
      await tx.user.delete({ where: { id: target.id } });
      await writeAudit(tx, admin, {
        action: "user.deleted",
        targetType: "user",
        targetId: target.id,
        targetLabel: userLabel(target),
        details: { role: target.role, xp: target.xp, submissions: target._count.submissions, classesDeleted: target._count.classesTaught },
      });
      return `Deleted ${userLabel(target)} and their data.`;
    }),
  );
}

export async function reassignClassAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard(z.object({ classId: id, teacherId: id }), formData);
  if ("error" in g) return g.error!;
  const { admin, input } = g;
  return run(() =>
    db.$transaction(async (tx) => {
      const classroom = await tx.classroom.findUnique({
        where: { id: input.classId },
        select: { id: true, name: true, teacher: { select: { id: true, name: true, email: true } } },
      });
      if (!classroom) throw new RuleError("That class no longer exists.");
      if (classroom.teacher.id === input.teacherId) throw new RuleError("That teacher already owns this class.");
      const next = await tx.user.findUnique({ where: { id: input.teacherId }, select: userSelect });
      if (!next) throw new RuleError("That teacher no longer exists.");
      enforce(canOwnClass(next));
      await tx.classroom.update({ where: { id: classroom.id }, data: { teacherId: next.id } });
      await writeAudit(tx, admin, {
        action: "class.reassigned",
        targetType: "class",
        targetId: classroom.id,
        targetLabel: classroom.name,
        details: { from: userLabel(classroom.teacher), to: userLabel(next) },
      });
      return `"${classroom.name}" now belongs to ${userLabel(next)}.`;
    }),
  );
}

export async function deleteClassAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const g = await guard(z.object({ classId: id }), formData);
  if ("error" in g) return g.error!;
  const { admin, input } = g;
  return run(() =>
    db.$transaction(async (tx) => {
      const classroom = await tx.classroom.findUnique({
        where: { id: input.classId },
        select: { id: true, name: true, code: true, teacher: { select: { name: true, email: true } }, _count: { select: { members: true } } },
      });
      if (!classroom) throw new RuleError("That class no longer exists.");
      // Memberships go with the class; students' own accounts and progress stay.
      await tx.classroom.delete({ where: { id: classroom.id } });
      await writeAudit(tx, admin, {
        action: "class.deleted",
        targetType: "class",
        targetId: classroom.id,
        targetLabel: classroom.name,
        details: { code: classroom.code, teacher: userLabel(classroom.teacher), students: classroom._count.members },
      });
      return `Deleted the class "${classroom.name}". Its students keep their accounts and progress.`;
    }),
  );
}
