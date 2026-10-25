import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import pg from "pg";
import { EXTENSIONS } from "../../src/lib/content/schema";
import { listTracks } from "../../src/lib/content/loader";

/**
 * Smoke test: a student solves every lesson in a real browser (all four
 * runners, including Python via Pyodide), infinite loops are stopped, and a
 * teacher can create a class and follow the student. Every account it creates
 * is deleted afterwards.
 */

const runId = Date.now().toString(36);
const emailPrefix = `smoke-${runId}`;
const password = "SmokeTest123!";
const student = { name: "Smoke Student", email: `${emailPrefix}-student@example.com` };
const teacher = { name: "Smoke Teacher", email: `${emailPrefix}-teacher@example.com` };

const databaseUrl = process.env.E2E_DATABASE_URL ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;

async function sql<T extends pg.QueryResultRow>(query: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return (await client.query<T>(query, params)).rows;
  } finally {
    await client.end();
  }
}

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  // Remove only the accounts this run created (their submissions, progress,
  // badges and classes go with them via ON DELETE CASCADE).
  await sql(`DELETE FROM "User" WHERE email LIKE $1`, [`${emailPrefix}-%@example.com`]);
});

async function signUp(browser: Browser, who: { name: string; email: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/signup");
  await page.fill("#field-name", who.name);
  await page.fill("#field-email", who.email);
  await page.fill("#field-password", password);
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard");
  return page;
}

async function logIn(browser: Browser, who: { email: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.fill("#field-email", who.email);
  await page.fill("#field-password", password);
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard");
  return page;
}

async function openLesson(page: Page, track: string, lesson: string) {
  await page.goto(`/tracks/${track}/${lesson}`);
  await page.waitForFunction(() => {
    const m = (window as unknown as { monaco?: { editor: { getModels(): unknown[] } } }).monaco;
    return (m?.editor.getModels().length ?? 0) > 0;
  });
}

async function setCode(page: Page, code: string) {
  await page.evaluate((c) => {
    const m = (window as unknown as { monaco: { editor: { getModels(): { setValue(v: string): void }[] } } }).monaco;
    m.editor.getModels()[0]!.setValue(c);
  }, code);
}

const resultsSummary = (page: Page) => page.locator("div.space-y-3[aria-live=polite] p.font-semibold").first();

test("a student can solve every lesson with every runner", async ({ browser }) => {
  const page = await signUp(browser, student);
  const tracks = await listTracks();
  const lessons = tracks.flatMap((t) => t.lessons);
  expect(lessons.length).toBeGreaterThanOrEqual(14);

  // The starter code of the first lesson must fail.
  const first = lessons[0]!;
  await openLesson(page, first.trackSlug, first.slug);
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(resultsSummary(page)).toContainText(/Not quite|None of the|tests passed\. Keep going/);

  for (const lesson of lessons) {
    await test.step(`${lesson.trackSlug}/${lesson.slug}`, async () => {
      await openLesson(page, lesson.trackSlug, lesson.slug);
      const solution = fs.readFileSync(
        path.join("content", lesson.trackSlug, lesson.slug, `solution.${EXTENSIONS[lesson.language]}`),
        "utf8",
      );
      await setCode(page, solution);
      await page.getByRole("button", { name: "Submit" }).click();
      // Python downloads Pyodide on first use, so allow extra time.
      await expect(resultsSummary(page)).toContainText(/passed!/, { timeout: 120_000 });
    });
  }

  // Rewards were saved on the server.
  const [row] = await sql<{ xp: number; completed: number; badges: number }>(
    `SELECT u.xp,
       (SELECT COUNT(*)::int FROM "LessonProgress" p WHERE p."userId" = u.id AND p.status = 'COMPLETED') AS completed,
       (SELECT COUNT(*)::int FROM "UserBadge" b WHERE b."userId" = u.id) AS badges
     FROM "User" u WHERE u.email = $1`,
    [student.email],
  );
  expect(row!.completed).toBe(lessons.length);
  expect(row!.xp).toBe(lessons.reduce((sum, l) => sum + l.xp, 0));
  expect(row!.badges).toBeGreaterThanOrEqual(7);
});

test("infinite loops are stopped without freezing the page", async ({ browser }) => {
  const page = await logIn(browser, student);
  const cases = [
    { track: "javascript", lesson: "variables", code: "while (true) {}", message: /took longer than 5 seconds/ },
    { track: "python", lesson: "print-and-variables", code: "while True:\n    pass", message: /took longer than 5 seconds/ },
    {
      track: "html-css",
      lesson: "page-structure",
      code: "<!DOCTYPE html><html><body><h1>Hi</h1><script>while (true) {}</script></body></html>",
      message: /ran for more than 1 second/,
    },
  ];
  for (const c of cases) {
    await test.step(c.track, async () => {
      await openLesson(page, c.track, c.lesson);
      await setCode(page, c.code);
      await page.getByRole("button", { name: /Run/ }).click();
      await expect(page.getByRole("alert").filter({ hasText: c.message })).toBeVisible({ timeout: 120_000 });
      // The page is still responsive: the Run button works again.
      await expect(page.getByRole("button", { name: /Run/ })).toBeEnabled();
    });
  }
});

test("a teacher can create a class and follow a student", async ({ browser }) => {
  await signUp(browser, teacher);
  await sql(`UPDATE "User" SET role = 'TEACHER' WHERE email = $1`, [teacher.email]);
  // Like a real teacher after `npm run set-role`: log in again so the session
  // carries the new role (the proxy reads the role from the session).
  const teacherPage = await logIn(browser, teacher);

  await teacherPage.goto("/teacher");
  await expect(teacherPage.getByRole("heading", { name: "Teacher dashboard" })).toBeVisible();
  await teacherPage.fill("#class-name", "Smoke Test Class");
  await teacherPage.getByRole("button", { name: "Create class" }).click();
  await teacherPage.waitForURL(/\/teacher\/classes\//);
  const code = (await teacherPage.locator("span.font-mono.tracking-widest").first().textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  const studentPage = await logIn(browser, student);
  await studentPage.fill("#class-code", code.toLowerCase());
  await studentPage.getByRole("button", { name: "Join" }).click();
  await expect(studentPage.getByRole("status").filter({ hasText: "Smoke Test Class" })).toBeVisible();

  await teacherPage.reload();
  const row = teacherPage.locator("tbody tr", { hasText: student.name });
  await expect(row).toBeVisible();
  const total = (await listTracks()).reduce((n, t) => n + t.lessons.length, 0);
  await expect(row).toContainText(`${total} / ${total}`);

  await row.getByRole("link", { name: student.name }).click();
  await expect(teacherPage.getByRole("heading", { name: student.name })).toBeVisible();
  await expect(teacherPage.locator("details").first()).toBeVisible();

  // A student can't open teacher pages: the proxy redirects before anything
  // renders (a real HTTP redirect, not a client-side one).
  const direct = await studentPage.request.get(teacherPage.url(), { maxRedirects: 0 });
  expect(direct.status()).toBe(307);
  expect(new URL(direct.headers().location!, teacherPage.url()).pathname).toBe("/dashboard");
  await studentPage.goto(teacherPage.url());
  await expect(studentPage).toHaveURL(/\/dashboard$/);
});
