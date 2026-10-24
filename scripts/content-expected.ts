/**
 * Regenerates expected.json for every SQL lesson by running its solution.sql
 * against its dataset. Run after adding or changing a SQL lesson:
 *
 *   npm run content:expected
 *
 * The content test fails if an expected.json is missing or out of date.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  CONTENT_DIR,
  getDataset,
  getLessonSolution,
  getLessonTests,
  listTracks,
} from "../src/lib/content/loader";
import type { QueryTests } from "../src/lib/content/schema";
import { runSql } from "./sql-node";

async function main() {
  let count = 0;
  for (const track of await listTracks()) {
    for (const lesson of track.lessons) {
      if (lesson.type !== "query") continue;
      const tests = (await getLessonTests(lesson)) as QueryTests;
      const result = await runSql(await getDataset(tests.dataset), await getLessonSolution(lesson));
      const file = path.join(CONTENT_DIR, track.slug, lesson.slug, "expected.json");
      await fs.writeFile(file, `${JSON.stringify(result, null, 2)}\n`);
      console.log(`✓ ${track.slug}/${lesson.slug}: ${result.rows.length} row(s)`);
      count++;
    }
  }
  console.log(`Wrote ${count} expected.json file(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
