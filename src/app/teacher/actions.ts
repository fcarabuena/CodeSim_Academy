"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { classNameSchema, createClassroom } from "@/lib/classes";
import { requireRole } from "@/lib/session";

export type CreateClassState = { error?: string };

export async function createClassAction(_prev: CreateClassState, formData: FormData): Promise<CreateClassState> {
  const teacher = await requireRole("TEACHER", "ADMIN");
  const parsed = z.object({ name: classNameSchema }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const classroom = await createClassroom(teacher, parsed.data.name);
  redirect(`/teacher/classes/${classroom.id}`);
}
