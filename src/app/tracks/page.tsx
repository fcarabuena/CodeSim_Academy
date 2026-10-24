import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { listTracks } from "@/lib/content/loader";
import { getProgressMap, lessonKey } from "@/lib/progress";

export const metadata: Metadata = { title: "Tracks" };

export default async function TracksPage() {
  const [tracks, session] = await Promise.all([listTracks(), auth()]);
  const progress = session?.user?.id ? await getProgressMap(session.user.id) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Tracks</h1>
      <p className="mt-2 text-muted">Pick a track and work through its lessons in order.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tracks.map((t) => {
          const done = progress
            ? t.lessons.filter((l) => progress.get(lessonKey(t.slug, l.slug)) === "COMPLETED").length
            : 0;
          const xp = t.lessons.reduce((sum, l) => sum + l.xp, 0);
          return (
            <Link
              key={t.slug}
              href={`/tracks/${t.slug}`}
              className="card group flex flex-col transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md"
            >
              <span className={`block h-1.5 w-12 rounded-full ${t.color}`} aria-hidden />
              <h2 className="mt-4 text-lg font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                {t.title}
              </h2>
              <p className="mt-1 flex-1 text-sm text-muted">{t.description}</p>
              <p className="mt-4 text-xs font-medium text-muted">
                {t.lessons.length} lesson{t.lessons.length === 1 ? "" : "s"} · {xp} XP
              </p>
              {progress && (
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${(done / t.lessons.length) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {done} of {t.lessons.length} completed
                  </p>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
