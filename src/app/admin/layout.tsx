import type { Metadata } from "next";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · CodeSim Academy" } };

// Only the shared chrome lives here. Each admin page checks the role itself
// (requireAdmin), because layouts don't re-run when moving between pages.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex items-center gap-3">
        <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          Admin
        </span>
        <h1 className="text-2xl font-bold">Site administration</h1>
      </div>
      <AdminNav />
      <div className="pt-6">{children}</div>
    </div>
  );
}
