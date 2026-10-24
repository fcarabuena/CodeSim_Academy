"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { classCodeSchema, joinClassroom } from "@/lib/classes";
import { classJoinLimiter } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";

export type JoinClassState = { error?: string; success?: string };

export async function joinClassAction(_prev: JoinClassState, formData: FormData): Promise<JoinClassState> {
  const user = await requireUser();
  if (!classJoinLimiter(user.id).ok) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const parsed = z.object({ code: classCodeSchema }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const result = await joinClassroom(user.id, parsed.data.code);
  if (!result.ok) return { error: result.error };

  revalidatePath("/profile");
  return {
    success: result.alreadyMember
      ? `You're already in "${result.className}".`
      : `You joined "${result.className}". Your teacher can now see your progress.`,
  };
}
