import initSqlJs from "sql.js";
import type { QueryResult } from "../src/lib/content/schema";

/**
 * Runs SQL with sql.js in Node. Authoring/test tool only: the app server
 * never runs SQL from lessons (students' queries run in their browsers).
 */
export async function runSql(datasetSql: string, query: string): Promise<QueryResult> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  try {
    db.exec(datasetSql);
    const results = db.exec(query);
    const last = results[results.length - 1];
    return {
      columns: last?.columns ?? [],
      rows: (last?.values ?? []) as QueryResult["rows"],
    };
  } finally {
    db.close();
  }
}
