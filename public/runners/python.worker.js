/*
 * Python runner using Pyodide (CPython compiled to WebAssembly), downloaded
 * from the jsDelivr CDN by the student's browser. Runs inside a Web Worker
 * inside a sandboxed iframe (opaque origin: no cookies, no access to the app).
 *
 * Pinned to the 0.29 line: Pyodide 314+ only supports module workers, which
 * browsers don't allow from an opaque-origin sandbox.
 *
 * Message in:  { id, code, functionName?, calls: [{ id, args }] }
 * Message out: { id, stdout, error?, returns: { [callId]: { value?, error? } } }
 */
"use strict";

const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.29.5/full/";

const HELPERS = `
import builtins, json

def _codesim_no_input(prompt=""):
    raise RuntimeError("input() isn't available in this editor. Use a variable instead, e.g. name = \\"Ada\\"")

builtins.input = _codesim_no_input

def _codesim_call(fn, args_json):
    return json.dumps(fn(*json.loads(args_json)))
`;

/** Keep only the part of a traceback that points at the student's code. */
function cleanError(message) {
  const lines = String(message).trimEnd().split("\n");
  const start = lines.findIndex((l) => l.includes('File "<exec>"'));
  const relevant = start >= 0 ? lines.slice(start) : lines.slice(-3);
  return relevant
    .map((l) => l.replace('File "<exec>"', "Your code"))
    .join("\n")
    .trim();
}

let pyodide;
let loadError;
const ready = (async () => {
  try {
    importScripts(`${PYODIDE_URL}pyodide.js`);
    pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
    pyodide.runPython(HELPERS);
    self.postMessage({ __loaded: true });
  } catch (err) {
    loadError = `Python couldn't be loaded (${err && err.message ? err.message : err}). Check your internet connection and try again.`;
    self.postMessage({ __loadError: loadError });
  }
})();

self.onmessage = async (event) => {
  const { id, code, functionName, calls } = event.data;
  await ready;
  if (loadError) {
    self.postMessage({ id, stdout: "", error: loadError, returns: {} });
    return;
  }

  const out = [];
  pyodide.setStdout({ batched: (s) => out.push(s) });
  pyodide.setStderr({ batched: (s) => out.push(s) });

  // A fresh namespace per run, so variables from the last run don't leak in.
  const ns = pyodide.globals.get("dict")();
  ns.set("__name__", "__main__");

  let error;
  const returns = {};
  try {
    await pyodide.runPythonAsync(code, { globals: ns });
  } catch (err) {
    error = cleanError(err.message);
  }

  if (!error && functionName) {
    const fn = ns.get(functionName);
    const call = pyodide.globals.get("_codesim_call");
    for (const c of calls) {
      if (typeof fn !== "function") break; // callable PyProxies are JS functions
      try {
        returns[c.id] = { value: JSON.parse(call(fn, JSON.stringify(c.args))) };
      } catch (err) {
        returns[c.id] = { error: cleanError(err.message) };
      }
    }
    call.destroy();
    if (fn && typeof fn.destroy === "function") fn.destroy();
  }
  ns.destroy();

  self.postMessage({ id, stdout: out.join("\n"), error, returns });
};
