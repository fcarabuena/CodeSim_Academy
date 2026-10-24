import "server-only";
import { z } from "zod";
import { getExpectedResult, getLessonTests, getTrack, type LessonMeta } from "@/lib/content/loader";
import type { FunctionTests, PageTests, QueryTests } from "@/lib/content/schema";
import { db } from "@/lib/db";
import { gradeFunction, gradePage, gradeQuery, type GradeResult } from "@/lib/grading/grade";
import { observationsSchema, type Observations } from "@/lib/runners/types";

export const MAX_CODE_LENGTH = 50_000;

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);

export const submissionSchema = z.object({
  trackSlug: slug,
  lessonSlug: slug,
  code: z.string().max(MAX_CODE_LENGTH, "Your code is too long."),
  observations: observationsSchema,
});
export type SubmissionInput = z.infer<typeof submissionSchema>;

export type SubmissionResponse = GradeResult & {
  /** True the first time this student completes the lesson (XP arrives in Phase 5). */
  firstCompletion: boolean;
};

export class SubmissionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Grade observations against the lesson's tests. Never trusts a client "passed". */
export async function gradeObservations(meta: LessonMeta, obs: Observations): Promise<GradeResult> {
  if (obs.type !== meta.type) throw new SubmissionError("These results don't match this lesson.", 400);
  const tests = await getLessonTests(meta);
  switch (obs.type) {
    case "page":
      return gradePage(tests as PageTests, obs);
    case "function":
      return gradeFunction(tests as FunctionTests, obs);
    case "query":
      return gradeQuery(tests as QueryTests, await getExpectedResult(meta), obs);
  }
}

export async function submit(userId: string, input: SubmissionInput): Promise<SubmissionResponse> {
  const track = await getTrack(input.trackSlug);
  const meta = track?.lessons.find((l) => l.slug === input.lessonSlug);
  if (!meta) throw new SubmissionError("Lesson not found.", 404);

  const grade = await gradeObservations(meta, input.observations);

  const lesson = await db.lesson.findFirst({
    where: { slug: meta.slug, track: { slug: meta.trackSlug } },
    select: { id: true },
  });
  if (!lesson) {
    throw new SubmissionError("This lesson isn't set up in the database yet. Ask your teacher to run the seed script.", 503);
  }

  const firstCompletion = await db.$transaction(async (tx) => {
    await tx.submission.create({
      data: {
        userId,
        lessonId: lesson.id,
        code: input.code,
        passed: grade.passed,
        score: grade.score,
        resultsJson: grade.results,
      },
    });

    const existing = await tx.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId: lesson.id } },
    });
    const alreadyCompleted = existing?.status === "COMPLETED";
    const now = new Date();

    await tx.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: lesson.id } },
      create: {
        userId,
        lessonId: lesson.id,
        status: grade.passed ? "COMPLETED" : "IN_PROGRESS",
        bestScore: grade.score,
        completedAt: grade.passed ? now : null,
      },
      update: {
        status: alreadyCompleted || grade.passed ? "COMPLETED" : "IN_PROGRESS",
        bestScore: Math.max(existing?.bestScore ?? 0, grade.score),
        completedAt: existing?.completedAt ?? (grade.passed ? now : null),
      },
    });

    return grade.passed && !alreadyCompleted;
  });

  return { ...grade, firstCompletion };
}
