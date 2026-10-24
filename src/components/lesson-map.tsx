import Link from "next/link";
import type { ProgressStatus } from "@/generated/prisma/enums";
import type { LessonMeta } from "@/lib/content/loader";

/**
 * Skill-tree style map: lessons zig-zag down three columns, joined by a
 * curved path. Rows have a fixed height so the SVG path can line up with the
 * node centres at any width.
 */

const ROW_HEIGHT = 168; // px, keep in sync with h-[168px] below
const NODE_CENTER_Y = 36; // half of the 72px node
const COLUMNS = [1, 2, 1, 0]; // centre, right, centre, left, ...

export type MapLesson = LessonMeta & { status: ProgressStatus };

export function LessonMap({ trackSlug, lessons }: { trackSlug: string; lessons: MapLesson[] }) {
  const nextIndex = lessons.findIndex((l) => l.status !== "COMPLETED");
  const points = lessons.map((_, i) => ({
    x: COLUMNS[i % COLUMNS.length]! * 100 + 50, // viewBox is 300 wide: 3 columns of 100
    y: i * ROW_HEIGHT + NODE_CENTER_Y,
  }));
  const height = lessons.length * ROW_HEIGHT;

  return (
    <div className="relative mx-auto max-w-2xl">
      <svg
        className="pointer-events-none absolute inset-x-0 top-0 w-full"
        style={{ height }}
        viewBox={`0 0 300 ${height}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {points.slice(1).map((p, i) => {
          const a = points[i]!;
          const midY = (a.y + p.y) / 2;
          const done = lessons[i]!.status === "COMPLETED";
          return (
            <path
              key={i}
              d={`M ${a.x} ${a.y} C ${a.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`}
              fill="none"
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={done ? undefined : "2 12"}
              vectorEffect="non-scaling-stroke"
              className={done ? "stroke-emerald-500" : "stroke-slate-300 dark:stroke-slate-700"}
            />
          );
        })}
      </svg>

      <ol className="relative">
        {lessons.map((l, i) => {
          const col = COLUMNS[i % COLUMNS.length]!;
          return (
            <li key={l.slug} className="grid h-[168px] grid-cols-3">
              <div style={{ gridColumnStart: col + 1 }} className="flex flex-col items-center text-center">
                <MapNode
                  href={`/tracks/${trackSlug}/${l.slug}`}
                  lesson={l}
                  index={i}
                  isNext={i === nextIndex}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MapNode({ href, lesson, index, isNext }: { href: string; lesson: MapLesson; index: number; isNext: boolean }) {
  const done = lesson.status === "COMPLETED";
  const started = lesson.status === "IN_PROGRESS";

  const ring = done
    ? "bg-emerald-500 text-white ring-emerald-200 dark:ring-emerald-900"
    : isNext
      ? "bg-indigo-600 text-white ring-indigo-200 dark:ring-indigo-900 animate-[pulse_2.5s_ease-in-out_infinite]"
      : started
        ? "bg-amber-400 text-amber-950 ring-amber-200 dark:ring-amber-900"
        : "bg-surface text-muted ring-border border-2 border-border";

  const status = done ? "Completed" : started ? "In progress" : isNext ? "Up next" : "Not started";

  return (
    <Link href={href} className="group flex w-full max-w-44 flex-col items-center gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-indigo-500">
      <span
        className={`grid size-[72px] place-items-center rounded-full text-xl font-bold ring-8 transition group-hover:scale-105 ${ring}`}
      >
        {done ? "✓" : index + 1}
        <span className="sr-only">{status}</span>
      </span>
      {/* Background so the connecting path passes behind the label. */}
      <span className="flex flex-col items-center gap-1 rounded-lg bg-background px-2 py-1">
        <span className="line-clamp-2 text-sm font-semibold leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
          {lesson.title}
        </span>
        <span className="text-xs text-muted">
          {lesson.xp} XP · {lesson.difficulty}
        </span>
      </span>
    </Link>
  );
}
