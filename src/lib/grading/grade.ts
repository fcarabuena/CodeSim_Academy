import type { DomCheck, FunctionTests, PageTests, QueryResult, QueryTests } from "@/lib/content/schema";
import { timeoutMessage, type Observations, type ProbeObservation } from "@/lib/runners/types";
import { compareRows, deepEqual, normalizeOutput, sameColumns, show } from "./compare";

/**
 * Turns runner observations into per-test results. Runs on the server only,
 * so expected values never reach the browser. Pure and unit-tested.
 */

export type TestResult = {
  id: string;
  name: string;
  passed: boolean;
  /** What went wrong, in beginner-friendly words. Empty when passed. */
  message: string;
  hint?: string;
};

export type GradeResult = {
  passed: boolean;
  /** Percentage of tests passed, 0-100. */
  score: number;
  results: TestResult[];
};

function summarize(results: TestResult[]): GradeResult {
  const passedCount = results.filter((r) => r.passed).length;
  return {
    passed: results.length > 0 && passedCount === results.length,
    score: results.length ? Math.round((passedCount / results.length) * 100) : 0,
    results,
  };
}

function result(test: { id: string; name: string; hint?: string }, failure: string | null): TestResult {
  return {
    id: test.id,
    name: test.name,
    passed: failure === null,
    message: failure ?? "",
    ...(failure !== null && test.hint ? { hint: test.hint } : {}),
  };
}

// --- "Build the page" --------------------------------------------------------

function textMatches(value: string, m: { equals?: string; contains?: string; matches?: string }): boolean {
  if (m.equals !== undefined && value !== m.equals) return false;
  if (m.contains !== undefined && !value.toLowerCase().includes(m.contains.toLowerCase())) return false;
  if (m.matches !== undefined && !new RegExp(m.matches, "i").test(value)) return false;
  return true;
}

/** Returns null when the check passes, otherwise a friendly failure message. */
export function evaluateDomCheck(check: DomCheck, obs: ProbeObservation | undefined): string | null {
  const sel = `"${check.selector}"`;
  if (!obs) return "We couldn't inspect your page. Press Run and make sure the preview shows up.";
  if (obs.error) return `The page couldn't be checked: ${obs.error}`;

  switch (check.kind) {
    case "exists":
      return obs.count > 0 ? null : `Couldn't find any element matching ${sel}.`;

    case "count": {
      const { min, max } = check;
      const n = obs.count;
      const noun = n === 1 ? "element" : "elements";
      if (min !== undefined && n < min) {
        return `Found ${n} ${noun} matching ${sel}, but expected ${max === min ? "exactly" : "at least"} ${min}.`;
      }
      if (max !== undefined && n > max) {
        return `Found ${n} ${noun} matching ${sel}, but expected ${max === min ? "exactly" : "at most"} ${max}.`;
      }
      return null;
    }

    case "text": {
      if (obs.count === 0) return `Couldn't find any element matching ${sel}.`;
      const text = obs.text ?? "";
      if (textMatches(text, check.text)) return null;
      return text.trim() === ""
        ? `The element matching ${sel} is empty.`
        : `The text of ${sel} ("${show(text, 60).slice(1, -1)}") isn't what we expected.`;
    }

    case "attr": {
      if (obs.count === 0) return `Couldn't find any element matching ${sel}.`;
      if (obs.attr === null || obs.attr === undefined) return `The element matching ${sel} has no "${check.name}" attribute.`;
      if (check.value && !textMatches(obs.attr, check.value)) {
        return `The "${check.name}" attribute of ${sel} is "${obs.attr}", which isn't what we expected.`;
      }
      return null;
    }

    case "hasClass": {
      const lists = obs.classes ?? [];
      if (obs.count === 0 || lists.length === 0) return `Couldn't find any element matching ${sel}.`;
      const missing = lists.filter((c) => !c.includes(check.className)).length;
      return missing === 0
        ? null
        : `${missing} of ${lists.length} element(s) matching ${sel} don't have the class "${check.className}".`;
    }

    case "style": {
      if (obs.count === 0) return `Couldn't find any element matching ${sel}.`;
      const actual = (obs.style ?? "").replace(/\s+/g, "").toLowerCase();
      const expected = check.equals.replace(/\s+/g, "").toLowerCase();
      return actual === expected ? null : `${sel} has ${check.property}: ${obs.style ?? "(none)"}, which isn't what we expected.`;
    }
  }
}

