import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import {
  CONTENT_DIR,
  getLesson,
  getLessonSolution,
  getLessonTests,
  listTracks,
  type LessonMeta,
} from "./loader";
import type { FunctionTests, QueryTests } from "./schema";

// Validates every file under /content, so a broken lesson fails CI instead of
// a student's page. Solutions are checked against their tests where Node can
// run them; HTML, Python and SQL solutions are checked once their browser
// runners exist.

const tracks = await listTracks();
const lessons: LessonMeta[] = tracks.flatMap((t) => t.lessons);

describe("content", () => {
  it("has tracks with lessons", () => {
    expect(tracks.length).toBeGreaterThanOrEqual(5);
    for (const t of tracks) expect(t.lessons.length, t.slug).toBeGreaterThan(0);
  });

  it("uses unique track orders and unique lesson orders per track", () => {
    expect(new Set(tracks.map((t) => t.order)).size).toBe(tracks.length);
    for (const t of tracks) {
      expect(new Set(t.lessons.map((l) => l.order)).size, t.slug).toBe(t.lessons.length);
    }
  });

  describe.each(lessons.map((l) => [`${l.trackSlug}/${l.slug}`, l] as const))("%s", (_name, meta) => {
    it("loads lesson text, starter code, tests and solution", async () => {
      const lesson = await getLesson(meta.trackSlug, meta.slug);
      expect(lesson?.body.length).toBeGreaterThan(50);
      expect(lesson?.starter.length).toBeGreaterThan(0);
      await expect(getLessonTests(meta)).resolves.toBeTruthy();
      await expect(getLessonSolution(meta)).resolves.toBeTruthy();
    });

    it("has unique test ids", async () => {
      const { tests } = await getLessonTests(meta);
      expect(new Set(tests.map((t) => t.id)).size).toBe(tests.length);
    });

    if (meta.type === "query") {
      it("points at an existing dataset", async () => {
        const { dataset } = (await getLessonTests(meta)) as QueryTests;
        expect(fs.existsSync(path.join(CONTENT_DIR, "datasets", `${dataset}.sql`))).toBe(true);
      });
    }

    if (meta.language === "javascript") {
      it("solution passes its own tests", async () => {
        const { functionName, tests } = (await getLessonTests(meta)) as FunctionTests;
        const output: string[] = [];
        const context = vm.createContext({
          console: { log: (...a: unknown[]) => output.push(a.map(String).join(" ")) },
        });
        vm.runInContext(`${await getLessonSolution(meta)}\n;globalThis.__fn = typeof ${functionName ?? "undefined"} === "function" ? ${functionName ?? "undefined"} : undefined;`, context);
        for (const t of tests) {
          if (t.kind === "stdout") expect(output.join("\n").trimEnd(), t.id).toBe(t.expected.trimEnd());
          else expect((context as { __fn: (...a: unknown[]) => unknown }).__fn(...t.args), t.id).toEqual(t.expected);
        }
      });
    }
  });
});
