"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { userLabel, writeAudit } from "@/lib/admin";
import { classNameSchema, createClassroom, getManagedClassroom, regenerateClassCode } from "@/lib/classes";
import { db } from "@/lib/db";
import { adminLimiter } from "@/lib/rate-limit";
import { requireRole } from "@/lib/session";

export type CreateClassState = { error?: string };

export async function createClassAction(_prev: CreateClassState, formData: FormData): Promise<CreateClassState> {
  const teacher = await requireRole("TEACHER", "ADMIN");
  const parsed = z.object({ name: classNameSchema }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const classroom = await createClassroom(teacher, parsed.data.name);
  redirect(`/teacher/classes/${classroom.id}`);
}

export type ClassActionResult = { ok: boolean; message: string };

const classActionSchema = z.object({ classId: z.string().min(1).max(64), studentId: z.string().min(1).max(64).optional() });

async function guardClassAction(formData: FormData) {
  const user = await requireRole("TEACHER", "ADMIN");
  if (!adminLimiter(`teacher:${user.id}`).ok) return { error: "Too many actions in a row. Please wait a minute." } as const;
  const parsed = classActionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." } as const;
  // Ownership check: teachers only manage their own classes (admins: any).
  const classroom = await getManagedClassroom(user, parsed.data.classId);
  if (!classroom) return { error: "Class not found." } as const;
  return { user, classroom, input: parsed.data } as const;
}

export async function removeStudentAction(_prev: ClassActionResult | null, formData: FormData): Promise<ClassActionResult> {
  const g = await guardClassAction(formData);
  if ("error" in g) return { ok: false, message: g.error! };
  const { user, classroom, input } = g;
  if (!input.studentId) return { ok: false, message: "Invalid request." };
  const membership = await db.classMembership.findUnique({
    where: { classroomId_userId: { classroomId: classroom.id, userId: input.studentId } },
    select: { user: { select: { name: true, email: true } } },
  });
  if (!membership) return { ok: false, message: "That student isn't in this class." };
  await db.$transaction(async (tx) => {
    await tx.classMembership.delete({ where: { classroomId_userId: { classroomId: classroom.id, userId: input.studentId! } } });
    await writeAudit(tx, user, {
      action: "class.student_removed",
      targetType: "class",
      targetId: classroom.id,
      targetLabel: classroom.name,
      details: { student: userLabel(membership.user) },
    });
  });
  revalidatePath(`/teacher/classes/${classroom.id}`);
  return { ok: true, message: `Removed ${membership.user.name ?? "the student"} from the class. Their account and progress are kept.` };
}

export async function regenerateCodeAction(_prev: ClassActionResult | null, formData: FormData): Promise<ClassActionResult> {
  const g = await guardClassAction(formData);
  if ("error" in g) return { ok: false, message: g.error! };
  const { user, classroom } = g;
  const code = await regenerateClassCode(classroom.id);
  await db.$transaction((tx) =>
    writeAudit(tx, user, {
      action: "class.code_regenerated",
      targetType: "class",
      targetId: classroom.id,
      targetLabel: classroom.name,
    }),
  );
  revalidatePath(`/teacher/classes/${classroom.id}`);
  return { ok: true, message: `New join code: ${code}. The old code no longer works.` };
}
