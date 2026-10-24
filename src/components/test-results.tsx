import Link from "next/link";
import type { GradeResult } from "@/lib/grading/grade";

export function TestResults({
  grade,
  firstCompletion,
  nextHref,
}: {
  grade: GradeResult;
  firstCompletion: boolean;
  nextHref?: string;
}) {
  const total = grade.results.length;
  const passedCount = grade.results.filter((r) => r.passed).length;
  const failMessage =
    passedCount === 0
      ? total === 1
        ? "Not quite yet. Read the message below and try again."
        : `None of the ${total} tests passed yet. Start with the first message below.`
      : `${passedCount} of ${total} tests passed. Keep going, you're close!`;

  return (
    <div className="space-y-3" aria-live="polite">
      {grade.passed ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100">
          <p className="font-semibold">
            🎉 {total === 1 ? "Test passed!" : `All ${total} tests passed!`}{" "}
            {firstCompletion ? "Lesson complete." : "You've already completed this lesson."}
          </p>
          {nextHref && (
            <Link href={nextHref} className="btn bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-500">
              Next lesson →
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
          <p className="font-semibold">{failMessage}</p>
        </div>
      )}

      <ul className="space-y-2">
        {grade.results.map((r) => (
          <li
            key={r.id}
            className={`rounded-lg border px-3 py-2 text-sm ${
              r.passed
                ? "border-emerald-200 dark:border-emerald-900"
                : "border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/30"
            }`}
          >
            <p className="flex items-start gap-2 font-medium">
              <span aria-hidden className={r.passed ? "text-emerald-600" : "text-rose-600"}>
                {r.passed ? "✓" : "✗"}
              </span>
              <span>
                <span className="sr-only">{r.passed ? "Passed: " : "Failed: "}</span>
                {r.name}
              </span>
            </p>
            {!r.passed && r.message && (
              <pre className="mt-1 ml-5 whitespace-pre-wrap font-sans text-muted">{r.message}</pre>
            )}
            {!r.passed && r.hint && <p className="mt-1 ml-5 text-amber-800 dark:text-amber-300">💡 {r.hint}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
