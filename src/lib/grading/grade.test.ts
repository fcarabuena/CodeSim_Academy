import { describe, expect, it } from "vitest";
import type { FunctionTests, PageTests, QueryTests } from "@/lib/content/schema";
import { evaluateDomCheck, gradeFunction, gradePage, gradeQuery } from "./grade";

describe("evaluateDomCheck", () => {
  it("exists", () => {
    expect(evaluateDomCheck({ kind: "exists", selector: "h1" }, { count: 1 })).toBeNull();
    expect(evaluateDomCheck({ kind: "exists", selector: "h1" }, { count: 0 })).toMatch(/Couldn't find/);
  });

  it("count with min/max and exact wording", () => {
    const exact = { kind: "count", selector: "h1", min: 1, max: 1 } as const;
    expect(evaluateDomCheck(exact, { count: 1 })).toBeNull();
    expect(evaluateDomCheck(exact, { count: 2 })).toMatch(/expected exactly 1/);
    expect(evaluateDomCheck({ kind: "count", selector: "p", min: 2 }, { count: 1 })).toMatch(/at least 2/);
  });

  it("text matching: equals, contains (case-insensitive), regex", () => {
    const sel = { kind: "text", selector: "h1" } as const;
    expect(evaluateDomCheck({ ...sel, text: { equals: "Hi" } }, { count: 1, text: "Hi" })).toBeNull();
    expect(evaluateDomCheck({ ...sel, text: { contains: "hello" } }, { count: 1, text: "Oh HELLO there" })).toBeNull();
    expect(evaluateDomCheck({ ...sel, text: { matches: "\\S" } }, { count: 1, text: "" })).toMatch(/is empty/);
    expect(evaluateDomCheck({ ...sel, text: { equals: "Hi" } }, { count: 0 })).toMatch(/Couldn't find/);
  });

  it("attr", () => {
    const check = { kind: "attr", selector: "html", name: "lang", value: { matches: "^[a-z]{2}" } } as const;
    expect(evaluateDomCheck(check, { count: 1, attr: "en" })).toBeNull();
    expect(evaluateDomCheck(check, { count: 1, attr: null })).toMatch(/no "lang" attribute/);
    expect(evaluateDomCheck(check, { count: 1, attr: "1" })).toMatch(/isn't what we expected/);
  });

  it("hasClass requires every match to have the class", () => {
    const check = { kind: "hasClass", selector: ".col", className: "col-md-4" } as const;
    expect(evaluateDomCheck(check, { count: 2, classes: [["col", "col-md-4"], ["col-md-4"]] })).toBeNull();
    expect(evaluateDomCheck(check, { count: 2, classes: [["col", "col-md-4"], ["col"]] })).toMatch(/1 of 2/);
  });

  it("style compares normalised computed values", () => {
    const check = { kind: "style", selector: "h1", property: "color", equals: "rgb(255, 0, 0)" } as const;
    expect(evaluateDomCheck(check, { count: 1, style: "rgb(255,0,0)" })).toBeNull();
    expect(evaluateDomCheck(check, { count: 1, style: "rgb(0, 0, 0)" })).toMatch(/color: rgb\(0, 0, 0\)/);
  });

  it("reports missing observations and invalid selectors", () => {
    expect(evaluateDomCheck({ kind: "exists", selector: "h1" }, undefined)).toMatch(/couldn't inspect/);
    expect(evaluateDomCheck({ kind: "exists", selector: "[" }, { count: 0, error: "invalid selector [" })).toMatch(/invalid selector/);
  });
});

describe("gradePage", () => {
  const tests: PageTests = {
    tests: [
      { id: "h1", name: "Has a heading", check: { kind: "exists", selector: "h1" }, hint: "Add an <h1>." },
      { id: "p", name: "Has paragraphs", check: { kind: "count", selector: "p", min: 2 } },
    ],
  };

  it("scores partial passes and attaches hints only to failures", () => {
    const r = gradePage(tests, { type: "page", probes: { h1: { count: 0 }, p: { count: 2 } } });
    expect(r.passed).toBe(false);
    expect(r.score).toBe(50);
    expect(r.results[0]).toMatchObject({ passed: false, hint: "Add an <h1>." });
    expect(r.results[1]).toEqual({ id: "p", name: "Has paragraphs", passed: true, message: "" });
  });

  it("fails every test on timeout", () => {
    const r = gradePage(tests, { type: "page", probes: {}, timedOut: true });
    expect(r.score).toBe(0);
    expect(r.results.every((x) => /infinite loop/.test(x.message))).toBe(true);
  });
});

describe("gradeFunction", () => {
  const tests: FunctionTests = {
    functionName: "add",
    tests: [
      { id: "a", kind: "returns", name: "add(2, 3)", args: [2, 3], expected: 5 },
      { id: "b", kind: "returns", name: "add(-1, 1)", args: [-1, 1], expected: 0 },
    ],
  };

  it("passes when every return value matches", () => {
    const r = gradeFunction(tests, { type: "function", stdout: "", returns: { a: { value: 5 }, b: { value: 0 } } });
    expect(r).toMatchObject({ passed: true, score: 100 });
  });

  it("explains wrong values, missing returns, errors and missing functions", () => {
    const wrong = gradeFunction(tests, { type: "function", stdout: "", returns: { a: { value: 6 }, b: { undefined: true } } });
    expect(wrong.results[0]!.message).toBe("add(2, 3) returned 6, but expected 5.");
    expect(wrong.results[1]!.message).toMatch(/forget to `return`/);

    const err = gradeFunction(tests, { type: "function", stdout: "", returns: { a: { error: "TypeError: x" } } });
    expect(err.results[0]!.message).toMatch(/raised an error/);
    expect(err.results[1]!.message).toMatch(/Did you define a function called add/);
  });

  it("fails everything when the program crashes or times out", () => {
    const crash = gradeFunction(tests, { type: "function", stdout: "", error: "SyntaxError: oops", returns: {} });
    expect(crash.results.every((x) => x.message.includes("SyntaxError: oops"))).toBe(true);
    const slow = gradeFunction(tests, { type: "function", stdout: "", timedOut: true, returns: {} });
    expect(slow.score).toBe(0);
  });

  it("speaks Python to Python students", () => {
    const py: FunctionTests = {
      functionName: "greet",
      tests: [{ id: "g", kind: "returns", name: "greet", args: ["Ada"], expected: "Hello, Ada!" }],
    };
    const none = gradeFunction(py, { type: "function", stdout: "", returns: { g: { value: null } } }, "python");
    expect(none.results[0]!.message).toBe("greet('Ada') returned None. Did you forget to `return` the result?");
    const wrong = gradeFunction(py, { type: "function", stdout: "", returns: { g: { value: [true, "it's"] } } }, "python");
    expect(wrong.results[0]!.message).toBe(`greet('Ada') returned [True, "it's"], but expected 'Hello, Ada!'.`);
  });

  it("compares printed output, ignoring trailing whitespace", () => {
    const out: FunctionTests = { tests: [{ id: "o", kind: "stdout", name: "prints", expected: "Hello\nWorld" }] };
    expect(gradeFunction(out, { type: "function", stdout: "Hello  \r\nWorld\n", returns: {} }).passed).toBe(true);
    const r = gradeFunction(out, { type: "function", stdout: "Hello\nworld", returns: {} });
    expect(r.passed).toBe(false);
    expect(r.results[0]!.message).toContain("but it printed:\nHello\nworld");
    expect(gradeFunction(out, { type: "function", stdout: "", returns: {} }).results[0]!.message).toMatch(/didn't print anything/);
  });
});

describe("gradeQuery", () => {
  const tests: QueryTests = {
    dataset: "shop",
    ordered: false,
    tests: [
      { id: "columns", check: "columns", name: "Right columns" },
      { id: "rows", check: "rows", name: "Right rows", hint: "Use WHERE." },
    ],
  };
  const expected = { columns: ["name", "price"], rows: [["Mouse", 24.99], ["Keyboard", 79]] };

  it("passes matching results in any order", () => {
    const r = gradeQuery(tests, expected, { type: "query", columns: ["name", "price"], rows: [["Keyboard", 79.0], ["Mouse", 24.99]] });
    expect(r).toMatchObject({ passed: true, score: 100 });
  });

  it("checks columns and rows separately", () => {
    const r = gradeQuery(tests, expected, {
      type: "query",
      columns: ["id", "name", "category", "price"],
      rows: [[1, "Mouse", "Electronics", 24.99]],
    });
    expect(r.results[0]!.message).toBe("Your query returned the columns (id, name, category, price), but expected (name, price).");
    expect(r.results[1]!.message).toBe("Your query returned 1 row, but expected 2.");
    expect(r.results[1]!.hint).toBe("Use WHERE.");
  });

  it("reports SQL errors on every test", () => {
    const r = gradeQuery(tests, expected, { type: "query", columns: [], rows: [], error: "no such table: product" });
    expect(r.results.every((x) => x.message.includes("no such table: product"))).toBe(true);
  });

  it("reports wrong order when the lesson requires it", () => {
    const r = gradeQuery({ ...tests, ordered: true }, expected, {
      type: "query",
      columns: ["name", "price"],
      rows: [["Keyboard", 79], ["Mouse", 24.99]],
    });
    expect(r.results[1]!.message).toMatch(/wrong order/);
  });
});
