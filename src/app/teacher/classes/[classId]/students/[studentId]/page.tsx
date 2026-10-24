import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getClassStudentDetail, getManagedClassroom } from "@/lib/classes";
import { timeAgo } from "@/lib/format";
import { levelForXp } from "@/lib/gamification/levels";
import { activeStreak } from "@/lib/gamification/streaks";
import type { TestResult } from "@/lib/grading/grade";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Student" };

const STATUS = {
  COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  IN_PROGRESS: { label: "In progress", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  NOT_STARTED: { label: "Not started", className: "bg-border/60 text-muted" },
} as const;

export default async function StudentPage({ params }: PageProps<"/teacher/classes/[classId]/students/[studentId]">) {
  const user = await requireRole("TEACHER", "ADMIN");
  const { classId, studentId } = await params;
  const classroom = await getManagedClassroom(user, classId);
  if (!classroom) notFound();
  const detail = await getClassStudentDetail(classroom.id, studentId);
  if (!detail) notFound();

  const s = detail.user;
  const now = new Date();
  const completed = detail.lessons.flatMap((t) => t.lessons).filter((l) => l.status === "COMPLETED").length;
  const total = detail.lessons.flatMap((t) => t.lessons).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="text-sm text-muted">
        <Link href="/teacher" className="hover:text-foreground">
          Teacher
        </Link>{" "}
        /{" "}
        <Link href={`/teacher/classes/${classroom.id}`} className="hover:text-foreground">
          {classroom.name}
        </Link>{" "}
        / <span className="text-foreground">{s.name ?? s.email}</span>
      </nav>

      <h1 className="mt-3 text-3xl font-bold">{s.name ?? s.email}</h1>
      <p className="mt-1 text-sm text-muted">
        {s.email} · joined the class {timeAgo(detail.joinedAt, now)}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Lessons completed" value={`${completed} / ${total}`} />
        <Stat label="XP / level" value={`${s.xp} XP · L${levelForXp(s.xp)}`} />
        <Stat label="Streak (longest)" value={`${activeStreak(s, now, s.timezone)} (${s.longestStreak})`} />
        <Stat label="Last solved" value={timeAgo(s.lastActiveDate, now)} />
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Progress by lesson</h2>
        <div className="mt-4 space-y-6">
          {detail.lessons.map(({ track, lessons }) => (
            <div key={track.slug}>
              <h3 className="font-semibold">{track.title}</h3>
              <ul className="card mt-2 divide-y divide-border p-0">
                {lessons.map((l) => (
                  <li key={l.meta.slug} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span>
                      {l.meta.order}. {l.meta.title}
                    </span>
                    <span className="flex items-center gap-3 text-muted">
                      {l.attempts > 0 && (
                        <span>
                          {l.attempts} attempt{l.attempts === 1 ? "" : "s"} · best {l.bestScore}%
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[l.status].className}`}>
                        {STATUS[l.status].label}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Submissions</h2>
        <p className="text-sm text-muted">The latest {detail.submissions.length || ""} submissions. Open one to see the code and test results.</p>
        {detail.submissions.length === 0 ? (
          <p className="mt-3 text-muted">No submissions yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {detail.submissions.map((sub) => {
              const results = (sub.resultsJson ?? []) as TestResult[];
              return (
                <li key={sub.id}>
                  <details className="card group p-0">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                      <span>
                        <span aria-hidden className={sub.passed ? "text-emerald-600" : "text-rose-600"}>
                          {sub.passed ? "✓" : "✗"}
                        </span>{" "}
                        <span className="sr-only">{sub.passed ? "Passed" : "Failed"}: </span>
                        <span className="font-medium">
                          {sub.lesson.track.title}: {sub.lesson.title}
                        </span>
                      </span>
                      <span className="text-muted">
                        {sub.score}%{sub.hintsUsed > 0 && ` · ${sub.hintsUsed} hint${sub.hintsUsed === 1 ? "" : "s"}`} ·{" "}
                        {timeAgo(sub.createdAt, now)} <span className="group-open:hidden">▸</span>
                        <span className="hidden group-open:inline">▾</span>
                      </span>
                    </summary>
                    <div className="space-y-3 border-t border-border px-4 py-3">
                      <pre className="max-h-80 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-xs leading-5 text-slate-100">
                        {sub.code}
                      </pre>
                      <ul className="space-y-1 text-sm">
                        {results.map((r) => (
                          <li key={r.id}>
                            <span className={r.passed ? "text-emerald-600" : "text-rose-600"}>{r.passed ? "✓" : "✗"}</span> {r.name}
                            {!r.passed && r.message && <span className="block pl-5 text-xs whitespace-pre-wrap text-muted">{r.message}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
