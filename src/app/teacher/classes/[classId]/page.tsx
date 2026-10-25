import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { CopyCodeButton } from "@/components/class-forms";
import { ProgressBar } from "@/components/stats-ui";
import { getClassStudents, getClassSubmissions, getManagedClassroom } from "@/lib/classes";
import { listTracks } from "@/lib/content/loader";
import { timeAgo } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { regenerateCodeAction, removeStudentAction } from "../../actions";

export const metadata: Metadata = { title: "Class" };

export default async function ClassPage({ params }: PageProps<"/teacher/classes/[classId]">) {
  const user = await requireRole("TEACHER", "ADMIN");
  const { classId } = await params;
  const classroom = await getManagedClassroom(user, classId);
  if (!classroom) notFound();

  const [students, submissions, tracks] = await Promise.all([
    getClassStudents(classroom.id),
    getClassSubmissions(classroom.id),
    listTracks(),
  ]);
  const totalLessons = tracks.reduce((n, t) => n + t.lessons.length, 0);
  const now = new Date();
  const activeThisWeek = students.filter((s) => s.lastActive && now.getTime() - s.lastActive.getTime() < 7 * 86_400_000).length;
  const avgCompleted = students.length ? students.reduce((n, s) => n + s.completed, 0) / students.length : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="text-sm text-muted">
        <Link href="/teacher" className="hover:text-foreground">
          Teacher
        </Link>{" "}
        / <span className="text-foreground">{classroom.name}</span>
      </nav>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-3xl font-bold">{classroom.name}</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">Join code</span>
          <span className="rounded-lg bg-indigo-50 px-3 py-1.5 font-mono text-lg font-bold tracking-widest text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
            {classroom.code}
          </span>
          <CopyCodeButton code={classroom.code} />
          <ActionForm
            action={regenerateCodeAction}
            fields={{ classId: classroom.id }}
            label="New code"
            confirm={{
              title: "Make a new join code?",
              body: `The current code (${classroom.code}) will stop working straight away. Students already in the class stay in it.`,
              confirmLabel: "Make new code",
            }}
          />
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">
        Students join from their dashboard with this code. Only you {user.role === "ADMIN" ? "(and admins) " : ""}can see this class.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Students" value={String(students.length)} />
        <Stat label="Active in the last 7 days" value={String(activeThisWeek)} />
        <Stat label="Average lessons completed" value={`${avgCompleted.toFixed(1)} / ${totalLessons}`} />
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Students</h2>
        {students.length === 0 ? (
          <p className="mt-3 text-muted">No students yet. Share the join code above.</p>
        ) : (
          <div className="card mt-4 overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-border/40 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">Student</th>
                  <th className="px-4 py-2 font-semibold">Lessons completed</th>
                  <th className="px-4 py-2 text-right font-semibold">XP</th>
                  <th className="px-4 py-2 text-right font-semibold">Level</th>
                  <th className="px-4 py-2 text-right font-semibold">Streak</th>
                  <th className="px-4 py-2 font-semibold">Last active</th>
                  <th className="px-4 py-2 font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link href={`/teacher/classes/${classroom.id}/students/${s.id}`} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                        {s.name ?? s.email}
                      </Link>
                      {s.name && <p className="text-xs text-muted">{s.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar completed={s.completed} total={totalLessons} className="w-24" />
                        <span>
                          {s.completed} / {totalLessons}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{s.xp}</td>
                    <td className="px-4 py-3 text-right">{s.level}</td>
                    <td className="px-4 py-3 text-right">{s.streak > 0 ? `🔥 ${s.streak}` : "0"}</td>
                    <td className="px-4 py-3 text-muted">{timeAgo(s.lastActive, now)}</td>
                    <td className="px-4 py-3">
                      <ActionForm
                        action={removeStudentAction}
                        fields={{ classId: classroom.id, studentId: s.id }}
                        label="Remove"
                        confirm={{
                          title: `Remove ${s.name ?? "this student"} from the class?`,
                          body: "They'll leave this class, but keep their account, progress and badges. They can rejoin with the join code.",
                          confirmLabel: "Remove from class",
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Recent submissions</h2>
        {submissions.length === 0 ? (
          <p className="mt-3 text-muted">No submissions yet.</p>
        ) : (
          <ul className="card mt-4 divide-y divide-border p-0">
            {submissions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span aria-hidden className={s.passed ? "text-emerald-600" : "text-rose-600"}>
                    {s.passed ? "✓" : "✗"}
                  </span>{" "}
                  <span className="sr-only">{s.passed ? "Passed" : "Failed"}: </span>
                  <Link href={`/teacher/classes/${classroom.id}/students/${s.user.id}`} className="font-medium hover:underline">
                    {s.user.name ?? s.user.email}
                  </Link>{" "}
                  <span className="text-muted">
                    · {s.lesson.track.title}: {s.lesson.title}
                  </span>
                </span>
                <span className="text-muted">
                  {s.score}% · {timeAgo(s.createdAt, now)}
                </span>
              </li>
            ))}
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
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
