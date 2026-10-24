import { z } from "zod";
import type { DomCheck, Language } from "@/lib/content/schema";

/**
 * The contract between code runners and grading.
 *
 * Runners *execute* code and report what they observed (printed output,
 * return values, DOM facts, query rows). They never decide pass/fail: the
 * server grades observations against the lesson's tests, which never leave
 * the server. This keeps answers private and lets a server-side runner
 * (planned: self-hosted Judge0 or Piston for Java, PHP, Node, ...) plug in by
 * implementing the same `Runner` interface and producing `Observations`.
 */

// --- What the browser needs to run a lesson (contains no answers) ----------

/** A DOM probe: what to look at, without the expected value. */
export type Probe = {
  id: string;
  kind: DomCheck["kind"];
  selector: string;
  /** Attribute name for "attr" probes. */
  name?: string;
  /** CSS property for "style" probes. */
  property?: string;
};

export type RunSpec =
  | { type: "page"; probes: Probe[] }
  | {
      type: "function";
      language: Extract<Language, "javascript" | "python">;
      functionName?: string;
      /** Function calls to make after the program has run. */
      calls: { id: string; args: unknown[] }[];
    }
  | { type: "query"; datasetSql: string };

// --- What a runner reports back (validated again on the server) ------------

const MAX_TEXT = 20_000;
const MAX_ROWS = 1_000;
const sqlValue = z.union([z.string().max(MAX_TEXT), z.number(), z.null()]);
const json = z.unknown();

export const probeObservationSchema = z.object({
  /** Number of elements matching the selector. */
  count: z.number().int().min(0),
  /** textContent of the first match (trimmed), for "text" probes. */
  text: z.string().max(MAX_TEXT).nullable().optional(),
  /** Attribute value of the first match, for "attr" probes. */
  attr: z.string().max(MAX_TEXT).nullable().optional(),
  /** Class lists of the matches (first 50), for "hasClass" probes. */
  classes: z.array(z.array(z.string().max(200)).max(100)).max(50).optional(),
  /** Computed style of the first match, for "style" probes. */
  style: z.string().max(500).nullable().optional(),
  /** Set when the selector itself is invalid. */
  error: z.string().max(500).optional(),
});
export type ProbeObservation = z.infer<typeof probeObservationSchema>;

export const observationsSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("page"),
    probes: z.record(z.string(), probeObservationSchema),
    error: z.string().max(MAX_TEXT).optional(),
    timedOut: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("function"),
    stdout: z.string().max(MAX_TEXT),
    error: z.string().max(MAX_TEXT).optional(),
    timedOut: z.boolean().optional(),
    returns: z.record(
      z.string(),
      z.object({
        value: json.optional(),
        /** The function returned undefined (JavaScript) — usually a missing `return`. */
        undefined: z.boolean().optional(),
        error: z.string().max(MAX_TEXT).optional(),
      }),
    ),
  }),
  z.object({
    type: z.literal("query"),
    columns: z.array(z.string().max(200)).max(100),
    rows: z.array(z.array(sqlValue).max(100)).max(MAX_ROWS),
    error: z.string().max(MAX_TEXT).optional(),
    timedOut: z.boolean().optional(),
  }),
]);
export type Observations = z.infer<typeof observationsSchema>;

// --- The runner interface ---------------------------------------------------

export type RunStatus = "ok" | "error" | "timeout";

export type RunResult = {
  status: RunStatus;
  /** Everything the program printed. */
  output: string;
  /** Friendly error message when status is "error" or "timeout". */
  error?: string;
  /** Something the student should know even though the run finished. */
  warning?: string;
  /** Result table for SQL. */
  table?: { columns: string[]; rows: (string | number | null)[][]; truncated?: boolean };
  observations: Observations;
  durationMs: number;
};

export type RunOptions = {
  /** Called while a runtime downloads for the first time (Pyodide is ~10 MB). */
  onLoading?: (message: string) => void;
};

export interface Runner {
  run(code: string, spec: RunSpec, options?: RunOptions): Promise<RunResult>;
}

/** How long a loop inside a "Build the page" preview may block before it's stopped. */
export const LOOP_LIMIT_MS = 1_000;

/** Default execution time limit per run. Runtime downloads are not counted. */
export const RUN_TIMEOUT_MS = 5_000;

export const timeoutMessage = (ms = RUN_TIMEOUT_MS) =>
  `Your code took longer than ${ms / 1000} seconds, so we stopped it. Is there an infinite loop?`;
