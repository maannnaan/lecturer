import { type Page, expect, test } from "@playwright/test";

// Phase 3: the question bank and chapter pages. Runs after phase1/phase2 on the same demo
// database: tanvir's course 1 (পদার্থবিজ্ঞান ১ম পত্র) has questions in chapters 3 and 4.

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

/**
 * A form field by its exact label, on the page in view. Next keeps pages you navigated away from
 * mounted but hidden (for instant Back), so the same label can exist twice in the document.
 */
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });

const CHAPTER_4 = "/tanvir/courses/1/chapters/4";
const PRIVATE_STEM = "কোনটি নিউটনের তৃতীয় সূত্রের উদাহরণ?";

test.describe.configure({ mode: "serial" });

let editUrl = "";

test("a chapter page shows its public questions, typeset, and MCQ practice works", async ({ page }) => {
  await page.goto("/tanvir/courses/1");
  await page.getByRole("link", { name: "নিউটনিয়ান বলবিদ্যা", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${CHAPTER_4}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("নিউটনিয়ান বলবিদ্যা");
  await expect(page.locator(".ch-stats")).toContainText("৬টি প্রশ্ন");
  await expect(page.locator(".q-card .katex").first()).toBeVisible();

  const first = page.locator(".q-card").first();
  await first.getByRole("button", { name: /খ/ }).click();
  await expect(first.locator(".opt.correct")).toContainText("তোমার উত্তর সঠিক");
  await expect(first.locator(".explain")).toContainText("নিউটনের দ্বিতীয় সূত্র");

  const second = page.locator(".q-card").nth(1);
  await second.getByRole("button", { name: /গ/ }).click();
  await expect(second.locator(".opt.wrong")).toContainText("তোমার উত্তর");
  await expect(second.locator(".opt.correct")).toContainText("সঠিক উত্তর");
  await second.getByRole("button", { name: "আবার চেষ্টা করো" }).click();
  await expect(second.locator(".opt.wrong")).toHaveCount(0);
  await shot(page, "site-chapter-ink-1280");

  await page.getByRole("link", { name: /সৃজনশীল/ }).click();
  await expect(page).toHaveURL(/tab=creative/);
  await expect(page.getByText("সুতরাং গতীয় ঘর্ষণ বল")).toBeHidden();
  await page.getByText("সমাধান দেখো").first().click();
  await expect(page.getByText("সুতরাং গতীয় ঘর্ষণ বল")).toBeVisible();

  await page.getByRole("link", { name: /বোর্ড প্রশ্ন/ }).click();
  await expect(page.locator(".q-card")).toHaveCount(4);
  await page.getByLabel("সাল:").selectOption({ label: "২০২৪" });
  await page.getByRole("button", { name: "দেখাও" }).click();
  await expect(page.locator(".q-card")).toHaveCount(1);
  await expect(page.locator(".q-card .tag.board")).toContainText("চট্টগ্রাম বোর্ড ২০২৪");
});

test("private questions never reach the website", async ({ request }) => {
  for (const tab of ["mcq", "short", "creative", "problem", "board"]) {
    const html = await (await request.get(`${CHAPTER_4}?tab=${tab}`)).text();
    expect(html, tab).not.toContain(PRIVATE_STEM);
  }
});

test("chapter addresses that don't exist are real 404s", async ({ request }) => {
  const missing = await request.get("/tanvir/courses/1/chapters/99");
  expect(missing.status()).toBe(404);
  // The app's own page, not a bare error: same look, a way back.
  expect(await missing.text()).toContain("পাতাটি পাওয়া যায়নি");
  expect((await request.get("/no-such-teacher-xyz")).status()).toBe(404);
  expect((await request.get("/tanvir/courses/1/chapters/abc")).status()).toBe(404);
  expect((await request.get("/tanvir/courses/999/chapters/1")).status()).toBe(404);
  expect((await request.get("/tanvir/courses/1/lessons/1")).status()).toBe(404);
});

test("a teacher writes an MCQ with maths, fixes a mistake, and adds the next", async ({ page, request }) => {
  await login(page, "01710000001");
  await page.getByRole("link", { name: "প্রশ্নব্যাংক" }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/bank$/);
  await expect(page.getByRole("status")).toContainText("টি প্রশ্ন");
  await page.getByRole("link", { name: "নতুন প্রশ্ন" }).click();
  await expect(page.getByRole("heading", { name: "কোন ধরনের প্রশ্ন লিখবেন?" })).toBeVisible();
  // Next keeps the previous page mounted (hidden) for instant Back, so only count what's visible.
  await expect(page.locator("main ul li:visible")).toHaveCount(5);
  await page.locator("main ul li:visible").first().getByRole("link").click();
  await expect(page).toHaveURL(/type=mcq/);

  await field(page, "কোর্স").selectOption({ label: "পদার্থবিজ্ঞান ১ম পত্র" });
  await field(page, "অধ্যায়").selectOption({ label: "অধ্যায় ৫: কাজ, শক্তি ও ক্ষমতা" });
  await field(page, "প্রশ্ন").fill("$W = Fs\\cos\\theta$ সূত্রে $\\theta = 90^\\circ$ হলে কাজ কত?");
  await expect(page.locator(".q-card:visible .katex").first()).toBeVisible();
  for (const [key, text] of [["ক", "শূন্য"], ["খ", "$Fs$"], ["গ", "$-Fs$"], ["ঘ", "$Fs/2$"]]) {
    await field(page, `অপশন ${key}`).fill(text);
  }
  await page.getByRole("button", { name: "প্রশ্ন যোগ করুন" }).click();
  await expect(page.locator("#answer-error:visible")).toHaveText("সঠিক উত্তরটি বেছে দিন");
  await expect(field(page, "প্রশ্ন")).toHaveValue(/হলে কাজ কত\?/);

  await field(page, "সঠিক: ক").check();
  await field(page, "বোর্ড").selectOption({ label: "বরিশাল বোর্ড" });
  await field(page, "সাল").fill("২০২৫");
  await shot(page, "dashboard-question-new-ink-1280");
  await page.getByRole("button", { name: "যোগ করে পরেরটি লিখুন" }).click();
  await expect(page).toHaveURL(/\/dashboard\/bank\/new\?.*added=/);
  await expect(page.getByRole("status").first()).toHaveText("প্রশ্নটি যোগ হয়েছে। এবার পরেরটি লিখুন।");
  await expect(field(page, "প্রশ্ন")).toHaveValue("");
  await expect(field(page, "অধ্যায়")).toHaveValue(/.+/);

  const chapter5 = await (await request.get("/tanvir/courses/1/chapters/5")).text();
  expect(chapter5).toContain("হলে কাজ কত?");
  expect(chapter5).toContain("বরিশাল বোর্ড ২০২৫");
});

test("a private creative question with a diagram stays in the bank", async ({ page, request }) => {
  await login(page, "01710000001");
  await page.goto("/dashboard/bank/new?type=creative");
  await field(page, "কোর্স").selectOption({ label: "পদার্থবিজ্ঞান ১ম পত্র" });
  await field(page, "অধ্যায়").selectOption({ label: "অধ্যায় ১: ভৌতজগৎ ও পরিমাপ" });
  await field(page, "উদ্দীপক").fill("একটি স্প্রিংয়ের স্প্রিং ধ্রুবক $k = 200\\,\\text{N m}^{-1}$।");
  for (const [key, text] of [["ক", "হুকের সূত্রটি লিখ।"], ["খ", "স্প্রিং কেন আদি অবস্থায় ফেরে?"], ["গ", "সঞ্চিত শক্তি নির্ণয় কর।"], ["ঘ", "দোলনকাল বিশ্লেষণ কর।"]]) {
    await field(page, `অংশ ${key}`).fill(text);
  }

  const diagram = await page.context().newPage();
  await diagram.setContent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160"><rect width="320" height="160" fill="#fff"/><path d="M20 80 h40 l10 -20 l20 40 l20 -40 l20 40 l20 -40 l10 20 h40" stroke="#1c5d5b" stroke-width="4" fill="none"/><rect x="200" y="55" width="60" height="50" fill="#b0822f"/></svg>',
  );
  const png = await diagram.locator("svg").screenshot();
  await diagram.close();
  await page.locator("#question-image").setInputFiles({ name: "spring.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("button", { name: "ছবি সরান" })).toBeVisible();
  await expect(page.locator(".q-card img.q-figure")).toBeVisible();

  await field(page, "শুধু আপনি: পরীক্ষা আর প্রশ্নপত্রের জন্য রাখা").check();
  await page.getByRole("button", { name: "প্রশ্ন যোগ করুন" }).click();
  await expect(page).toHaveURL(/\/dashboard\/bank\?course=/);
  const item = page.locator("main li:visible").filter({ hasText: "স্প্রিং ধ্রুবক" });
  await expect(item.getByText("শুধু আপনি")).toBeVisible();
  editUrl = (await item.getByRole("link", { name: "সম্পাদনা" }).getAttribute("href")) ?? "";
  expect(editUrl).toMatch(/^\/dashboard\/bank\/[0-9a-f-]{36}$/);

  const site = await (await request.get("/tanvir/courses/1/chapters/1?tab=creative")).text();
  expect(site).not.toContain("স্প্রিং ধ্রুবক");
});

test("a question is edited, then deleted", async ({ page }) => {
  await login(page, "01710000001");
  await page.goto(editUrl);
  await expect(page.locator("img.q-figure").first()).toBeVisible();
  await field(page, "অংশ ক").fill("হুকের সূত্রটি বিবৃত কর।");
  await page.getByRole("button", { name: "সংরক্ষণ করুন" }).click();
  await expect(page.getByRole("status").filter({ hasText: "সংরক্ষিত হয়েছে" })).toBeVisible();
  await page.reload();
  await expect(field(page, "অংশ ক")).toHaveValue("হুকের সূত্রটি বিবৃত কর।");

  await page.getByRole("button", { name: "মুছে ফেলুন" }).click();
  await expect(page.getByText("মুছে ফেলার আগে নিশ্চিত করার ঘরে টিক দিন")).toBeVisible();
  await field(page, "হ্যাঁ, প্রশ্নটি মুছে ফেলতে চাই").check();
  await page.getByRole("button", { name: "মুছে ফেলুন" }).click();
  await expect(page).toHaveURL(/\/dashboard\/bank\?course=/);
  await expect(page.locator("main:visible").getByText("স্প্রিং ধ্রুবক")).toHaveCount(0);
});

test("another teacher can't open a question's editor", async ({ page }) => {
  await login(page, "01710000001");
  await page.goto("/dashboard/bank?course=");
  const href = await page.locator("main li:visible").first().getByRole("link", { name: "সম্পাদনা" }).getAttribute("href");
  // /login sends a signed-in teacher to the dashboard, so start the second teacher fresh.
  await page.context().clearCookies();
  await login(page, "01710000002");
  await page.goto(href!);
  await expect(page.getByRole("heading", { name: "পাতাটি পাওয়া যায়নি" })).toBeVisible();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test("chapter pages and the bank fit a 360px screen, and the menu reaches every section", async ({ page }) => {
    for (const path of [CHAPTER_4, `${CHAPTER_4}?tab=creative`, "/tanvir/courses/1/chapters/3"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - 360), path).toBeLessThanOrEqual(0);
    }
    await page.goto(CHAPTER_4);
    await shot(page, "site-chapter-ink-360");

    await login(page, "01710000001");
    for (const path of ["/dashboard/bank", "/dashboard/bank/new", "/dashboard/bank/new?type=creative", "/dashboard/bank/new?type=mcq_multi"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - 360), path).toBeLessThanOrEqual(0);
      const repeated = await page.evaluate(() => {
        const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
        return ids.filter((id, i) => ids.indexOf(id) !== i);
      });
      expect(repeated, path).toEqual([]);
    }
    await page.goto("/dashboard/bank/new?type=mcq");
    await shot(page, "dashboard-question-new-ink-360");

    await page.getByRole("button", { name: "মেনু" }).or(page.locator(".dash-menu > summary")).first().click();
    await page.locator(".dash-menu-panel").getByRole("link", { name: "নোটিশ" }).click();
    await expect(page).toHaveURL(/\/dashboard\/notices$/);
    await expect(page.locator(".dash-menu-panel")).toBeHidden();
  });
});