export function gradePage(tests: PageTests, obs: Extract<Observations, { type: "page" }>): GradeResult {
  if (obs.timedOut || obs.error) {
    const message = obs.timedOut ? timeoutMessage() : `Your page couldn't be checked: ${obs.error}`;
    return summarize(tests.tests.map((t) => result(t, message)));
  }
  return summarize(tests.tests.map((t) => result(t, evaluateDomCheck(t.check, obs.probes[t.id]))));
}

// --- "Write the function" ----------------------------------------------------

function outputDiff(expected: string, actual: string): string {
  if (actual === "") return `Your program didn't print anything. Expected:\n${expected}`;
  return `Expected your program to print:\n${expected}\n\nbut it printed:\n${actual.length > 600 ? `${actual.slice(0, 600)}…` : actual}`;
}

export function gradeFunction(tests: FunctionTests, obs: Extract<Observations, { type: "function" }>): GradeResult {
  const stdout = normalizeOutput(obs.stdout);
  const fatal = obs.timedOut ? timeoutMessage() : obs.error ? `Your code stopped with an error:\n${obs.error}` : null;

  return summarize(
    tests.tests.map((t) => {
      if (fatal) return result(t, fatal);
      if (t.kind === "stdout") {
        const expected = normalizeOutput(t.expected);
        return result(t, stdout === expected ? null : outputDiff(expected, stdout));
      }
      const call = `${tests.functionName}(${t.args.map((a) => show(a, 40)).join(", ")})`;
      const r = obs.returns[t.id];
      if (!r) return result(t, `We couldn't call ${call}. Did you define a function called ${tests.functionName}?`);
      if (r.error) return result(t, `${call} raised an error:\n${r.error}`);
      if (r.undefined) return result(t, `${call} returned undefined. Did you forget to \`return\` the result?`);
      return result(t, deepEqual(r.value, t.expected) ? null : `${call} returned ${show(r.value)}, but expected ${show(t.expected)}.`);
    }),
  );
}

// --- "Query the data" --------------------------------------------------------

export function gradeQuery(
  tests: QueryTests,
  expected: QueryResult,
  obs: Extract<Observations, { type: "query" }>,
): GradeResult {
  const fatal = obs.timedOut
    ? timeoutMessage()
    : obs.error
      ? `Your query has an error:\n${obs.error}`
      : null;

  return summarize(
    tests.tests.map((t) => {
      if (fatal) return result(t, fatal);
      if (t.check === "columns") {
        return result(
          t,
          sameColumns(expected.columns, obs.columns)
            ? null
            : `Your query returned the columns (${obs.columns.join(", ") || "none"}), but expected (${expected.columns.join(", ")}).`,
        );
      }
      const cmp = compareRows(expected.rows, obs.rows, tests.ordered);
      if (cmp.equal) return result(t, null);
      switch (cmp.reason) {
        case "count":
          return result(t, `Your query returned ${cmp.actual} row${cmp.actual === 1 ? "" : "s"}, but expected ${cmp.expected}.`);
        case "width":
          return result(t, `Each row has ${cmp.actual} column(s), but expected ${cmp.expected}.`);
        case "order":
          return result(t, "You have the right rows, but in the wrong order. Check your ORDER BY.");
        case "values":
          return result(t, "You returned the right number of rows, but some of the values are different.");
      }
    }),
  );
}
