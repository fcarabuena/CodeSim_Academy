import type { Metadata } from "next";
import { getContentStats, requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Content" };

export default async function AdminContentPage() {
  await requireAdmin();
  const { tracks, badges } = await getContentStats();
  const unseeded = tracks.flatMap((t) => t.lessons).filter((l) => !l.seeded).length + badges.filter((b) => !b.seeded).length;

  return (
    <div className="space-y-10">
      <p className="text-sm text-muted">
        Lessons and badges live in the <code>content/</code> folder of the code and are read-only here. To change them,
        edit the files, push, then run <code>npm run db:seed</code>.
      </p>
      {unseeded > 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {unseeded} item(s) exist in the content files but not in the database yet. Run <code>npm run db:seed</code>.
        </p>
      )}

      {tracks.map((t) => (
        <section key={t.slug}>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <span className={`h-2 w-6 rounded-full ${t.color}`} aria-hidden /> {t.title}
          </h2>
          <div className="card mt-3 overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-border/40 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">Lesson</th>
                  <th className="px-4 py-2 font-semibold">Type</th>
                  <th className="px-4 py-2 text-right font-semibold">XP</th>
                  <th className="px-4 py-2 text-right font-semibold">Started</th>
                  <th className="px-4 py-2 text-right font-semibold">Completed</th>
                </tr>
              </thead>
              <tbody>
                {t.lessons.map((l) => (
                  <tr key={l.slug} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      {l.order}. {l.title}
                      {!l.seeded && <span className="ml-2 text-xs text-amber-700">(not seeded)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {l.language} · {l.difficulty}
                    </td>
                    <td className="px-4 py-2.5 text-right">{l.xp}</td>
                    <td className="px-4 py-2.5 text-right">{l.attempted}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{l.completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section>
        <h2 className="text-lg font-bold">Badges</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((b) => (
            <li key={b.slug} className="card flex items-center gap-3 p-4">
              <span className="text-2xl" aria-hidden>
                {b.icon}
              </span>
              <div className="flex-1">
                <p className="font-semibold">{b.title}</p>
                <p className="text-xs text-muted">{b.description}</p>
              </div>
              <span className="text-right text-sm">
                <b>{b.awarded}</b>
                <span className="block text-xs text-muted">awarded</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
