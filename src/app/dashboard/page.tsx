import type { Metadata } from "next";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

// Phase 1 placeholder: XP, streaks, badges and "continue" arrive in later phases.
export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Hi, {user.name ?? "there"} 👋</h1>
      <p className="mt-2 text-muted">You&apos;re signed in. Tracks and challenges are coming next.</p>
    </div>
  );
}
