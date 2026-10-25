import type { Metadata } from "next";
import Link from "next/link";
import { auditFilterSchema, listAudit, requireAdmin } from "@/lib/admin";
import { describeAudit } from "../audit-format";

export const metadata: Metadata = { title: "Audit log" };

const when = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin();
  const parsed = auditFilterSchema.safeParse({ page: (await searchParams).page });
  const page = parsed.success ? parsed.data.page : 1;
  const { rows, total, pages } = await listAudit(page);

  return (
    <div>
      <p className="text-sm text-muted">
        Every change made by admins (and teachers managing their classes): who did what, to whom, and when. {total} entr
        {total === 1 ? "y" : "ies"} in total. Emails are partly hidden.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-muted">Nothing has been recorded yet.</p>
      ) : (
        <div className="card mt-4 overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-border/40 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">When</th>
                <th className="px-4 py-2 font-semibold">Who</th>
                <th className="px-4 py-2 font-semibold">What</th>
                <th className="px-4 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{when.format(a.createdAt)}</td>
                  <td className="px-4 py-2.5 font-medium">{a.actorLabel}</td>
                  <td className="px-4 py-2.5">{describeAudit(a)}</td>
                  <td className="px-4 py-2.5">
                    <code className="text-xs text-muted">{a.action}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pages">
          {page > 1 ? (
            <Link href={`/admin/audit?page=${page - 1}`} className="btn-secondary">
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={`/admin/audit?page=${page + 1}`} className="btn-secondary">
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
