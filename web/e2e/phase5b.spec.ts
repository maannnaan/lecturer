import { type Page, expect, test } from "@playwright/test";

// Phase 5b: paying through the teacher's own bKash account. Runs after phase5 on the same demo
// database (রাহিম উদ্দিন owes this month's ৳1,200 for পদার্থবিজ্ঞান ১ম পত্র), against the stand-in
// bKash that e2e/server.mjs starts: it knows demo-merchant / demo-password, app key demo-app-key,
// app secret demo-app-secret, and its checkout page has a "Pay" and a "Cancel" link.

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

async function rahimLogin(page: Page) {
  await page.goto("/tanvir/login");
  await page.getByLabel("মোবাইল নম্বর").fill("01900000001");
  await page.getByLabel("পাসওয়ার্ড").fill("student-password");
  await page.getByRole("button", { name: "লগইন করো" }).click();
  await expect(page).toHaveURL(/\/tanvir\/me$/);
}

const SAVE = "সংরক্ষণ করে বিকাশের সাথে মিলিয়ে দেখুন";

test.describe.configure({ mode: "serial" });

test("the teacher adds their bKash merchant account; bKash's refusal is shown in its own words", async ({ page }) => {
  await teacherLogin(page);
  await page.goto("/dashboard/payments/settings");
  const gateway = page.getByRole("region", { name: "বিকাশ পেমেন্ট গেটওয়ে" });
  await expect(gateway.getByRole("status").first()).toHaveText("যোগ করা হয়নি: শিক্ষার্থীরা নম্বরে টাকা পাঠিয়ে TxnID জানায়।");

  await gateway.getByLabel("ইউজারনেম").fill("demo-merchant");
  await gateway.getByLabel("পাসওয়ার্ড").fill("not-the-password");
  await gateway.getByLabel("অ্যাপ কী (App key)").fill("demo-app-key");
  await gateway.getByLabel("অ্যাপ সিক্রেট (App secret)").fill("demo-app-secret");
  await gateway.getByRole("button", { name: SAVE }).click();
  await expect(gateway.getByRole("alert")).toHaveText("বিকাশ অ্যাকাউন্টটি মেনে নেয়নি: Invalid or unrecognized access credentials");
  // The secrets are never sent back to the page, not even refused ones.
  await expect(gateway.getByLabel("পাসওয়ার্ড")).toHaveValue("");
  await expect(gateway.getByLabel("অ্যাপ সিক্রেট (App secret)")).toHaveValue("");
  await expect(gateway.getByLabel("ইউজারনেম")).toHaveValue("demo-merchant");

  // The right password; the app secret left empty keeps the saved one.
  await gateway.getByLabel("পাসওয়ার্ড").fill("demo-password");
  await gateway.getByRole("button", { name: SAVE }).click();
  await expect(gateway.getByRole("status").filter({ hasText: "চালু আছে" })).toBeVisible();
  await expect(gateway.getByLabel("পাসওয়ার্ড")).toHaveAttribute("placeholder", "সংরক্ষিত আছে; বদলাতে চাইলে নতুনটি লিখুন");
  await shot(page, "dashboard-gateway-1280");
});

test("a student pays through bKash: cancelling takes nothing, paying gives the receipt at once", async ({ page }) => {
  await rahimLogin(page);
  await page.goto("/tanvir/me/pay");
  const bkash = page.getByRole("region", { name: "বিকাশে পেমেন্ট" });
  await expect(bkash).toBeVisible();
  await shot(page, "site-pay-bkash-1280");

  // To bKash's page and back, cancelled: nothing taken, and the month is still to pay.
  await bkash.getByRole("button", { name: "বিকাশে পেমেন্ট করো" }).click();
  await expect(page).toHaveURL(/localhost:3125\/checkout\?paymentId=/);
  await expect(page.getByText("BDT 1200.00")).toBeVisible();
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/tanvir\/me\/pay\?e=[0-9a-f-]+&bkash=cancelled$/);
  // (Next.js keeps an alert of its own on every page, for announcing route changes.)
  await expect(page.getByRole("alert").filter({ hasText: "বিকাশে পেমেন্ট" })).toHaveText("বিকাশে পেমেন্ট বাতিল করেছ। কোনো টাকা কাটা হয়নি।");

  // Again, paid this time: back on their page, the receipt there, nothing owed.
  await page.getByRole("region", { name: "বিকাশে পেমেন্ট" }).getByRole("button", { name: "বিকাশে পেমেন্ট করো" }).click();
  await expect(page).toHaveURL(/localhost:3125\/checkout/);
  await page.getByRole("link", { name: "Pay" }).click();
  await expect(page).toHaveURL(/\/tanvir\/me\?paid=bkash$/);
  await expect(page.getByRole("status").filter({ hasText: "বিকাশে পেমেন্ট হয়েছে। রসিদ নিচে।" })).toBeVisible();
  const latest = page.getByRole("region", { name: "আমার পেমেন্ট" }).getByRole("listitem").first();
  await expect(latest).toContainText("বিকাশ (স্বয়ংক্রিয়)");
  await expect(latest).toContainText("E2E");
  await expect(latest.getByRole("link", { name: "রসিদ" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "পদার্থবিজ্ঞান ১ম পত্র" }).first()).toContainText("কোনো বকেয়া নেই");
});

test("the teacher sees it among the payments, verified, with nothing left to check", async ({ page }) => {
  await teacherLogin(page);
  await page.goto("/dashboard/payments?tab=all");
  await expect(page.getByRole("listitem").filter({ hasText: "বিকাশ (স্বয়ংক্রিয়)" }).first()).toContainText("রাহিম উদ্দিন");
  // Neither the cancelled try nor the paid one waits for the teacher.
  await page.goto("/dashboard/payments?tab=verify");
  await expect(page.getByText("বিকাশ পেমেন্টটি বিকাশ নিশ্চিত করেনি", { exact: false })).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test("paying through bKash fits a 360px screen", async ({ page }) => {
    await rahimLogin(page);
    await page.goto("/tanvir/me/pay");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - 360)).toBeLessThanOrEqual(0);
    await page.context().clearCookies();
    await teacherLogin(page);
    await page.goto("/dashboard/payments/settings");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - 360)).toBeLessThanOrEqual(0);
    await shot(page, "dashboard-gateway-360");
  });
});
