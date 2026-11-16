import { type Page, expect, test } from "@playwright/test";

// Phase 5: payments. Runs after phase4 on the same demo database: tanvir takes bKash on
// 01700000000; his first course (পদার্থবিজ্ঞান ১ম পত্র) is ৳1,200 a month; রাহিম উদ্দিন (roll 1,
// 01900000001 / student-password) is in it and has paid nothing yet.

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

const field = (page: Page, label: string | RegExp) => page.getByLabel(label, { exact: true }).filter({ visible: true });
const menu = (page: Page) => page.getByRole("complementary", { name: "মেনু" });
/** This month and the next, as the pages write them in Bangla ("নভেম্বর ২০২৬"). */
const monthName = (offset = 0) => {
  const now = new Date(Date.now() + 6 * 3_600_000);
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  return new Intl.DateTimeFormat("bn-BD", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
};

test.describe.configure({ mode: "serial" });

test("a student sees what they owe, sends the money and reports its TxnID", async ({ page, request }) => {
  // Paying is behind the student's sign-in, like the rest of their page.
  const signedOut = await request.get("/tanvir/me/pay", { maxRedirects: 0 });
  expect(signedOut.status()).toBe(307);
  expect((await request.get("/tanvir/me/nothing-here", { maxRedirects: 0 })).status()).toBe(404);

  await rahimLogin(page);
  const course = page.getByRole("listitem").filter({ hasText: "পদার্থবিজ্ঞান ১ম পত্র" }).first();
  await expect(course).toContainText("বকেয়া ৳ ১,২০০");
  await course.getByRole("link", { name: "পেমেন্ট করো" }).click();
  await expect(page).toHaveURL(/\/tanvir\/me\/pay\?e=/);

  // Where to send it, and this month already ticked, with its total.
  await expect(page.getByRole("region", { name: "যেখানে টাকা পাঠাবে" })).toContainText("01700000000");
  await expect(page.getByRole("checkbox", { name: new RegExp(monthName()) })).toBeChecked();
  await expect(page.getByRole("status").filter({ hasText: "মোট" })).toContainText("৳ ১,২০০");
  // A month ahead too: the total follows.
  await page.getByRole("checkbox", { name: new RegExp(monthName(1)) }).check();
  await expect(page.getByRole("status").filter({ hasText: "মোট" })).toContainText("৳ ২,৪০০");
  await shot(page, "site-pay-1280");

  // Without a TxnID there is nothing to check against.
  await page.getByRole("button", { name: "পেমেন্ট জানাও" }).click();
  await expect(page.locator("#txnId-error")).toHaveText("এটি পূরণ করুন");
  await field(page, "TxnID").fill("9hk4 t2xq");
  await field(page, /^যে নম্বর থেকে পাঠিয়েছ/).fill("01900000001");
  await page.getByRole("button", { name: "পেমেন্ট জানাও" }).click();

  await expect(page).toHaveURL(/\/tanvir\/me\?paid=1$/);
  await expect(page.getByRole("status").filter({ hasText: "পেমেন্টের তথ্য জমা হয়েছে।" })).toBeVisible();
  const mine = page.getByRole("region", { name: "আমার পেমেন্ট" }).getByRole("listitem");
  await expect(mine).toHaveCount(1);
  await expect(mine).toContainText("9HK4T2XQ");
  await expect(mine).toContainText("৳ ২,৪০০");
  await expect(mine).toContainText("যাচাই বাকি");
  // While it waits, those months aren't asked for again.
  await expect(page.getByRole("listitem").filter({ hasText: "পদার্থবিজ্ঞান ১ম পত্র" }).first()).toContainText("কোনো বকেয়া নেই");
});

test("the teacher verifies the claim, and takes cash from another student with a receipt", async ({ page }) => {
  await teacherLogin(page);
  const link = menu(page).getByRole("link", { name: /পেমেন্ট ও বকেয়া/ });
  await expect(link).toContainText("১");
  await link.click();
  // Claims to check open first.
  await expect(page.getByRole("navigation", { name: "পেমেন্ট ও বকেয়া" }).locator('[aria-current="page"]')).toContainText("যাচাই বাকি");
  const claim = page.getByRole("main").getByRole("listitem").filter({ hasText: "রাহিম উদ্দিন" });
  await expect(claim).toContainText("9HK4T2XQ");
  await expect(claim).toContainText("৳ ২,৪০০");
  await expect(claim).toContainText("বিকাশ");
  await shot(page, "dashboard-payments-verify-1280");
  await claim.getByRole("button", { name: "যাচাই করুন" }).click();
  // Nothing left to check: the count goes, and the page moves on to the dues.
  await expect(page.getByRole("button", { name: "যাচাই করুন" })).toHaveCount(0);
  await expect(menu(page).getByRole("link", { name: /পেমেন্ট ও বকেয়া/ })).not.toContainText(/[০-৯]/);
  await page.goto("/dashboard/payments?tab=verify");
  await expect(page.getByText("যাচাইয়ের জন্য কোনো পেমেন্ট অপেক্ষায় নেই।")).toBeVisible();

  // Dues: নাফিসা (roll 2) hasn't paid this month. Cash from her, with a discount.
  await page.getByRole("navigation", { name: "পেমেন্ট ও বকেয়া" }).getByRole("link", { name: "বকেয়া" }).click();
  const due = page.getByRole("main").getByRole("listitem").filter({ hasText: "নাফিসা রহমান" });
  await expect(due).toContainText("৳ ১,২০০");
  await expect(page.getByRole("main").getByRole("listitem").filter({ hasText: "রাহিম উদ্দিন" })).toHaveCount(0);
  await shot(page, "dashboard-payments-dues-1280");
  await due.getByRole("link", { name: "পেমেন্ট নিন" }).click();
  await expect(page).toHaveURL(/\/dashboard\/payments\/new\?e=/);
  await expect(page.getByRole("checkbox", { name: new RegExp(monthName()) })).toBeChecked();
  await expect(field(page, "টাকার পরিমাণ")).toHaveValue("1200");
  await field(page, "টাকার পরিমাণ").fill("১০০০");
  await page.getByRole("button", { name: "পেমেন্ট সংরক্ষণ করুন" }).click();

  // Its receipt opens: numbered after the one just verified.
  await expect(page).toHaveURL(/\/dashboard\/payments\/[0-9a-f-]{36}$/);
  const receipt = page.getByRole("article");
  await expect(receipt).toContainText("রসিদ নং ২");
  await expect(receipt).toContainText("নাফিসা রহমান");
  await expect(receipt).toContainText("৳ ১,০০০");
  await expect(receipt).toContainText("নগদ টাকা");
  await shot(page, "dashboard-receipt-1280");

  // Both are in the list, with this month's collection; nobody owes anything now.
  await page.goto("/dashboard/payments?tab=all");
  await expect(page.getByText(`${monthName()}: আদায় ৳ ৩,৪০০`)).toBeVisible();
  await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(2);
  await page.goto("/dashboard/payments?tab=dues");
  await expect(page.getByRole("main").getByRole("listitem").filter({ hasText: "নাফিসা রহমান" })).toHaveCount(0);
  // The overview carries the same numbers.
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /এ মাসের আদায়/ })).toContainText("৳ ৩,৪০০");
});

