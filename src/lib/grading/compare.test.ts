import { describe, expect, it } from "vitest";
import { compareRows, deepEqual, normalizeCss, normalizeOutput, sameColumns, show } from "./compare";

describe("deepEqual", () => {
  it("compares primitives, arrays and objects structurally", () => {
    expect(deepEqual([1, [2, { a: "x" }]], [1, [2, { a: "x" }]])).toBe(true);
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual("1", 1)).toBe(false);
  });

  it("tolerates float noise", () => {
    expect(deepEqual(0.1 + 0.2, 0.3)).toBe(true);
    expect(deepEqual(0.3, 0.31)).toBe(false);
  });

  it("does not treat arrays and objects as equal", () => {
    expect(deepEqual([], {})).toBe(false);
  });
});

describe("normalizeOutput", () => {
  it("ignores CRLF, trailing spaces and trailing blank lines", () => {
    expect(normalizeOutput("a  \r\nb\n\n\n")).toBe("a\nb");
  });
  it("keeps leading whitespace and inner blank lines", () => {
    expect(normalizeOutput("  a\n\nb")).toBe("  a\n\nb");
  });
});

describe("show", () => {
  it("renders values as JSON and truncates", () => {
    expect(show("hi")).toBe('"hi"');
    expect(show(undefined)).toBe("undefined");
    expect(show("x".repeat(200), 10)).toHaveLength(10);
  });
});

describe("compareRows", () => {
  const expected = [
    ["Mouse", 24.99],
    ["Keyboard", 79],
  ];

  it("is order-insensitive by default", () => {
    expect(compareRows(expected, [["Keyboard", 79], ["Mouse", 24.99]], false)).toEqual({ equal: true });
  });

  it("reports wrong order when order matters", () => {
    expect(compareRows(expected, [["Keyboard", 79], ["Mouse", 24.99]], true)).toEqual({ equal: false, reason: "order" });
    expect(compareRows(expected, expected, true)).toEqual({ equal: true });
  });

  it("treats 79 and 79.0 as equal and rounds float noise", () => {
    expect(compareRows([[79.0], [0.3]], [[79], [0.1 + 0.2]], false)).toEqual({ equal: true });
  });

  it("distinguishes text from numbers and null", () => {
    expect(compareRows([["1"]], [[1]], false).equal).toBe(false);
    expect(compareRows([[null]], [["null"]], false).equal).toBe(false);
  });

  it("explains count, width and value differences", () => {
    expect(compareRows(expected, [["Mouse", 24.99]], false)).toEqual({ equal: false, reason: "count", expected: 2, actual: 1 });
    expect(compareRows(expected, [["Mouse"], ["Keyboard"]], false)).toEqual({ equal: false, reason: "width", expected: 2, actual: 1 });
    expect(compareRows(expected, [["Mouse", 24.99], ["Keyboard", 80]], false)).toEqual({ equal: false, reason: "values" });
  });

  it("respects duplicate rows", () => {
    expect(compareRows([["a"], ["a"], ["b"]], [["a"], ["b"], ["b"]], false).equal).toBe(false);
  });

  it("accepts two empty results", () => {
    expect(compareRows([], [], false)).toEqual({ equal: true });
  });
});

describe("sameColumns", () => {
  it("compares names case-insensitively and in order", () => {
    expect(sameColumns(["name", "price"], ["NAME", "Price"])).toBe(true);
    expect(sameColumns(["name", "price"], ["price", "name"])).toBe(false);
    expect(sameColumns(["name"], ["name", "price"])).toBe(false);
  });
});

describe("normalizeCss", () => {
  it("treats hex, rgb(), rgba(..., 1) and named colours as the same colour", () => {
    const yellow = "rgb(255, 255, 0)";
    for (const v of ["#ff0", "#FFFF00", "yellow", "rgb(255,255,0)", "rgba(255, 255, 0, 1)", "rgb(255 255 0)"]) {
      expect(normalizeCss(v), v).toBe(yellow);
    }
    expect(normalizeCss("rgba(255, 255, 0, 0.5)")).not.toBe(yellow);
  });

  it("maps font-weight keywords to numbers and tidies spacing", () => {
    expect(normalizeCss("bold")).toBe("700");
    expect(normalizeCss(" Space-Between ")).toBe("space-between");
  });
});
