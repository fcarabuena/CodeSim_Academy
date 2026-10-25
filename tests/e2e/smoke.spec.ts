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
const admin = { name: "Smoke Admin", email: `${emailPrefix}-admin@example.com` };
const victim = { name: "Smoke Victim", email: `${emailPrefix}-victim@example.com` };

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

/** Result toast from an admin/teacher action. */
const toastWith = (page: Page, text: string | RegExp) => page.locator(".toast-pop", { hasText: text });

/** Click a button that opens a confirm dialog, then confirm. */
async function confirmAction(page: Page, scope: ReturnType<Page["locator"]>, button: string, confirmLabel: string) {
  await scope.getByRole("button", { name: button }).click();
  await page.getByRole("dialog").getByRole("button", { name: confirmLabel }).click();
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

  // New join code: the old one stops working.
  await confirmAction(teacherPage, teacherPage.locator("main"), "New code", "Make new code");
  await expect(toastWith(teacherPage, "New join code")).toBeVisible();
  await teacherPage.reload();
  const newCode = (await teacherPage.locator("span.font-mono.tracking-widest").first().textContent())!.trim();
  expect(newCode).not.toBe(code);

  // Remove the student; they can't rejoin with the old code, only the new one.
  await confirmAction(teacherPage, teacherPage.locator("tbody tr", { hasText: student.name }), "Remove", "Remove from class");
  await expect(toastWith(teacherPage, "Removed")).toBeVisible();
  await teacherPage.reload();
  await expect(teacherPage.locator("tbody tr", { hasText: student.name })).toHaveCount(0);
  await studentPage.goto("/dashboard");
  await studentPage.fill("#class-code", code);
  await studentPage.getByRole("button", { name: "Join" }).click();
  await expect(studentPage.getByRole("status").filter({ hasText: "couldn't find a class" })).toBeVisible();
  await studentPage.fill("#class-code", newCode);
  await studentPage.getByRole("button", { name: "Join" }).click();
  await expect(studentPage.getByRole("status").filter({ hasText: "Smoke Test Class" })).toBeVisible();
  await teacherPage.reload();

  const rejoined = teacherPage.locator("tbody tr", { hasText: student.name });
  await rejoined.getByRole("link", { name: student.name }).click();
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

test("an admin manages users, classes and the audit log", async ({ browser }) => {
  await signUp(browser, victim);
  await signUp(browser, admin);
  await sql(`UPDATE "User" SET role = 'ADMIN' WHERE email = $1`, [admin.email]);
  const adminPage = await logIn(browser, admin);
  const studentPage = await logIn(browser, student);
  const teacherPage = await logIn(browser, teacher);

  // Only admins get into /admin: the proxy redirects everyone else before rendering.
  for (const page of [studentPage, teacherPage]) {
    const r = await page.request.get("/admin/users", { maxRedirects: 0 });
    expect(r.status()).toBe(307);
    expect(new URL(r.headers().location!, "http://x").pathname).toBe("/dashboard");
  }

  // Overview.
  await adminPage.goto("/admin");
  await expect(adminPage.getByRole("heading", { name: "Site administration" })).toBeVisible();
  await expect(adminPage.locator("header").getByRole("link", { name: "Admin" })).toBeVisible();

  // Users: search by name; emails are masked on the page.
  await adminPage.goto(`/admin/users?q=${encodeURIComponent(student.name)}`);
  const studentRow = adminPage.locator("tbody tr", { hasText: student.name });
  await expect(studentRow).toBeVisible();
  expect(await adminPage.content()).not.toContain(student.email);

  // Change role there and back.
  await studentRow.locator("select[name=role]").selectOption("TEACHER");
  await studentRow.getByRole("button", { name: "Change role" }).click();
  await expect(toastWith(adminPage, "is now teacher")).toBeVisible();
  // The student's open session picks up the new role without logging out.
  await studentPage.waitForTimeout(2500);
  await studentPage.goto("/dashboard");
  await expect(studentPage.locator("header").getByRole("link", { name: "Teacher" })).toBeVisible();
  await adminPage.reload();
  await studentRow.locator("select[name=role]").selectOption("STUDENT");
  await studentRow.getByRole("button", { name: "Change role" }).click();
  await expect(toastWith(adminPage, "is now student")).toBeVisible();

  // Disable: the student's open session stops working and they can't log in.
  await adminPage.reload();
  await confirmAction(adminPage, studentRow, "Disable", "Disable account");
  await expect(toastWith(adminPage, "can no longer log in")).toBeVisible();
  await studentPage.goto("/dashboard");
  await expect(studentPage).toHaveURL(/\/login/);
  const blocked = await (await browser.newContext()).newPage();
  await blocked.goto("/login");
  await blocked.fill("#field-email", student.email);
  await blocked.fill("#field-password", password);
  await blocked.click("button[type=submit]");
  await expect(blocked.locator("form [role=alert]")).toContainText("disabled");
  // ...and enable again.
  await adminPage.reload();
  await studentRow.getByRole("button", { name: "Enable" }).click();
  await expect(toastWith(adminPage, "can log in again")).toBeVisible();

  // An admin can't change their own account.
  await adminPage.goto(`/admin/users?q=${encodeURIComponent(admin.name)}`);
  await expect(adminPage.locator("tbody tr", { hasText: admin.name })).toContainText("change your own account");

  // Delete an account (with the confirm dialog).
  await adminPage.goto(`/admin/users?q=${encodeURIComponent(victim.name)}`);
  await confirmAction(adminPage, adminPage.locator("tbody tr", { hasText: victim.name }), "Delete", "Delete permanently");
  await expect(toastWith(adminPage, "Deleted")).toBeVisible();
  expect(await sql(`SELECT 1 FROM "User" WHERE email = $1`, [victim.email])).toHaveLength(0);

  // Classes: reassign the smoke class to the admin, then delete it.
  await adminPage.goto("/admin/classes");
  const classRow = adminPage.locator("tbody tr", { hasText: "Smoke Test Class" });
  await expect(classRow).toContainText(teacher.name);
  const adminOption = classRow.locator("select[name=teacherId] option", { hasText: admin.name });
  await classRow.locator("select[name=teacherId]").selectOption((await adminOption.getAttribute("value"))!);
  await classRow.getByRole("button", { name: "Reassign" }).click();
  await expect(toastWith(adminPage, "now belongs to")).toBeVisible();
  await adminPage.reload();
  await expect(classRow).toContainText(admin.name);
  await confirmAction(adminPage, classRow, "Delete", "Delete class");
  await expect(toastWith(adminPage, "Deleted the class")).toBeVisible();
  await adminPage.reload();
  await expect(adminPage.locator("tbody tr", { hasText: "Smoke Test Class" })).toHaveCount(0);

  // Content page shows completion counts.
  await adminPage.goto("/admin/content");
  await expect(adminPage.getByRole("heading", { name: "Badges" })).toBeVisible();

  // Audit log recorded every action, with masked emails.
  await adminPage.goto("/admin/audit");
  const log = adminPage.locator("tbody");
  for (const text of ["to teacher", "disabled Smoke Student", "re-enabled Smoke Student", "deleted Smoke Victim", "moved class", "deleted class", "new join code", "removed Smoke Student"]) {
    await expect(log).toContainText(text);
  }
  expect(await adminPage.content()).not.toContain(student.email);
});