test("the student gets a receipt; a payment cancelled by the teacher is owed again", async ({ page, browser }) => {
  await rahimLogin(page);
  const mine = page.getByRole("region", { name: "আমার পেমেন্ট" }).getByRole("listitem");
  await mine.getByRole("link", { name: "রসিদ" }).click();
  await expect(page).toHaveURL(/\/tanvir\/me\/receipt\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("article")).toContainText("রসিদ নং ১");
  await expect(page.getByRole("article")).toContainText("৳ ২,৪০০");
  const receiptUrl = page.url();

  // Another student can't open it, signed in or not.
  const other = await browser.newContext();
  const theirs = await other.newPage();
  await theirs.goto("/tanvir/login");
  await theirs.getByLabel("মোবাইল নম্বর").fill("01911111111");
  await theirs.getByLabel("পাসওয়ার্ড").fill("nafisa-new-pass");
  await theirs.getByRole("button", { name: "লগইন করো" }).click();
  await expect(theirs).toHaveURL(/\/tanvir\/me$/);
  // (A page that has begun to stream answers 200 either way: what matters is what it shows.)
  await theirs.goto(receiptUrl);
  await expect(theirs.getByRole("heading", { name: "পাতাটি পাওয়া যায়নি" })).toBeVisible();
  await expect(theirs.getByRole("article")).toHaveCount(0);
  const leaked = await (await theirs.request.get(receiptUrl)).text();
  expect(leaked).not.toContain("9HK4T2XQ");
  expect(leaked).not.toContain("রাহিম উদ্দিন");
  // Her cash payment shows on her own page, with its receipt.
  await theirs.goto("/tanvir/me");
  await expect(theirs.getByRole("region", { name: "আমার পেমেন্ট" }).getByRole("listitem")).toContainText("৳ ১,০০০");
  await other.close();

  // The teacher cancels রাহিম's payment (the money never came after all): he owes it again, and is told why.
  const admin = await browser.newContext();
  const dash = await admin.newPage();
  await teacherLogin(dash);
  await dash.goto("/dashboard/payments?tab=all");
  await dash.getByRole("main").getByRole("listitem").filter({ hasText: "রাহিম উদ্দিন" }).getByRole("link").click();
  await dash.getByLabel("কারণ (শিক্ষার্থী দেখবে)").fill("টাকা ফেরত গেছে");
  await dash.getByRole("button", { name: "পেমেন্ট বাতিল করুন" }).click();
  await expect(dash).toHaveURL(/\/dashboard\/payments\?tab=all$/);
  await expect(dash.getByRole("main").getByRole("listitem").filter({ hasText: "রাহিম উদ্দিন" })).toContainText("বাতিল");
  await admin.close();

  await page.goto("/tanvir/me");
  await expect(page.getByRole("listitem").filter({ hasText: "পদার্থবিজ্ঞান ১ম পত্র" }).first()).toContainText("বকেয়া ৳ ১,২০০");
  await expect(page.getByRole("region", { name: "আমার পেমেন্ট" }).getByRole("listitem")).toContainText("কারণ: টাকা ফেরত গেছে");
  // A cancelled payment has no receipt any more.
  await page.goto(receiptUrl);
  await expect(page.getByRole("heading", { name: "পাতাটি পাওয়া যায়নি" })).toBeVisible();
});

