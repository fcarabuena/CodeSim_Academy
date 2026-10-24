import type { Metadata } from "next";
import Link from "next/link";
import { CreateClassForm } from "@/components/class-forms";
import { getTeacherClassrooms } from "@/lib/classes";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Teacher" };

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

export default async function TeacherPage() {
  const user = await requireRole("TEACHER", "ADMIN");
  const classrooms = await getTeacherClassrooms(user);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Teacher dashboard</h1>
      <p className="mt-2 text-muted">
        Create a class, share its code with your students, and follow their progress.
        {user.role === "ADMIN" && " As an admin you can see every class."}
      </p>

      <div className="card mt-6">
        <CreateClassForm />
      </div>

      <h2 className="mt-10 text-xl font-bold">Your classes</h2>
      {classrooms.length === 0 ? (
        <p className="mt-3 text-muted">No classes yet. Create one above to get a join code.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {classrooms.map((c) => (
            <li key={c.id}>
              <Link href={`/teacher/classes/${c.id}`} className="card group block p-5 hover:border-indigo-400">
                <p className="font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{c.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {c._count.members} student{c._count.members === 1 ? "" : "s"} · created {dateFormat.format(c.createdAt)}
                  {user.role === "ADMIN" && ` · ${c.teacher.name ?? c.teacher.email}`}
                </p>
                <p className="mt-3 text-sm">
                  Join code: <span className="rounded bg-border/60 px-2 py-0.5 font-mono font-semibold tracking-widest">{c.code}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
