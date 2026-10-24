import { z } from "zod";
import { auth } from "@/auth";
import { submissionLimiter } from "@/lib/rate-limit";
import { submissionSchema, submit, SubmissionError } from "@/lib/submissions";

const MAX_BODY_BYTES = 300_000;

const error = (message: string, status: number, headers?: HeadersInit) =>
  Response.json({ error: message }, { status, headers });

/**
 * POST /api/submissions
 * Body: { trackSlug, lessonSlug, code, observations }
 *
 * The browser ran the code and sends what it observed; the server grades it
 * against tests that never leave the server, then saves the submission and
 * the student's progress.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return error("Please log in to submit your answer.", 401);

  const limit = submissionLimiter(userId);
  if (!limit.ok) {
    const seconds = Math.ceil(limit.retryAfterMs / 1000);
    return error(`You're submitting very quickly. Please wait ${seconds} seconds and try again.`, 429, {
      "Retry-After": String(seconds),
    });
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return error("Your submission is too large.", 413);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return error("Invalid request.", 400);
  }
  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message ?? "Invalid request.", 400);
  }

  try {
    return Response.json(await submit(userId, parsed.data));
  } catch (err) {
    if (err instanceof SubmissionError) return error(err.message, err.status);
    if (err instanceof z.ZodError) return error("Invalid request.", 400);
    console.error("Submission failed", err);
    return error("We couldn't save your submission. Please try again in a moment.", 500);
  }
}