test("the teacher sets where students send money; with no number they can't report a payment", async ({ page, browser }) => {
  await teacherLogin(page);
  await page.goto("/dashboard/payments");
  await page.getByRole("link", { name: "পেমেন্টের নম্বর" }).click();
  await expect(field(page, /^বিকাশ নম্বর/)).toHaveValue("01700000000");
  await field(page, /^বিকাশ নম্বর/).fill("12345");
  await page.getByRole("button", { name: "সংরক্ষণ করুন" }).click();
  await expect(page.locator("#bkash-error")).toHaveText("সঠিক মোবাইল নম্বর দিন, যেমন 01712345678");
  await field(page, /^বিকাশ নম্বর/).fill("");
  await page.getByRole("button", { name: "সংরক্ষণ করুন" }).click();
  await expect(page.getByRole("status").filter({ hasText: "সংরক্ষিত হয়েছে" })).toBeVisible();

  const visitor = await browser.newContext();
  const theirs = await visitor.newPage();
  await rahimLogin(theirs);
  await theirs.goto("/tanvir/me/pay");
  await expect(theirs.getByText("শিক্ষক এখনো অনলাইনে পেমেন্ট নেওয়ার নম্বর দেননি।", { exact: false })).toBeVisible();
  await visitor.close();

  // Put back, with Nagad as well: both are offered.
  await field(page, /^বিকাশ নম্বর/).fill("01700000000");
  await field(page, /^নগদ \(Nagad\) নম্বর/).fill("01800000000");
  await page.getByRole("button", { name: "সংরক্ষণ করুন" }).click();
  await expect(page.getByRole("status").filter({ hasText: "সংরক্ষিত হয়েছে" })).toBeVisible();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test("the payment pages fit a 360px screen", async ({ page }) => {
    await rahimLogin(page);
    for (const path of ["/tanvir/me", "/tanvir/me/pay"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - 360), path).toBeLessThanOrEqual(0);
    }
    await shot(page, "site-pay-360");
    await page.context().clearCookies();
    await teacherLogin(page);
    for (const path of ["/dashboard", "/dashboard/payments?tab=all", "/dashboard/payments?tab=dues", "/dashboard/payments/new", "/dashboard/payments/settings"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - 360), path).toBeLessThanOrEqual(0);
    }
  });
});
