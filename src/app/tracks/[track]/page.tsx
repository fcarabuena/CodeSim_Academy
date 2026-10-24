import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { LessonMap } from "@/components/lesson-map";
import { getTrack } from "@/lib/content/loader";
import { getProgressMap, lessonKey } from "@/lib/progress";

export async function generateMetadata({ params }: PageProps<"/tracks/[track]">): Promise<Metadata> {
  const track = await getTrack((await params).track);
  return { title: track?.title ?? "Track" };
}

export default async function TrackPage({ params }: PageProps<"/tracks/[track]">) {
  const { track: trackSlug } = await params;
  const [track, session] = await Promise.all([getTrack(trackSlug), auth()]);
  if (!track) notFound();

  const progress = session?.user?.id ? await getProgressMap(session.user.id, track.slug) : null;
  const lessons = track.lessons.map((l) => ({
    ...l,
    status: progress?.get(lessonKey(track.slug, l.slug)) ?? ("NOT_STARTED" as const),
  }));
  const done = lessons.filter((l) => l.status === "COMPLETED").length;
  const next = lessons.find((l) => l.status !== "COMPLETED") ?? lessons[0]!;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="text-sm text-muted">
        <Link href="/tracks" className="hover:text-foreground">
          Tracks
        </Link>{" "}
        / <span className="text-foreground">{track.title}</span>
      </nav>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className={`block h-1.5 w-12 rounded-full ${track.color}`} aria-hidden />
          <h1 className="mt-3 text-3xl font-bold">{track.title}</h1>
          <p className="mt-2 max-w-2xl text-muted">{track.description}</p>
          {session?.user && (
            <p className="mt-2 text-sm font-medium">
              {done} of {lessons.length} lessons completed
            </p>
          )}
        </div>
        <Link href={`/tracks/${track.slug}/${next.slug}`} className="btn-primary self-start px-5 py-2.5 sm:self-auto">
          {done === 0 ? "Start track" : done === lessons.length ? "Review lessons" : "Continue"} →
        </Link>
      </div>

      {session?.user && progress === null && (
        <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          We couldn&apos;t load your progress right now. The lessons still work: try refreshing in a moment.
        </p>
      )}

      <div className="mt-10">
        <LessonMap trackSlug={track.slug} lessons={lessons} />
      </div>
    </div>
  );
}
