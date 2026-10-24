import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { runSql } from "../../../scripts/sql-node";
import { gradeFunction, gradePage, gradeQuery } from "../grading/grade";
import { PROBE_SCRIPT } from "../runners/page-probe";
import type { Observations, Probe, ProbeObservation } from "../runners/types";
import {
  CONTENT_DIR,
  getDataset,
  getBadgeDefinitions,
  getExpectedResult,
  getLesson,
  getLessonSolution,
  getLessonTests,
  getRunSpec,
  listTracks,
  type LessonMeta,
} from "./loader";
import type { FunctionTests, PageTests, QueryTests } from "./schema";

// Validates every file under /content, so a broken lesson fails CI instead of
// a student's page. Wherever Node can run the code, the reference solution
// must pass every test and the starter code must not.
// (Python is checked by the end-to-end test, which runs real Pyodide.)

const tracks = await listTracks();
const lessons: LessonMeta[] = tracks.flatMap((t) => t.lessons);

/** Observe a page with the same probe script the preview iframe uses. */
function observePage(html: string, probes: Probe[]): Record<string, ProbeObservation> {
  const window = new Window();
  window.document.write(html);
  const scope = window as unknown as { __codesimObserve: (p: Probe[]) => Record<string, ProbeObservation> };
  new Function("window", "document", "getComputedStyle", "parent", PROBE_SCRIPT)(
    window,
    window.document,
    window.getComputedStyle.bind(window),
    window,
  );
  const result = scope.__codesimObserve(probes);
  void window.happyDOM.close();
  return result;
}

/** Run JavaScript like the browser runner does (console capture + function calls). */
function observeJs(code: string, functionName: string | undefined, calls: { id: string; args: unknown[] }[]): Observations {
  const lines: string[] = [];
  const log = (...a: unknown[]) => lines.push(a.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(" "));
  const context = vm.createContext({ console: { log, info: log, warn: log, error: log } });
  const lookup = functionName ? `;typeof ${functionName} === "function" ? ${functionName} : undefined` : "undefined";
  let fn: unknown;
  try {
    fn = vm.runInContext(`(function () {\n${code}\nreturn (${lookup});\n})()`, context, { timeout: 1000 });
  } catch (err) {
    return { type: "function", stdout: lines.join("\n"), error: String(err), returns: {} };
  }
  const returns: Record<string, { value?: unknown; undefined?: boolean; error?: string }> = {};
  for (const c of calls) {
    if (typeof fn !== "function") break;
    try {
      const v = fn(...c.args);
      returns[c.id] = v === undefined ? { undefined: true } : { value: JSON.parse(JSON.stringify(v)) };
    } catch (err) {
      returns[c.id] = { error: String(err) };
    }
  }
  return { type: "function", stdout: lines.join("\n"), returns };
}

async function gradeCode(meta: LessonMeta, code: string) {
  const tests = await getLessonTests(meta);
  const spec = await getRunSpec(meta);
  if (spec.type === "page") {
    return gradePage(tests as PageTests, { type: "page", probes: observePage(code, spec.probes) });
  }
  if (spec.type === "query") {
    const r = await runSql(spec.datasetSql, code).catch((err: Error) => ({ columns: [], rows: [], error: err.message }));
    return gradeQuery(tests as QueryTests, await getExpectedResult(meta), { type: "query", ...r });
  }
  const obs = observeJs(code, spec.functionName, spec.calls);
  return gradeFunction(tests as FunctionTests, obs as Extract<Observations, { type: "function" }>);
}

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

  it("has valid badges that only refer to existing tracks", async () => {
    const badges = await getBadgeDefinitions();
    expect(badges.length).toBeGreaterThanOrEqual(7);
    const trackSlugs = new Set(tracks.map((t) => t.slug));
    for (const b of badges) {
      if (b.criteria.type === "track_completed") expect(trackSlugs.has(b.criteria.track), b.slug).toBe(true);
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

    it("never puts expected values in the browser run spec", async () => {
      const spec = JSON.stringify(await getRunSpec(meta));
      expect(spec).not.toContain('"expected"');
      expect(spec).not.toContain('"matches"');
      expect(spec).not.toContain('"equals"');
    });

    if (meta.type === "query") {
      it("points at an existing dataset and has an up-to-date expected.json", async () => {
        const { dataset } = (await getLessonTests(meta)) as QueryTests;
        expect(fs.existsSync(path.join(CONTENT_DIR, "datasets", `${dataset}.sql`))).toBe(true);
        const fresh = await runSql(await getDataset(dataset), await getLessonSolution(meta));
        expect(await getExpectedResult(meta), "run `npm run content:expected`").toEqual(fresh);
      });
    }

    if (meta.language !== "python") {
      it("solution passes every test", async () => {
        const r = await gradeCode(meta, await getLessonSolution(meta));
        expect(r.results.filter((x) => !x.passed)).toEqual([]);
      });

      it("starter code does not pass", async () => {
        const lesson = await getLesson(meta.trackSlug, meta.slug);
        expect((await gradeCode(meta, lesson!.starter)).passed).toBe(false);
      });
    }
  });
});
