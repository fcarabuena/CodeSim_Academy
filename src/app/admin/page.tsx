import Link from "next/link";
import { getOverview, listAudit, requireAdmin } from "@/lib/admin";
import { timeAgo } from "@/lib/format";
import { describeAudit } from "./audit-format";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const [stats, audit] = await Promise.all([getOverview(), listAudit(1)]);

  const cards = [
    { label: "Users", value: stats.users, sub: `${stats.newWeek} new this week`, href: "/admin/users" },
    { label: "Students", value: stats.students, href: "/admin/users?role=STUDENT" },
    { label: "Teachers", value: stats.teachers, sub: `${stats.admins} admin${stats.admins === 1 ? "" : "s"}`, href: "/admin/users?role=TEACHER" },
    { label: "Active this week", value: stats.activeWeek, sub: "submitted code in the last 7 days" },
    { label: "Classes", value: stats.classes, href: "/admin/classes" },
    { label: "Submissions", value: stats.submissions },
    { label: "Lessons completed", value: stats.completed, href: "/admin/content" },
    { label: "Disabled accounts", value: stats.disabled, href: "/admin/users?role=DISABLED" },
  ];

  return (
    <div className="space-y-8">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const body = (
            <>
              <p className="text-sm text-muted">{c.label}</p>
              <p className="mt-1 text-3xl font-extrabold">{c.value.toLocaleString("en")}</p>
              {c.sub && <p className="mt-1 text-xs text-muted">{c.sub}</p>}
            </>
          );
          return (
            <li key={c.label}>
              {c.href ? (
                <Link href={c.href} className="card block p-5 hover:border-indigo-400">
                  {body}
                </Link>
              ) : (
                <div className="card p-5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">Recent admin activity</h2>
          <Link href="/admin/audit" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Full audit log →
          </Link>
        </div>
        {audit.rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No admin actions yet.</p>
        ) : (
          <ul className="card mt-3 divide-y divide-border p-0">
            {audit.rows.slice(0, 6).map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5 text-sm">
                <span>
                  <b>{a.actorLabel}</b> {describeAudit(a)}
                </span>
                <span className="text-muted">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
