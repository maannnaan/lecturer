import { type Page, expect, test } from "@playwright/test";

// Phase 7: question papers. Runs after phase6 on the same demo database: tanvir's bank chapter
// নিউটনিয়ান বলবিদ্যা has four MCQs ("…ত্বরণ কত হবে?" and "…ঘাত বল কত?", both right at খ and
// the first explained with "নিউটনের দ্বিতীয় সূত্র থেকে", plus a বহুপদী and a private one) and
// one CQ ("…আনত একটি তলের উপর…").

const SHOTS = process.env.SHOTS_DIR;
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

async function teacherLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("মোবাইল নম্বর বা ইমেইল").fill("01710000001");
  await page.getByLabel("পাসওয়ার্ড").fill("teacher-password");
  await page.getByRole("button", { name: "লগইন করুন" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

const field = (page: Page, label: string | RegExp) => page.getByLabel(label, { exact: true }).filter({ visible: true });
const PAPER = "অর্ধবার্ষিক পরীক্ষা: বলবিদ্যা";
const SECRET = "নিউটনের দ্বিতীয় সূত্র থেকে";

test.describe.configure({ mode: "serial" });

let paperPath = "";

test("the teacher makes a three-set paper from the bank, with a written part, and makes it final", async ({ page }) => {
  await teacherLogin(page);
  await page.getByRole("complementary", { name: "মেনু" }).getByRole("link", { name: "প্রশ্নপত্র" }).click();
  await expect(page).toHaveURL(/\/dashboard\/papers$/);
  await page.getByRole("link", { name: "নতুন প্রশ্নপত্র" }).first().click();

  // The paper goes out under the teacher's name unless they say otherwise; no sets is refused.
  await expect(field(page, "প্রতিষ্ঠান বা কোচিংয়ের নাম (ঐচ্ছিক)")).toHaveValue("তানভীর আহমেদ");
  await field(page, "প্রশ্নপত্রের নাম").fill(PAPER);
  await field(page, "কোর্স").selectOption({ label: "পদার্থবিজ্ঞান ১ম পত্র" });
  await field(page, "কয়টি সেট").fill("০");
  await page.getByRole("button", { name: "প্রশ্নপত্র তৈরি করুন" }).click();
  await expect(page.locator("#setCount-error")).toHaveText("শুধু সংখ্যা লিখুন");

  await field(page, "কয়টি সেট").fill("৩");
  await field(page, "সময় (ঐচ্ছিক)").fill("৩০ মিনিট");
  await field(page, "প্রতি ভুল উত্তরে কাটা যাবে").fill("০.২৫");
  await page.getByRole("button", { name: "প্রশ্নপত্র তৈরি করুন" }).click();
  await expect(page).toHaveURL(/\/dashboard\/papers\/[0-9a-f-]{36}$/);
  paperPath = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(PAPER);
  await expect(page.getByRole("button", { name: "চূড়ান্ত করুন" })).toBeDisabled();

  // Two MCQs ticked, then the chapter's other two at random.
  const bank = page.getByRole("region", { name: "প্রশ্নব্যাংক থেকে যোগ করুন" });
  await bank.getByLabel("বিষয়", { exact: true }).selectOption({ label: "পদার্থবিজ্ঞান ১ম পত্র" });
  await bank.getByLabel("অধ্যায়", { exact: true }).selectOption({ label: "অধ্যায় ৪: নিউটনিয়ান বলবিদ্যা" });
  await bank.getByRole("button", { name: "দেখান" }).click();
  await bank.locator("label").filter({ hasText: "ত্বরণ কত হবে" }).getByRole("checkbox").check();
  await bank.locator("label").filter({ hasText: "ঘাত বল কত" }).getByRole("checkbox").check();
  await bank.getByRole("button", { name: "যোগ করুন", exact: true }).click();
  await expect(bank.getByRole("status")).toHaveText("২টি প্রশ্ন যোগ হয়েছে।");
  await bank.getByLabel("কয়টি").fill("2");
  await bank.getByRole("button", { name: "এলোমেলো যোগ করুন" }).click();
  await expect(bank.getByRole("status")).toHaveText("২টি প্রশ্ন যোগ হয়েছে।");
  await expect(page.getByRole("region", { name: "MCQ", exact: true }).getByRole("listitem")).toHaveCount(4);

  // The CQ goes to the written part.
  await bank.getByLabel("প্রশ্নের ধরন").selectOption({ label: "CQ" });
  await bank.getByRole("button", { name: "দেখান" }).click();
  await bank.locator("label").filter({ hasText: "আনত একটি তলের উপর" }).getByRole("checkbox").check();
  await bank.getByRole("button", { name: "যোগ করুন", exact: true }).click();
  await expect(bank.getByRole("status")).toHaveText("১টি প্রশ্ন যোগ হয়েছে।");
  await expect(page.getByRole("region", { name: "লিখিত অংশ" }).getByRole("listitem")).toHaveCount(1);
  await shot(page, "dashboard-paper-1280");

  await page.getByRole("button", { name: "চূড়ান্ত করুন" }).click();
  await expect(page.getByRole("status").filter({ hasText: "চূড়ান্ত: প্রশ্ন, সেট আর উত্তরমালা আর বদলাবে না।" })).toBeVisible();
  // Final: no more adding from the bank.
  await expect(page.getByRole("region", { name: "প্রশ্নব্যাংক থেকে যোগ করুন" })).toHaveCount(0);
});

test("its sets print one after another, each with its code, the first in the teacher's order, and no answers", async ({ page }) => {
  await teacherLogin(page);
  await page.goto(paperPath);
  await page.getByRole("link", { name: "সেট ১০১–১০৩" }).click();
  await expect(page).toHaveURL(/\/print\?sets=101-103$/);
  const sheets = page.locator("article.paper-sheet");
  await expect(sheets).toHaveCount(3);
  for (const [i, code] of ["১০১", "১০২", "১০৩"].entries()) {
    await expect(sheets.nth(i).locator(".paper-set")).toHaveText(`সেট কোড: ${code}`);
    await expect(sheets.nth(i).locator(".paper-cols").first().locator("> li")).toHaveCount(4);
  }
  const first = sheets.first();
  // The course's name stands in for the subject left empty; the time and marking are as set.
  await expect(first.locator(".paper-sub")).toHaveText("পদার্থবিজ্ঞান ১ম পত্র");
  await expect(first).toContainText("সময়: ৩০ মিনিট");
  await expect(first).toContainText("প্রতিটি ভুল উত্তরের জন্য ০.২৫ নম্বর কাটা যাবে।");
  await expect(first.locator(".paper-cols").first().locator("> li").first()).toContainText("ত্বরণ কত হবে");
  await expect(first.getByRole("heading", { name: "লিখিত প্রশ্ন" })).toBeVisible();
  // A question paper never carries the answers.
  expect(await page.content()).not.toContain(SECRET);
  await shot(page, "dashboard-paper-print-1280");
});

test("each set has its own answer key", async ({ page }) => {
  await teacherLogin(page);
  await page.goto(`${paperPath}/key`);
  for (const code of ["১০১", "১০২", "১০৩"]) await expect(page.getByRole("heading", { name: `সেট ${code}` })).toBeVisible();
  // The first set is the teacher's order: both ticked questions are right at খ.
  const first = page.getByRole("region", { name: "সেট ১০১" }).getByRole("listitem");
  await expect(first).toHaveCount(4);
  await expect(first.nth(0)).toHaveText("১.খ");
  await expect(first.nth(1)).toHaveText("২.খ");
  await shot(page, "dashboard-paper-key-1280");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test("the paper pages fit a 360px screen", async ({ page }) => {
    await teacherLogin(page);
    for (const path of ["/dashboard/papers", "/dashboard/papers/new", paperPath, `${paperPath}/print?sets=102`, `${paperPath}/key`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - 360), path).toBeLessThanOrEqual(0);
    }
    await shot(page, "dashboard-paper-key-360");
  });
});
