import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Hints } from "@/components/hints";
import { Markdown } from "@/components/markdown";
import { Workspace } from "@/components/workspace";
import { auth } from "@/auth";
import { getLesson, getRunSpec, getTrack, neighbours } from "@/lib/content/loader";
import { getProgressMap, lessonKey } from "@/lib/progress";

export async function generateMetadata({ params }: PageProps<"/tracks/[track]/[lesson]">): Promise<Metadata> {
  const { track, lesson } = await params;
  return { title: (await getLesson(track, lesson))?.title ?? "Lesson" };
}

const DIFFICULTY_STYLE = {
  beginner: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  intermediate: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  advanced: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
} as const;

export default async function LessonPage({ params }: PageProps<"/tracks/[track]/[lesson]">) {
  const { track: trackSlug, lesson: lessonSlug } = await params;
  const [track, lesson, session] = await Promise.all([getTrack(trackSlug), getLesson(trackSlug, lessonSlug), auth()]);
  if (!track || !lesson) notFound();
  const { prev, next } = neighbours(track, lesson.slug);
  const userId = session?.user?.id;
  const [spec, progress] = await Promise.all([
    getRunSpec(lesson),
    userId ? getProgressMap(userId, track.slug) : null,
  ]);

  return (
    <div className="lg:grid lg:h-[calc(100dvh-4rem)] lg:grid-cols-2">
      <article className="border-border px-4 py-8 sm:px-8 lg:overflow-y-auto lg:border-r">
        <nav className="text-sm text-muted">
          <Link href="/tracks" className="hover:text-foreground">
            Tracks
          </Link>{" "}
          /{" "}
          <Link href={`/tracks/${track.slug}`} className="hover:text-foreground">
            {track.title}
          </Link>
        </nav>

        <h1 className="mt-3 text-3xl font-bold">{lesson.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
          <span className={`rounded-full px-2.5 py-1 capitalize ${DIFFICULTY_STYLE[lesson.difficulty]}`}>
            {lesson.difficulty}
          </span>
          <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
            {lesson.xp} XP
          </span>
          <span className="rounded-full bg-border/60 px-2.5 py-1">
            Lesson {track.lessons.findIndex((l) => l.slug === lesson.slug) + 1} of {track.lessons.length}
          </span>
        </div>

        <div className="mt-6">
          <Markdown>{lesson.body}</Markdown>
        </div>

        <Hints hints={lesson.hints} />

        <nav className="mt-10 flex justify-between gap-4 border-t border-border pt-6 text-sm">
          {prev ? (
            <Link href={`/tracks/${track.slug}/${prev.slug}`} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/tracks/${track.slug}/${next.slug}`} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              {next.title} →
            </Link>
          ) : (
            <Link href={`/tracks/${track.slug}`} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Back to {track.title} →
            </Link>
          )}
        </nav>
      </article>

      <div className="border-t border-border bg-surface lg:min-h-0 lg:border-t-0">
        <Workspace
          trackSlug={track.slug}
          lessonSlug={lesson.slug}
          language={lesson.language}
          type={lesson.type}
          starter={lesson.starter}
          spec={spec}
          loggedIn={Boolean(userId)}
          completed={progress?.get(lessonKey(track.slug, lesson.slug)) === "COMPLETED"}
          nextHref={next ? `/tracks/${track.slug}/${next.slug}` : undefined}
        />
      </div>
    </div>
  );
}
