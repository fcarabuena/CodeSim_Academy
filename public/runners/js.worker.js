/*
 * JavaScript runner. Runs inside a Web Worker inside a sandboxed iframe
 * (opaque origin: no cookies, no access to the app or its API). The page
 * kills the whole iframe if a run exceeds the time limit.
 *
 * Message in:  { id, code, functionName?, calls: [{ id, args }] }
 * Message out: { id, stdout, error?, returns: { [callId]: { value?, undefined?, error? } } }
 */
"use strict";

function format(value) {
  if (typeof value === "string") return value;
  if (value === undefined) return "undefined";
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function describeError(err) {
  if (err && typeof err === "object" && "name" in err && "message" in err) return `${err.name}: ${err.message}`;
  return `Error: ${String(err)}`;
}

/** Copy a value through JSON so it can be posted and compared safely. */
function toJson(value) {
  return JSON.parse(JSON.stringify(value));
}

self.onmessage = (event) => {
  const { id, code, functionName, calls } = event.data;
  const lines = [];
  const log = (...args) => lines.push(args.map(format).join(" "));
  self.console = { log, info: log, warn: log, error: log, debug: log };

  let error;
  let fn;
  try {
    // Student code runs as a function body, so top-level let/const stay local.
    const lookup = functionName
      ? `\n;return typeof ${functionName} === "function" ? ${functionName} : undefined;`
      : "";
    fn = new Function(`${code}\n${lookup}`)();
  } catch (err) {
    error = describeError(err);
  }

  const returns = {};
  if (!error && functionName) {
    for (const call of calls) {
      if (typeof fn !== "function") break;
      try {
        const value = fn(...call.args);
        returns[call.id] = value === undefined ? { undefined: true } : { value: toJson(value) };
      } catch (err) {
        returns[call.id] = { error: describeError(err) };
      }
    }
  }

  self.postMessage({ id, stdout: lines.join("\n"), error, returns });
};

self.postMessage({ __loaded: true });
