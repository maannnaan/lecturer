import { type Page, expect, test } from "@playwright/test";

// Phase 3b: the question bank by class › subject › chapter › section, in the dashboard and on the
// website. Runs after phase3 on the same demo database: tanvir has HSC physics questions (course 1,
// chapters 3–5) and SSC physics questions (course 3, chapter 2).

const SHOTS = process.env.SHOTS_DIR;
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function login(page: Page, phone: string) {
  await page.goto("/login");
  await page.getByLabel("মোবাইল নম্বর বা ইমেইল").fill(phone);
  await page.getByLabel("পাসওয়ার্ড").fill("teacher-password");
  await page.getByRole("button", { name: "লগইন করুন" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** A form field by its exact label, on the page in view (Next keeps left pages mounted, hidden). */
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });

const SECTIONS = [/^পাঠ্যবইয়ের সমস্যা/, /^প্র্যাকটিস সমস্যা/, /^MCQ/, /^SQ/, /^CQ/];
const UUID = "[0-9a-f-]{36}";

test.describe.configure({ mode: "serial" });

test("the teacher's bank goes class › subject › chapter › section, and adds where you are", async ({ page }) => {
  await login(page, "01710000001");
  await page.getByRole("link", { name: "প্রশ্নব্যাংক" }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/bank$/);
  const classes = page.locator("main:visible .bank-card");
  await expect(classes).toHaveText([/^এসএসসি/, /^এইচএসসি/]);
  await shot(page, "dashboard-bank-classes-1280");

  await classes.filter({ hasText: "এইচএসসি" }).click();
  await expect(page).toHaveURL(/\/dashboard\/bank\/class\/hsc$/);
  const subjects = page.locator("main:visible .bank-card");
  // Every course of the class is there, questions or not yet.
  await expect(subjects.filter({ hasText: "পদার্থবিজ্ঞান ২য় পত্র" })).toContainText("০টি প্রশ্ন");
  await subjects.filter({ hasText: "পদার্থবিজ্ঞান ১ম পত্র" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/bank/course/${UUID}$`));
  await expect(page.locator("main:visible .ch-row")).toHaveCount(10);
  await shot(page, "dashboard-bank-chapters-1280");

  await page.locator("main:visible .ch-row").filter({ hasText: "নিউটনিয়ান বলবিদ্যা" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/bank/course/${UUID}/${UUID}$`));
  const tabs = page.locator("main:visible .tabs .tab");
  // All five sections, in order, empty ones too; the first with questions is open.
  await expect(tabs).toHaveText(SECTIONS);
  await expect(tabs.first()).toHaveAttribute("aria-current", "page");

  // The teacher's own view includes private questions, marked.
  await tabs.nth(2).click();
  await expect(page).toHaveURL(/tab=mcq/);
  await expect(page.locator("main:visible li.card").filter({ hasText: "কোনটি নিউটনের তৃতীয় সূত্রের উদাহরণ?" })).toContainText("শুধু আপনি");

  await page.locator("main:visible .tabs .tab").nth(1).click();
  await expect(page).toHaveURL(/tab=practice/);
  await expect(page.locator("main:visible li.card")).toHaveCount(2);
  await shot(page, "dashboard-bank-section-1280");
  await page.getByRole("link", { name: "নতুন প্র্যাকটিস সমস্যা" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/bank\/new\?type=practice&course=.+&chapter=.+/);
  // Course and chapter are already chosen: where the teacher was.
  await expect(field(page, "অধ্যায়")).toHaveValue(/.+/);
  await field(page, "প্রশ্ন").fill("$2\\,\\text{kg}$ ভরের বস্তুতে $6\\,\\text{N}$ বল প্রয়োগ করলে ত্বরণ কত?");
  await field(page, "উত্তর (ঐচ্ছিক)").fill("$3\\,\\text{m s}^{-2}$");
  await expect(page.locator(".q-card:visible .explain")).toContainText("উত্তর:");
  await page.getByRole("button", { name: "প্রশ্ন যোগ করুন" }).click();

  await expect(page).toHaveURL(new RegExp(`/dashboard/bank/course/${UUID}/${UUID}\\?tab=practice$`));
  await expect(page.locator("main:visible li.card")).toHaveCount(3);
  await expect(page.locator("main:visible li.card").last()).toContainText("ত্বরণ কত?");
});

test("a course's class and subject decide where it sits in the bank", async ({ page }) => {
  await login(page, "01710000001");
  await page.goto("/dashboard/courses");
  await page.locator("main li:visible").filter({ hasText: "পদার্থবিজ্ঞান ২য় পত্র" }).getByRole("link", { name: "সম্পাদনা" }).click();
  const form = page.getByRole("form", { name: "কোর্সের তথ্য" });
  await expect(field(page, "শ্রেণি")).toHaveValue("hsc");
  await expect(field(page, "শ্রেণি").locator("option:checked")).toHaveText("এইচএসসি (একাদশ-দ্বাদশ শ্রেণি)");
  await field(page, "শ্রেণি").selectOption("admission");
  await field(page, "বিষয়").fill("মেডিকেল ভর্তি: পদার্থবিজ্ঞান");
  await form.getByRole("button", { name: "সংরক্ষণ করুন" }).click();
  await expect(form.getByRole("status")).toHaveText("সংরক্ষিত হয়েছে");

  await page.goto("/dashboard/bank");
  await expect(page.locator("main:visible .bank-card")).toHaveText([/^এসএসসি/, /^এইচএসসি/, /^ভর্তি পরীক্ষা/]);
  await page.locator("main:visible .bank-card").filter({ hasText: "ভর্তি পরীক্ষা" }).click();
  await expect(page.locator("main:visible .bank-card")).toHaveText([/^মেডিকেল ভর্তি: পদার্থবিজ্ঞান/]);
  await expect(page.locator("main:visible .bank-card")).toContainText("পদার্থবিজ্ঞান ২য় পত্র");
});

test("students reach a chapter's sections through the website's question bank", async ({ page }) => {
  await page.goto("/tanvir");
  await page.locator(".site-nav").getByRole("link", { name: "প্রশ্নব্যাংক" }).click();
  await expect(page).toHaveURL(/\/tanvir\/bank$/);
  // Only classes and subjects that have public questions.
  await expect(page.locator(".bank-card:visible")).toHaveText([/^এসএসসি/, /^এইচএসসি/]);
  await shot(page, "site-bank-ink-1280");
  await page.locator(".bank-card:visible").filter({ hasText: "এইচএসসি" }).click();
  await expect(page).toHaveURL(/\/tanvir\/bank\/hsc$/);
  await expect(page.locator(".bank-card:visible")).toHaveText([/^পদার্থবিজ্ঞান ১ম পত্র/]);
  await page.locator(".bank-card:visible").click();
  await expect(page).toHaveURL(/\/tanvir\/courses\/1\/chapters$/);
  await shot(page, "site-bank-chapters-ink-1280");

  const newton = page.locator(".ch-row:visible").filter({ hasText: "নিউটনিয়ান বলবিদ্যা" });
  await expect(newton.locator(".tag")).toHaveText(SECTIONS);
  await expect(page.locator(".ch-row:visible").filter({ hasText: "আদর্শ গ্যাস" })).toContainText("শীঘ্রই");

  await newton.getByRole("link", { name: /^প্র্যাকটিস সমস্যা/ }).click();
  await expect(page).toHaveURL(/\/tanvir\/courses\/1\/chapters\/4\?tab=practice$/);
  await expect(page.locator(".tabs .tab:visible")).toHaveText(SECTIONS);
  await expect(page.locator(".tabs .tab.on:visible")).toHaveText(/^প্র্যাকটিস সমস্যা/);
  await expect(page.locator(".crumbs:visible")).toContainText("প্রশ্নব্যাংক");
  await expect(page.locator(".q-card:visible")).toHaveCount(3);

  // Students try first: the answer and the solution open only when asked.
  const card = page.locator(".q-card:visible").filter({ hasText: "ভরবেগের পরিবর্তন কত?" });
  await expect(card.getByText("উত্তর:")).toBeHidden();
  await card.getByText("উত্তর দেখো").click();
  await expect(card.getByText("উত্তর:")).toBeVisible();
  await expect(card.getByText("বলের ঘাত")).toBeHidden();
  await card.getByText("সমাধান দেখো").click();
  await expect(card.getByText("বলের ঘাত")).toBeVisible();
});

test("old chapter links open the matching section", async ({ page }) => {
  const open = page.locator(".tabs .tab.on:visible");
  await page.goto("/tanvir/courses/1/chapters/4?tab=problem");
  await expect(open).toHaveText(/^পাঠ্যবইয়ের সমস্যা/);
  await page.goto("/tanvir/courses/1/chapters/4?tab=creative");
  await expect(open).toHaveText(/^CQ/);
  // The old board-questions tab: the MCQ section, showing its board questions.
  await page.goto("/tanvir/courses/1/chapters/4?tab=board");
  await expect(open).toHaveText(/^MCQ/);
  await expect(page.locator(".q-card:visible")).toHaveCount(3);
});

test("bank addresses that don't exist are real 404s", async ({ request }) => {
  for (const path of ["/tanvir/bank", "/tanvir/bank/hsc", "/tanvir/bank/class-6", "/tanvir/courses/1/chapters"]) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
  for (const path of [
    "/tanvir/bank/nope",
    "/tanvir/bank/hsc/1",
    "/tanvir/courses/999/chapters",
    "/tanvir/courses/1/lessons",
    "/no-such-teacher-xyz/bank",
  ]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  const fits = async (page: Page, label: string) =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth - 360), label).toBeLessThanOrEqual(0);

  test("the bank's pages fit a 360px screen", async ({ page }) => {
    for (const path of ["/tanvir/bank", "/tanvir/bank/hsc", "/tanvir/courses/1/chapters", "/tanvir/courses/1/chapters/4?tab=practice"]) {
      await page.goto(path);
      await fits(page, path);
    }
    await page.goto("/tanvir/courses/1/chapters");
    await shot(page, "site-bank-chapters-ink-360");

    await login(page, "01710000001");
    await page.goto("/dashboard/bank");
    await fits(page, "classes");
    await page.locator("main:visible .bank-card").filter({ hasText: "এইচএসসি" }).click();
    await expect(page).toHaveURL(/\/class\/hsc$/);
    await fits(page, "subjects");
    await page.locator("main:visible .bank-card").filter({ hasText: "পদার্থবিজ্ঞান ১ম পত্র" }).click();
    await expect(page).toHaveURL(new RegExp(`/course/${UUID}$`));
    await fits(page, "chapters");
    await shot(page, "dashboard-bank-chapters-360");
    await page.locator("main:visible .ch-row").filter({ hasText: "নিউটনিয়ান বলবিদ্যা" }).click();
    await expect(page).toHaveURL(new RegExp(`/course/${UUID}/${UUID}$`));
    await fits(page, "questions");
    await shot(page, "dashboard-bank-section-360");
  });
});
