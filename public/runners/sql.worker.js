/*
 * SQL runner using sql.js (SQLite compiled to WebAssembly), downloaded from
 * the jsDelivr CDN by the student's browser. Every run gets a fresh copy of
 * the lesson's dataset, so students can't break it. Runs inside a Web Worker
 * inside a sandboxed iframe (opaque origin: no cookies, no access to the app).
 *
 * Message in:  { id, code, datasetSql }
 * Message out: { id, columns, rows, truncated?, error? }
 */
"use strict";

const SQLJS_URL = "https://cdn.jsdelivr.net/npm/sql.js@1.15.1/dist/";
const MAX_ROWS = 1000;

let SQL;
let loadError;
const ready = (async () => {
  try {
    importScripts(`${SQLJS_URL}sql-wasm.js`);
    SQL = await initSqlJs({ locateFile: (file) => `${SQLJS_URL}${file}` });
    self.postMessage({ __loaded: true });
  } catch (err) {
    loadError = `The SQL engine couldn't be loaded (${err && err.message ? err.message : err}). Check your internet connection and try again.`;
    self.postMessage({ __loadError: loadError });
  }
})();

self.onmessage = async (event) => {
  const { id, code, datasetSql } = event.data;
  await ready;
  if (loadError) {
    self.postMessage({ id, columns: [], rows: [], error: loadError });
    return;
  }
  if (!code.trim()) {
    self.postMessage({ id, columns: [], rows: [], error: "Write a query first, then press Run." });
    return;
  }

  const db = new SQL.Database();
  try {
    db.exec(datasetSql);
    const results = db.exec(code);
    // Show the result of the last statement that returned rows.
    const last = results[results.length - 1];
    const rows = last ? last.values : [];
    self.postMessage({
      id,
      columns: last ? last.columns : [],
      rows: rows.slice(0, MAX_ROWS),
      truncated: rows.length > MAX_ROWS,
    });
  } catch (err) {
    self.postMessage({ id, columns: [], rows: [], error: err && err.message ? err.message : String(err) });
  } finally {
    db.close();
  }
};
