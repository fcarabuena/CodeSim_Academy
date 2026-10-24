import { parse, type Node } from "acorn";
import { simple } from "acorn-walk";
import { LOOP_LIMIT_MS } from "./types";

/**
 * Loop protection for "Build the page" previews.
 *
 * Scripts inside a student's page run in the preview iframe, which browsers
 * usually run on the same thread as our page, so an infinite loop there would
 * freeze the whole tab and can't be interrupted from outside. Instead we add a
 * cheap guard call to the start of every loop body before rendering. The
 * guard throws once a loop has kept the page busy for LOOP_LIMIT_MS without a
 * break, which stops the script and keeps the tab responsive.
 */

const GUARD = "__codesimLoopGuard";

/** Defined in the page before any student script runs. */
export const LOOP_GUARD_RUNTIME = `
(function () {
  var started = 0;
  var armed = false;
  window.${GUARD} = function () {
    var now = Date.now();
    if (!armed) {
      armed = true;
      started = now;
      // Runs only after the current task finishes, i.e. once the page is idle again.
      setTimeout(function () { armed = false; }, 0);
    } else if (now - started > ${LOOP_LIMIT_MS}) {
      parent.postMessage({ type: "codesim:loop" }, "*");
      throw new RangeError("Stopped a loop that ran for more than ${LOOP_LIMIT_MS / 1000} second(s). Is it an infinite loop?");
    }
  };
})();
`;

type Loop = Node & { body: Node };
const LOOP_TYPES = ["WhileStatement", "DoWhileStatement", "ForStatement", "ForInStatement", "ForOfStatement"] as const;

/** Add the guard to every loop in one script. Returns the code unchanged if it doesn't parse. */
export function guardLoops(code: string): string {
  let ast: Node;
  try {
    ast = parse(code, { ecmaVersion: "latest", sourceType: "script", allowReturnOutsideFunction: true });
  } catch {
    try {
      ast = parse(code, { ecmaVersion: "latest", sourceType: "module" });
    } catch {
      return code; // A syntax error never runs, so it can't loop.
    }
  }

  const edits: { at: number; text: string }[] = [];
  const visitor = (node: Node) => {
    const body = (node as Loop).body;
    if (body.type === "BlockStatement") {
      edits.push({ at: body.start + 1, text: `${GUARD}();` });
    } else {
      edits.push({ at: body.start, text: `{${GUARD}();` }, { at: body.end, text: "}" });
    }
  };
  simple(ast, Object.fromEntries(LOOP_TYPES.map((t) => [t, visitor])));

  // Apply from the end so earlier positions stay valid.
  edits.sort((a, b) => b.at - a.at);
  let out = code;
  for (const e of edits) out = out.slice(0, e.at) + e.text + out.slice(e.at);
  return out;
}

const SCRIPT_RE = /(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)/gi;

/** Guard every inline classic or module script in an HTML document. */
export function guardHtml(html: string): string {
  const guarded = html.replace(SCRIPT_RE, (match, open: string, body: string, close: string) => {
    if (/\bsrc\s*=/i.test(open)) return match;
    const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(open)?.[1]?.toLowerCase();
    if (type && !["module", "text/javascript", "application/javascript"].includes(type)) return match;
    return open + guardLoops(body) + close;
  });
  const runtime = `<script>${LOOP_GUARD_RUNTIME}</script>`;
  // Insert before any student script, but never before <!DOCTYPE> (that would trigger quirks mode).
  const anchor = /<head\b[^>]*>/i.exec(guarded) ?? /<!doctype[^>]*>/i.exec(guarded);
  if (!anchor) return runtime + guarded;
  const at = anchor.index + anchor[0].length;
  return guarded.slice(0, at) + runtime + guarded.slice(at);
}
