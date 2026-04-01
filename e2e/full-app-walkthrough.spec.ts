import { test, expect, type Page } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "";
const canTestDashboard = Boolean(adminEmail && adminPassword);

/** No Supabase session — required so “unauthenticated” tests see /login redirects. */
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await context.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });
});

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/admin", { timeout: 25_000 });
}

test.describe("Public marketing & auth shell", () => {
  test("landing: hero, features, Login and Register", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("SmartSchool Manager").first()).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: /complete school management.*one place/i })
    ).toBeVisible();
    await expect(page.getByText("SmartSchool Manager").first()).toBeVisible();

    await page.getByRole("link", { name: /^Login$/ }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

    await page.goto("/");
    await page.getByRole("link", { name: /^Register$/ }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();
  });

  test("landing: admin / teacher CTA links go to login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /login as admin/i }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/");
    await page.getByRole("link", { name: /login as teacher/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("login: empty submit blocked by HTML5 validation or shows browser validation", async ({
    page,
  }) => {
    await page.goto("/login");
    const email = page.getByLabel("Email");
    await email.clear();
    await page.getByLabel("Password").clear();
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(email).toBeVisible();
    const bad = await email.evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(bad).toBeTruthy();
  });

  test("login: invalid credentials shows error (toast or message)", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("not-a-real-user@example.com");
    await page.getByLabel("Password").fill("wrong-password-12345");
    await page.getByRole("button", { name: /sign in/i }).click();
    // Sonner toast or Supabase error — wait for any failure feedback
    await expect(
      page.locator("[data-sonner-toast], li[data-sonner-toast]").first()
    ).toBeVisible({ timeout: 25_000 });
  });

  test("register: switch admin / teacher modes and form fields", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("#reg-email")).toBeVisible();
    await page.getByRole("button", { name: /join as teacher/i }).click();
    await expect(page.getByLabel("School code")).toBeVisible();
    await page.getByRole("button", { name: /new school \(admin\)/i }).click();
    await expect(page.getByLabel("School name")).toBeVisible();
    await page.getByRole("link", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("Protected routes redirect to login", () => {
  for (const path of [
    "/admin",
    "/teacher",
    "/students",
    "/add-student",
    "/bulk-upload",
    "/attendance",
    "/fees",
    "/marks-entry",
    "/reports",
    "/alerts",
  ]) {
    test(`unauthenticated ${path} → /login`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    });
  }

  test("student detail fake id redirects or shows login", async ({ page }) => {
    await page.goto("/student/00000000-0000-0000-0000-000000000001", {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});

test.describe("404", () => {
  test("unknown path shows not found", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-xyz", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").filter({ hasText: "404" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/oops! page not found/i)).toBeVisible();
  });
});

test.describe("Logged-in admin — full UI crawl", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!canTestDashboard, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run dashboard tests");
    await loginAsAdmin(page);
  });

  test("dashboard home stats and quick actions", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /admin dashboard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /add student/i }).first()).toBeVisible();
    await page.getByRole("link", { name: /mark attendance/i }).first().click();
    await expect(page).toHaveURL(/\/attendance$/);
  });

  test("sidebar: every admin link loads without crash", async ({ page }) => {
    await page.goto("/admin");
    const links: { name: RegExp; path: RegExp }[] = [
      { name: /^Dashboard$/, path: /\/admin$/ },
      { name: /^Students$/, path: /\/students$/ },
      { name: /^Add Student$/, path: /\/add-student$/ },
      { name: /^Bulk Upload$/, path: /\/bulk-upload$/ },
      { name: /^Attendance$/, path: /\/attendance$/ },
      { name: /^Fee Management$/, path: /\/fees$/ },
      { name: /^Marks Entry$/, path: /\/marks-entry$/ },
      { name: /^Reports$/, path: /\/reports$/ },
      { name: /^Parent Alerts$/, path: /\/alerts$/ },
    ];
    for (const { name, path } of links) {
      await page.getByRole("link", { name }).first().click();
      await expect(page).toHaveURL(path);
      // Page header from DashboardLayout
      await expect(page.locator("header h1").first()).toBeVisible();
    }
  });

  test("students list: search, filters, pagination controls if present", async ({ page }) => {
    await page.goto("/students");
    await expect(page.locator("header h1").filter({ hasText: /^Students$/ })).toBeVisible();
    await page.getByPlaceholder(/search name or roll/i).fill("test");
    await expect(page.getByPlaceholder(/search name or roll/i)).toHaveValue("test");
    const feeSelect = page.locator("select").filter({ hasText: "" }).nth(1);
    if ((await feeSelect.count()) > 0) await feeSelect.selectOption({ index: 1 });
    await page.getByRole("link", { name: /add student/i }).click();
    await expect(page).toHaveURL(/\/add-student$/);
  });

  test("add student: form fields and cancel", async ({ page }) => {
    await page.goto("/add-student");
    await page.getByLabel("Full Name").fill("E2E Test Student");
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page).toHaveURL(/\/students$/);
  });

  test("bulk upload: template download and drop zone", async ({ page }) => {
    await page.goto("/bulk-upload");
    const dl = page.getByRole("button", { name: /download sample template/i });
    await expect(dl).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), dl.click()]);
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
  });

  test("attendance: date, class selector, submit button", async ({ page }) => {
    await page.goto("/attendance");
    await page.getByRole("button", { name: /select all present/i }).click();
    await page.getByRole("button", { name: /submit attendance/i }).click();
    // May toast success / error depending on data
    await page.waitForTimeout(500);
  });

  test("fees: table or loading state", async ({ page }) => {
    await page.goto("/fees");
    await expect(page.getByRole("heading", { name: /fee management/i })).toBeVisible();
  });

  test("marks entry: controls visible", async ({ page }) => {
    await page.goto("/marks-entry");
    await expect(page.getByRole("heading", { name: /marks entry/i })).toBeVisible();
    await page.getByRole("button", { name: /save all/i }).click();
    await page.waitForTimeout(300);
  });

  test("reports: generate / bulk controls", async ({ page }) => {
    await page.goto("/reports");
    await page.getByRole("button", { name: /preview first student/i }).click();
    await page.waitForTimeout(800);
  });

  test("alerts: compose and history table", async ({ page }) => {
    await page.goto("/alerts");
    await expect(page.getByText(/compose alert/i)).toBeVisible();
    await page.getByRole("button", { name: /send alert/i }).click();
    await page.waitForTimeout(1000);
  });

  test("logout returns to ability to see login", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("button", { name: /^logout$/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("Logged-in teacher — allowed routes", () => {
  test.beforeEach(async ({ page }) => {
    const te = process.env.E2E_TEACHER_EMAIL ?? "";
    const tp = process.env.E2E_TEACHER_PASSWORD ?? "";
    test.skip(!te || !tp, "Set E2E_TEACHER_EMAIL and E2E_TEACHER_PASSWORD for teacher tests");
    await page.goto("/login");
    await page.getByLabel("Email").fill(te);
    await page.getByLabel("Password").fill(tp);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/teacher", { timeout: 25_000 });
  });

  test("teacher blocked from fees", async ({ page }) => {
    await page.goto("/fees");
    await expect(page).not.toHaveURL(/\/fees$/);
  });

  test("teacher can open students and attendance", async ({ page }) => {
    await page.goto("/students");
    await expect(page).toHaveURL(/\/students$/);
    await page.goto("/attendance");
    await expect(page).toHaveURL(/\/attendance$/);
  });
});
