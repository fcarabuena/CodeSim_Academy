import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { listAllClasses, requireAdmin } from "@/lib/admin";
import { timeAgo } from "@/lib/format";
import { deleteClassAction, reassignClassAction } from "../actions";

export const metadata: Metadata = { title: "Classes" };

export default async function AdminClassesPage() {
  await requireAdmin();
  const { classes, staff } = await listAllClasses();

  return (
    <div>
      <p className="text-sm text-muted">
        Every class on the site. Move a class to another teacher (for example when a teacher leaves), or delete it.
        Deleting a class only removes the class: its students keep their accounts and progress.
      </p>

      {classes.length === 0 ? (
        <p className="mt-6 text-muted">No classes yet.</p>
      ) : (
        <div className="card mt-4 overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-border/40 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">Class</th>
                <th className="px-4 py-2 font-semibold">Teacher</th>
                <th className="px-4 py-2 text-right font-semibold">Students</th>
                <th className="px-4 py-2 font-semibold">Code</th>
                <th className="px-4 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted">created {timeAgo(c.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3">{c.teacherLabel}</td>
                  <td className="px-4 py-3 text-right">{c._count.members}</td>
                  <td className="px-4 py-3 font-mono tracking-widest">{c.code}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <ActionForm action={reassignClassAction} fields={{ classId: c.id }} label="Reassign">
                        <select name="teacherId" defaultValue={c.teacher.id} aria-label={`New teacher for ${c.name}`} className="input max-w-56 py-1 text-xs">
                          {staff.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </ActionForm>
                      <ActionForm
                        action={deleteClassAction}
                        fields={{ classId: c.id }}
                        label="Delete"
                        variant="danger"
                        confirm={{
                          title: `Delete "${c.name}"?`,
                          body: `The class and its join code (${c.code}) will be removed for its ${c._count.members} student${
                            c._count.members === 1 ? "" : "s"
                          }. Their accounts and progress are kept. This can't be undone.`,
                          confirmLabel: "Delete class",
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
