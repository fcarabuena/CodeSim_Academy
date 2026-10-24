import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import {
  EXTENSIONS,
  lessonFrontmatterSchema,
  testsSchemaByType,
  trackSchema,
  TYPES_BY_LANGUAGE,
  type LessonFrontmatter,
  type LessonTests,
  type TrackFile,
} from "./schema";

/**
 * Reads lessons from /content. Used by pages (server only, it touches the
 * file system), the seed script and the content tests.
 *
 * Layout:
 *   content/<track>/track.json
 *   content/<track>/<lesson>/lesson.md      frontmatter + lesson text
 *   content/<track>/<lesson>/starter.<ext>  code the editor starts with
 *   content/<track>/<lesson>/solution.<ext> reference answer, never sent to browsers
 *   content/<track>/<lesson>/tests.json     grading tests
 *   content/datasets/<name>.sql             SQLite datasets for SQL lessons
 */

export const CONTENT_DIR = path.join(process.cwd(), "content");
const NON_TRACK_DIRS = new Set(["datasets"]);

export type LessonMeta = LessonFrontmatter & { slug: string; trackSlug: string };

export type Track = TrackFile & { slug: string; lessons: LessonMeta[] };

export type Lesson = LessonMeta & {
  /** Markdown body of lesson.md. */
  body: string;
  starter: string;
};

export class ContentError extends Error {
  constructor(file: string, detail: string) {
    super(`${path.relative(process.cwd(), file)}: ${detail}`);
  }
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (err) {
    throw new ContentError(file, (err as Error).message);
  }
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, file: string): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new ContentError(file, z.prettifyError(r.error));
  return r.data;
}

async function subdirs(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

async function loadLessonMeta(trackSlug: string, slug: string): Promise<LessonMeta & { body: string }> {
  const file = path.join(CONTENT_DIR, trackSlug, slug, "lesson.md");
  const { data, content } = matter(await fs.readFile(file, "utf8"));
  const fm = parseOrThrow(lessonFrontmatterSchema, data, file);
  if (!TYPES_BY_LANGUAGE[fm.language].includes(fm.type)) {
    throw new ContentError(file, `type "${fm.type}" is not supported for language "${fm.language}"`);
  }
  return { ...fm, slug, trackSlug, body: content.trim() };
}

async function loadAll(): Promise<Track[]> {
  const tracks: Track[] = [];
  for (const trackSlug of await subdirs(CONTENT_DIR)) {
    if (NON_TRACK_DIRS.has(trackSlug)) continue;
    const trackFile = path.join(CONTENT_DIR, trackSlug, "track.json");
    const track = parseOrThrow(trackSchema, await readJson(trackFile), trackFile);

    const lessons: LessonMeta[] = [];
    for (const slug of await subdirs(path.join(CONTENT_DIR, trackSlug))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { body, ...meta } = await loadLessonMeta(trackSlug, slug);
      lessons.push(meta);
    }
    lessons.sort((a, b) => a.order - b.order);
    tracks.push({ ...track, slug: trackSlug, lessons });
  }
  return tracks.sort((a, b) => a.order - b.order);
}

// Content only changes on deploy, so cache it in production. In development
// re-read on every request so edits show up immediately.
let cache: Promise<Track[]> | undefined;

export function listTracks(): Promise<Track[]> {
  if (process.env.NODE_ENV !== "production") return loadAll();
  cache ??= loadAll().catch((err) => {
    cache = undefined;
    throw err;
  });
  return cache;
}

export async function getTrack(trackSlug: string): Promise<Track | undefined> {
  return (await listTracks()).find((t) => t.slug === trackSlug);
}

/** Lesson text and starter code, safe to send to the browser. */
export async function getLesson(trackSlug: string, slug: string): Promise<Lesson | undefined> {
  const track = await getTrack(trackSlug);
  const meta = track?.lessons.find((l) => l.slug === slug);
  if (!meta) return undefined;
  const { body } = await loadLessonMeta(trackSlug, slug);
  const starter = await fs.readFile(lessonFile(meta, "starter"), "utf8");
  return { ...meta, body, starter };
}

function lessonFile(meta: LessonMeta, name: "starter" | "solution"): string {
  return path.join(CONTENT_DIR, meta.trackSlug, meta.slug, `${name}.${EXTENSIONS[meta.language]}`);
}

/** Grading tests. Server-side only. */
export async function getLessonTests(meta: LessonMeta): Promise<LessonTests> {
  const file = path.join(CONTENT_DIR, meta.trackSlug, meta.slug, "tests.json");
  const schema: z.ZodType<LessonTests> = testsSchemaByType[meta.type];
  return parseOrThrow(schema, await readJson(file), file);
}

/** Reference solution. Server-side only: never send it to the browser. */
export function getLessonSolution(meta: LessonMeta): Promise<string> {
  return fs.readFile(lessonFile(meta, "solution"), "utf8");
}

/** SQL used to build a lesson's SQLite database. */
export function getDataset(name: string): Promise<string> {
  return fs.readFile(path.join(CONTENT_DIR, "datasets", `${name}.sql`), "utf8");
}

/** Previous and next lesson in the same track, for navigation. */
export function neighbours(track: Track, slug: string) {
  const i = track.lessons.findIndex((l) => l.slug === slug);
  return { prev: track.lessons[i - 1], next: track.lessons[i + 1] };
}
