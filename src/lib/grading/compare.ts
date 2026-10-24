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

/** Python's repr() of a JSON value: None/True/False, 'quoted' strings, lists and dicts. */
export function pythonRepr(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    // Like Python: single quotes unless the text contains one and no double quotes.
    const quote = value.includes("'") && !value.includes('"') ? '"' : "'";
    const escaped = value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(quote, `\\${quote}`);
    return quote + escaped + quote;
  }
  if (Array.isArray(value)) return `[${value.map(pythonRepr).join(", ")}]`;
  return `{${Object.entries(value as Record<string, unknown>).map(([k, v]) => `${pythonRepr(k)}: ${pythonRepr(v)}`).join(", ")}}`;
}

/** Render a value the way the student's language would print it. */
export function showIn(language: "javascript" | "python", value: unknown, max = 120): string {
  if (language === "javascript") return show(value, max);
  const s = pythonRepr(value);
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

// --- CSS value comparison ------------------------------------------------------

const NAMED_COLORS: Record<string, string> = {
  black: "0, 0, 0",
  white: "255, 255, 255",
  red: "255, 0, 0",
  green: "0, 128, 0",
  blue: "0, 0, 255",
  yellow: "255, 255, 0",
  orange: "255, 165, 0",
  purple: "128, 0, 128",
  pink: "255, 192, 203",
  gray: "128, 128, 128",
  grey: "128, 128, 128",
  navy: "0, 0, 128",
  teal: "0, 128, 128",
  gold: "255, 215, 0",
  coral: "255, 127, 80",
  tomato: "255, 99, 71",
  crimson: "220, 20, 60",
  lime: "0, 255, 0",
  aqua: "0, 255, 255",
  silver: "192, 192, 192",
  maroon: "128, 0, 0",
  olive: "128, 128, 0",
};

const FONT_WEIGHTS: Record<string, string> = { normal: "400", bold: "700" };

/**
 * Canonical form of a CSS value so "#ff0", "yellow" and "rgb(255,255,0)" all
 * compare equal (browsers report computed colours as rgb(), but lesson authors
 * and some test environments use other forms).
 */
export function normalizeCss(value: string): string {
  let v = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (FONT_WEIGHTS[v]) return FONT_WEIGHTS[v];
  if (NAMED_COLORS[v]) return `rgb(${NAMED_COLORS[v]})`;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (hex) {
    const h = hex[1]!.length === 3 ? [...hex[1]!].map((c) => c + c).join("") : hex[1]!;
    return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
  }
  const rgb = /^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:\s*[,/]\s*(1|1\.0+|100%))?\s*\)$/.exec(v);
  if (rgb) return `rgb(${rgb[1]}, ${rgb[2]}, ${rgb[3]})`;
  v = v.replace(/\s*,\s*/g, ", ");
  return v;
}
