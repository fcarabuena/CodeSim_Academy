import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { guardHtml, guardLoops, LOOP_GUARD_RUNTIME } from "./loop-guard";

/** Run guarded code with the real guard runtime and a fake clock. */
function runGuarded(code: string, { msPerCall = 50 } = {}) {
  let now = 0;
  const messages: unknown[] = [];
  const context = vm.createContext({
    Date: { now: () => (now += msPerCall) },
    setTimeout: () => 0, // never fires during the synchronous run, like a busy page
    parent: { postMessage: (m: unknown) => messages.push(m) },
    result: [] as unknown[],
  });
  (context as { window: unknown }).window = context;
  vm.runInContext(LOOP_GUARD_RUNTIME, context);
  let error: Error | undefined;
  try {
    vm.runInContext(guardLoops(code), context, { timeout: 2000 });
  } catch (e) {
    error = e as Error;
  }
  return { error, messages, result: (context as { result: unknown[] }).result };
}

describe("guardLoops", () => {
  it.each([
    ["while", "while (true) {}"],
    ["for", "for (;;) {}"],
    ["do-while", "do {} while (true)"],
    ["no braces", "let i = 0; while (true) i++;"],
    ["nested", "for (let i = 0; i < 3; i++) { while (true) {} }"],
    ["labelled", "outer: while (true) { continue outer; }"],
    ["in a function", "function spin() { while (true) {} } spin();"],
  ])("stops an infinite %s loop", (_name, code) => {
    const { error, messages } = runGuarded(code);
    expect(error?.message).toMatch(/Stopped a loop/);
    expect(messages).toEqual([{ type: "codesim:loop" }]);
  });

  it("lets normal loops finish and keeps their behaviour", () => {
    const { error, result } = runGuarded(
      "for (const x of [1, 2, 3]) result.push(x); for (const k in { a: 1 }) { result.push(k); } let n = 0; do { n++ } while (n < 3); result.push(n);",
      { msPerCall: 1 },
    );
    expect(error).toBeUndefined();
    expect(result).toEqual([1, 2, 3, "a", 3]);
  });

  it("doesn't touch loops mentioned in strings or comments", () => {
    const code = 'const s = "while (true) {}"; // for (;;) {}';
    expect(guardLoops(code)).toBe(code);
  });

  it("leaves code with syntax errors unchanged", () => {
    expect(guardLoops("while (true {")).toBe("while (true {");
  });

  it("supports module syntax", () => {
    expect(guardLoops("import x from './x.js'; while (x) {}")).toContain("__codesimLoopGuard();");
  });
});

describe("guardHtml", () => {
  it("guards inline scripts and adds the runtime after <head>", () => {
    const out = guardHtml("<!DOCTYPE html><html><head><title>t</title></head><body><script>while(true){}</script></body></html>");
    expect(out.indexOf("window.__codesimLoopGuard")).toBeGreaterThan(out.indexOf("<head>"));
    expect(out).toContain("while(true){__codesimLoopGuard();}");
  });

  it("never puts the runtime before <!DOCTYPE>", () => {
    const out = guardHtml("<!DOCTYPE html><p>hi</p><script>for(;;){}</script>");
    expect(out.startsWith("<!DOCTYPE html><script>")).toBe(true);
  });

  it("skips external scripts and non-JavaScript script types", () => {
    const html = '<script src="x.js"></script><script type="application/json">{"while": 1}</script>';
    expect(guardHtml(html)).toContain(html);
  });
});
