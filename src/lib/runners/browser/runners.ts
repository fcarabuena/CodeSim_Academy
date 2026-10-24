import { injectProbe, type ProbeResults } from "../page-probe";
import { LOOP_LIMIT_MS, RUN_TIMEOUT_MS, timeoutMessage, type Observations, type RunResult, type RunSpec, type Runner } from "../types";
import { SandboxWorker, TimeoutError } from "./sandbox-worker";

/**
 * Browser runners: all student code runs on the student's own device, so the
 * (free, 512 MB) server never executes code. One sandbox per language is kept
 * alive between runs so Python doesn't have to reload every time.
 */

type FunctionReply = {
  stdout: string;
  error?: string;
  returns: Extract<Observations, { type: "function" }>["returns"];
};
type QueryReply = { columns: string[]; rows: (string | number | null)[][]; truncated?: boolean; error?: string };

const sandboxes = {
  javascript: new SandboxWorker("/runners/js.worker.js"),
  python: new SandboxWorker("/runners/python.worker.js"),
  sql: new SandboxWorker("/runners/sql.worker.js"),
};

/** Start downloading a runtime before the student presses Run. */
export function warmUp(language: keyof typeof sandboxes) {
  sandboxes[language].warmUp().catch(() => {
    // Reported properly on the first Run.
  });
}

const LOADING_MESSAGE = {
  javascript: "Starting JavaScript…",
  python: "Loading Python… (the first time takes a few seconds)",
  sql: "Loading the SQL engine…",
} as const;

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; durationMs: number }> {
  const t = performance.now();
  const value = await fn();
  return { value, durationMs: Math.round(performance.now() - t) };
}

function functionRunner(language: "javascript" | "python"): Runner {
  return {
    async run(code, spec, options) {
      if (spec.type !== "function") throw new Error("Wrong runner for this lesson");
      const sandbox = sandboxes[language];
      if (!sandbox.isLoaded) options?.onLoading?.(LOADING_MESSAGE[language]);
      const started = performance.now();
      try {
        const { value: r, durationMs } = await timed(() =>
          sandbox.call<FunctionReply>({ code, functionName: spec.functionName, calls: spec.calls }, RUN_TIMEOUT_MS),
        );
        return {
          status: r.error ? "error" : "ok",
          output: r.stdout,
          error: r.error,
          observations: { type: "function", stdout: r.stdout, error: r.error, returns: r.returns },
          durationMs,
        };
      } catch (err) {
        const timedOut = err instanceof TimeoutError;
        const error = timedOut ? timeoutMessage() : (err as Error).message;
        return {
          status: timedOut ? "timeout" : "error",
          output: "",
          error,
          observations: { type: "function", stdout: "", error, timedOut, returns: {} },
          durationMs: Math.round(performance.now() - started),
        };
      }
    },
  };
}

const sqlRunner: Runner = {
  async run(code, spec, options) {
    if (spec.type !== "query") throw new Error("Wrong runner for this lesson");
    if (!sandboxes.sql.isLoaded) options?.onLoading?.(LOADING_MESSAGE.sql);
    const started = performance.now();
    try {
      const { value: r, durationMs } = await timed(() =>
        sandboxes.sql.call<QueryReply>({ code, datasetSql: spec.datasetSql }, RUN_TIMEOUT_MS),
      );
      return {
        status: r.error ? "error" : "ok",
        output: "",
        error: r.error,
        table: r.error ? undefined : { columns: r.columns, rows: r.rows, truncated: r.truncated },
        observations: { type: "query", columns: r.columns, rows: r.rows, error: r.error },
        durationMs,
      };
    } catch (err) {
      const timedOut = err instanceof TimeoutError;
      const error = timedOut ? timeoutMessage() : (err as Error).message;
      return {
        status: timedOut ? "timeout" : "error",
        output: "",
        error,
        observations: { type: "query", columns: [], rows: [], error, timedOut },
        durationMs: Math.round(performance.now() - started),
      };
    }
  },
};

/**
 * "Build the page" runner: renders the student's HTML in the visible preview
 * iframe (sandbox="allow-scripts", no allow-same-origin) and asks the
 * injected probe script for DOM facts.
 *
 * Browsers usually run that iframe on the same thread as our page, so loops in
 * the page's own <script>s are protected by loop-guard.ts (loaded on demand)
 * rather than by the time limit alone.
 */
export function createPageRunner(getFrame: () => HTMLIFrameElement | null): Runner {
  return {
    async run(code, spec) {
      if (spec.type !== "page") throw new Error("Wrong runner for this lesson");
      const frame = getFrame();
      const started = performance.now();
      const fail = (error: string, timedOut = false): RunResult => ({
        status: timedOut ? "timeout" : "error",
        output: "",
        error,
        observations: { type: "page", probes: {}, error: timedOut ? undefined : error, timedOut },
        durationMs: Math.round(performance.now() - started),
      });
      if (!frame) return fail("The preview isn't ready yet. Please try again.");

      const nonce = crypto.randomUUID();
      let loopStopped = false;
      try {
        const { guardHtml } = await import("../loop-guard");
        const html = injectProbe(guardHtml(code));
        const probes = await new Promise<ProbeResults>((resolve, reject) => {
          const timer = setTimeout(() => {
            cleanup();
            frame.srcdoc = "<p style='font-family:sans-serif;padding:1rem'>Stopped: the page took too long.</p>";
            reject(new TimeoutError());
          }, RUN_TIMEOUT_MS);
          const onMessage = (e: MessageEvent) => {
            if (e.source !== frame.contentWindow) return;
            const d = e.data as { type?: string; nonce?: string; probes?: ProbeResults };
            if (d?.type === "codesim:loop") loopStopped = true;
            if (d?.type === "codesim:observations" && d.nonce === nonce) {
              cleanup();
              resolve(d.probes ?? {});
            }
          };
          const onLoad = () => {
            frame.contentWindow?.postMessage({ type: "codesim:probe", nonce, probes: spec.probes }, "*");
          };
          const cleanup = () => {
            clearTimeout(timer);
            window.removeEventListener("message", onMessage);
            frame.removeEventListener("load", onLoad);
          };
          window.addEventListener("message", onMessage);
          frame.addEventListener("load", onLoad, { once: true });
          frame.srcdoc = html;
        });
        return {
          status: "ok",
          output: "",
          warning: loopStopped
            ? `A loop in your page's JavaScript ran for more than ${LOOP_LIMIT_MS / 1000} second, so we stopped it. Is it an infinite loop?`
            : undefined,
          observations: { type: "page", probes },
          durationMs: Math.round(performance.now() - started),
        };
      } catch (err) {
        return err instanceof TimeoutError ? fail(timeoutMessage(), true) : fail((err as Error).message);
      }
    },
  };
}

export function getRunner(spec: RunSpec, getFrame: () => HTMLIFrameElement | null): Runner {
  switch (spec.type) {
    case "page":
      return createPageRunner(getFrame);
    case "function":
      return functionRunner(spec.language);
    case "query":
      return sqlRunner;
  }
}
