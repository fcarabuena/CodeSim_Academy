import Link from "next/link";
import { listTracks } from "@/lib/content/loader";

const CHALLENGE_LABEL = { page: "Build the page", function: "Write the function", query: "Query the data" } as const;


const features = [
  {
    title: "Learn by doing",
    body: "Every lesson ends in a real challenge. Write code in a pro editor and see results instantly.",
    icon: "⌨️",
  },
  {
    title: "Instant auto-grading",
    body: "Hidden tests check your work and explain exactly what passed, what failed and why.",
    icon: "✅",
  },
  {
    title: "Runs in your browser",
    body: "HTML, JavaScript, Python and SQL all run safely on your own device. Nothing to install.",
    icon: "🌐",
  },
  {
    title: "XP, streaks & badges",
    body: "Level up, keep a daily streak and climb the weekly leaderboard with your classmates.",
    icon: "🏆",
  },
];

const steps = [
  { n: 1, title: "Pick a track", body: "Start with web basics, JavaScript, Python or SQL." },
  { n: 2, title: "Read a short lesson", body: "Bite-sized explanations with examples you can copy." },
  { n: 3, title: "Solve the challenge", body: "Run your code as often as you like, then submit." },
  { n: 4, title: "Earn XP", body: "Pass the tests to earn XP, level up and unlock badges." },
];

export default async function LandingPage() {
  const tracks = await listTracks();

  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.18),transparent_60%)]"
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-2">
          <div>
            <p className="mb-4 inline-block rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
              Free · Beginner friendly · No setup
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              Learn to code by <span className="text-indigo-600 dark:text-indigo-400">actually coding</span>.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              CodeSim Academy turns programming lessons into interactive challenges. Write real code,
              get it graded in seconds, and earn XP and badges as you go.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn-primary px-6 py-3 text-base">
                Start learning free
              </Link>
              <Link href="/login" className="btn-secondary px-6 py-3 text-base">
                I already have an account
              </Link>
            </div>
          </div>
          <CodePreview />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold">Why students like it</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="card">
              <div className="text-2xl" aria-hidden>
                {f.icon}
              </div>
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-bold">Tracks</h2>
          <Link href="/tracks" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Browse all lessons →
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {tracks.map((t) => (
            <Link key={t.slug} href={`/tracks/${t.slug}`} className="card p-5 transition hover:border-indigo-400">
              <span className={`block h-1.5 w-10 rounded-full ${t.color}`} aria-hidden />
              <h3 className="mt-3 font-semibold">{t.title}</h3>
              <p className="mt-1 text-sm text-muted">{t.description}</p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                {CHALLENGE_LABEL[t.lessons[0]?.type ?? "page"]}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.n} className="flex gap-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-600 font-bold text-white">
                {s.n}
              </span>
              <div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="card flex flex-col items-start gap-4 bg-indigo-600 text-white sm:flex-row sm:items-center sm:justify-between dark:bg-indigo-700">
          <div>
            <h2 className="text-2xl font-bold">Ready for your first challenge?</h2>
            <p className="text-indigo-100">It takes less than a minute to sign up.</p>
          </div>
          <Link href="/signup" className="btn bg-white px-6 py-3 text-base text-indigo-700 hover:bg-indigo-50">
            Create free account
          </Link>
        </div>
      </section>
    </>
  );
}

function CodePreview() {
  return (
    <div className="card overflow-hidden p-0 font-mono text-sm shadow-xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted">
        <span className="size-3 rounded-full bg-red-400" />
        <span className="size-3 rounded-full bg-yellow-400" />
        <span className="size-3 rounded-full bg-green-400" />
        <span className="ml-2">python · functions.py</span>
      </div>
      <pre className="overflow-x-auto px-4 py-4 leading-6">
        <code>
          <span className="text-violet-600 dark:text-violet-400">def</span>{" "}
          <span className="text-sky-600 dark:text-sky-400">greet</span>(name):{"\n"}
          {"    "}
          <span className="text-violet-600 dark:text-violet-400">return</span>{" "}
          <span className="text-emerald-600 dark:text-emerald-400">f&quot;Hello, {"{name}"}!&quot;</span>
        </code>
      </pre>
      <div className="space-y-1 border-t border-border px-4 py-3 text-xs">
        <p className="text-emerald-600 dark:text-emerald-400">✓ greet(&quot;Ada&quot;) returns &quot;Hello, Ada!&quot;</p>
        <p className="text-emerald-600 dark:text-emerald-400">✓ greet(&quot;Linus&quot;) returns &quot;Hello, Linus!&quot;</p>
        <p className="pt-1 font-sans font-semibold text-indigo-600 dark:text-indigo-400">+20 XP · Badge unlocked: First Steps</p>
      </div>
    </div>
  );
}
