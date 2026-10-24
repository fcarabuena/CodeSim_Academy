/**
 * Comparison helpers used by grading. Pure functions, unit-tested.
 */

const EPSILON = 1e-9;

function numbersEqual(a: number, b: number): boolean {
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  return Math.abs(a - b) <= EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Structural equality for JSON-like values; numbers compare with a tiny tolerance. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return numbersEqual(a, b);
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  return (
    ka.length === kb.length &&
    ka.every((k) => Object.hasOwn(b as object, k) && deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  );
}

/** Normalise printed output: unify newlines, drop trailing spaces and trailing blank lines. */
export function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n+$/, "");
}

/** Short, readable rendering of a value for feedback messages. */
export function show(value: unknown, max = 120): string {
  let s: string;
  try {
    s = value === undefined ? "undefined" : JSON.stringify(value);
  } catch {
    s = String(value);
  }
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// --- SQL result comparison ---------------------------------------------------

export type SqlValue = string | number | null;
export type Row = SqlValue[];

function normalizeValue(v: SqlValue): string {
  if (v === null) return "null";
  if (typeof v === "number") {
    // 79 and 79.0 are the same; round away float noise like 0.1 + 0.2.
    return `n:${Number(v.toPrecision(12))}`;
  }
  return `s:${v}`;
}

const rowKey = (row: Row) => row.map(normalizeValue).join("\u0001");

export type RowComparison =
  | { equal: true }
  | { equal: false; reason: "count"; expected: number; actual: number }
  | { equal: false; reason: "width"; expected: number; actual: number }
  | { equal: false; reason: "values" }
  | { equal: false; reason: "order" };

/**
 * Compare result rows by position of columns (names are checked separately).
 * Order-insensitive unless `ordered`, in which case a "right rows, wrong
 * order" result is reported as such.
 */
export function compareRows(expected: Row[], actual: Row[], ordered: boolean): RowComparison {
  if (expected.length !== actual.length) {
    return { equal: false, reason: "count", expected: expected.length, actual: actual.length };
  }
  const width = expected[0]?.length ?? 0;
  const actualWidth = actual[0]?.length ?? 0;
  if (expected.length > 0 && width !== actualWidth) {
    return { equal: false, reason: "width", expected: width, actual: actualWidth };
  }

  const exp = expected.map(rowKey);
  const act = actual.map(rowKey);
  const sameMultiset = (() => {
    const counts = new Map<string, number>();
    for (const k of exp) counts.set(k, (counts.get(k) ?? 0) + 1);
    for (const k of act) {
      const n = counts.get(k);
      if (!n) return false;
      counts.set(k, n - 1);
    }
    return true;
  })();

  if (!sameMultiset) return { equal: false, reason: "values" };
  if (ordered && exp.some((k, i) => k !== act[i])) return { equal: false, reason: "order" };
  return { equal: true };
}

/** Column names compare case-insensitively (SQL identifiers usually are). */
export function sameColumns(expected: string[], actual: string[]): boolean {
  return expected.length === actual.length && expected.every((c, i) => c.toLowerCase() === actual[i]?.toLowerCase());
}
