import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { listUsers, requireAdmin, userFilterSchema, type UserFilter } from "@/lib/admin";
import { timeAgo } from "@/lib/format";
import { changeRoleAction, deleteUserAction, setDisabledAction } from "../actions";

export const metadata: Metadata = { title: "Users" };

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

const ROLE_STYLE = {
  STUDENT: "bg-border/60 text-muted",
  TEACHER: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  ADMIN: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
} as const;

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const me = await requireAdmin();
  const raw = await searchParams;
  const parsed = userFilterSchema.safeParse({ q: raw.q, role: raw.role, page: raw.page });
  const filter: UserFilter = parsed.success ? parsed.data : { q: "", role: "", page: 1 };
  const { rows, total, pages } = await listUsers(filter);
  const now = new Date();

  const pageHref = (page: number) => {
    const p = new URLSearchParams();
    if (filter.q) p.set("q", filter.q);
    if (filter.role) p.set("role", filter.role);
    p.set("page", String(page));
    return `/admin/users?${p}`;
  };

  return (
    <div>
      <form className="flex flex-wrap items-end gap-2" role="search">
        <label className="min-w-56 flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">Search name or email</span>
          <input name="q" defaultValue={filter.q} className="input" placeholder="e.g. Maya or @school.org" />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-muted">Role</span>
          <select name="role" defaultValue={filter.role} className="input">
            <option value="">All</option>
            <option value="STUDENT">Students</option>
            <option value="TEACHER">Teachers</option>
            <option value="ADMIN">Admins</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </label>
        <button type="submit" className="btn-primary">
          Search
        </button>
        {(filter.q || filter.role) && (
          <Link href="/admin/users" className="btn-secondary">
            Clear
          </Link>
        )}
      </form>

      <p className="mt-4 text-sm text-muted">
        {total} user{total === 1 ? "" : "s"}
        {filter.q && ` matching "${filter.q}"`}. Emails are partly hidden; search still matches the full address.
      </p>

      <div className="card mt-3 overflow-x-auto p-0">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-border/40 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2 font-semibold">User</th>
              <th className="px-4 py-2 font-semibold">Role</th>
              <th className="px-4 py-2 text-right font-semibold">XP</th>
              <th className="px-4 py-2 font-semibold">Joined</th>
              <th className="px-4 py-2 font-semibold">Last active</th>
              <th className="px-4 py-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const isMe = u.id === me.id;
              const label = u.name ?? u.maskedEmail;
              return (
                <tr key={u.id} className={`border-t border-border align-top ${u.disabled ? "bg-rose-50/40 dark:bg-rose-950/20" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {u.name ?? "(no name)"} {isMe && <span className="text-xs text-indigo-600 dark:text-indigo-400">(you)</span>}
                    </p>
                    <p className="text-xs text-muted">{u.maskedEmail}</p>
                    {u.disabled && <p className="mt-1 text-xs font-semibold text-rose-700 dark:text-rose-300">Disabled</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_STYLE[u.role]}`}>{u.role.toLowerCase()}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{u.xp}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{dateFormat.format(u.createdAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">{timeAgo(u.lastActive, now)}</td>
                  <td className="px-4 py-3">
                    {isMe ? (
                      <span className="text-xs text-muted">You can&apos;t change your own account here.</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <ActionForm action={changeRoleAction} fields={{ userId: u.id }} label="Change role">
                          <select name="role" defaultValue={u.role} aria-label={`New role for ${label}`} className="input py-1 text-xs">
                            <option value="STUDENT">Student</option>
                            <option value="TEACHER">Teacher</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </ActionForm>
                        <ActionForm
                          action={setDisabledAction}
                          fields={{ userId: u.id, disable: u.disabled ? "false" : "true" }}
                          label={u.disabled ? "Enable" : "Disable"}
                          confirm={
                            u.disabled
                              ? undefined
                              : {
                                  title: `Disable ${label}?`,
                                  body: "They'll be signed out and can't log in or submit code until you enable the account again. Their progress is kept.",
                                  confirmLabel: "Disable account",
                                }
                          }
                        />
                        <ActionForm
                          action={deleteUserAction}
                          fields={{ userId: u.id }}
                          label="Delete"
                          variant="danger"
                          confirm={{
                            title: `Delete ${label}?`,
                            body: `This permanently deletes the account with all its submissions, progress and badges.${
                              u.classesTaught > 0
                                ? ` Their ${u.classesTaught} class${u.classesTaught === 1 ? "" : "es"} will be deleted too: reassign them first on the Classes page if you want to keep them.`
                                : ""
                            } This can't be undone.`,
                            confirmLabel: "Delete permanently",
                          }}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pages">
          {filter.page > 1 ? (
            <Link href={pageHref(filter.page - 1)} className="btn-secondary">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {filter.page} of {pages}
          </span>
          {filter.page < pages ? (
            <Link href={pageHref(filter.page + 1)} className="btn-secondary">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
