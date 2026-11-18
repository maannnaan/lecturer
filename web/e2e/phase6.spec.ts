import { type Page, expect, test } from "@playwright/test";

// Phase 6: live MCQ exams. Runs after phase5 on the same demo database: tanvir's first course
// (পদার্থবিজ্ঞান ১ম পত্র) has রাহিম উদ্দিন (01900000001 / student-password) in it; his bank's
// নিউটনিয়ান বলবিদ্যা chapter has MCQs, among them "…ত্বরণ কত হবে?" (right: খ, explained with
// "নিউটনের দ্বিতীয় সূত্র থেকে") and "…ঘাত বল কত?" (right: খ).

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

async function studentLogin(page: Page, phone: string, password: string) {
  await page.goto("/tanvir/login");
  await page.getByLabel("মোবাইল নম্বর").fill(phone);
  await page.getByLabel("পাসওয়ার্ড").fill(password);
  await page.getByRole("button", { name: "লগইন করো" }).click();
}

const field = (page: Page, label: string | RegExp) => page.getByLabel(label, { exact: true }).filter({ visible: true });
/** A moment as a date-and-time field takes it, in Bangladesh time, `minutes` from now. */
const dhaka = (minutes: number) => new Date(Date.now() + minutes * 60_000 + 6 * 3_600_000).toISOString().slice(0, 16);
const EXAM = "সাপ্তাহিক পরীক্ষা: বল ও গতি";
const SECRET = "নিউটনের দ্বিতীয় সূত্র থেকে";

test.describe.configure({ mode: "serial" });

let examPath = "";

test("the teacher sets an exam, picks its questions from the bank and publishes it", async ({ page }) => {
  await teacherLogin(page);
  await page.getByRole("complementary", { name: "মেনু" }).getByRole("link", { name: "লাইভ MCQ" }).click();
  await expect(page).toHaveURL(/\/dashboard\/exams$/);
  await page.getByRole("link", { name: "নতুন পরীক্ষা" }).first().click();

  // A close before the open is refused, in Bangla.
  await field(page, "পরীক্ষার নাম").fill(EXAM);
  await field(page, "কোর্স").selectOption({ label: "পদার্থবিজ্ঞান ১ম পত্র" });
  await field(page, "শুরু").fill(dhaka(-5));
  await field(page, "শেষ").fill(dhaka(-10));
  await page.getByRole("button", { name: "পরীক্ষা তৈরি করুন" }).click();
  await expect(page.locator("#endsAt-error")).toHaveText("শেষের তারিখ শুরুর তারিখের পরে হতে হবে");

  // Open now for an hour, ten minutes each, a quarter mark off for a wrong answer, results at once.
  await field(page, "শেষ").fill(dhaka(60));
  await field(page, "সময় (মিনিট)").fill("১০");
  await page.getByLabel("জমা দেওয়ার সাথে সাথে").check();
  await page.getByRole("button", { name: "পরীক্ষা তৈরি করুন" }).click();
  await expect(page).toHaveURL(/\/dashboard\/exams\/[0-9a-f-]{36}$/);
  examPath = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(EXAM);
  // Nothing to publish yet.
  await expect(page.getByRole("button", { name: "প্রকাশ করুন" })).toBeDisabled();

  // From the bank: নিউটনিয়ান বলবিদ্যা's MCQs; tick two, then one more at random.
  await field(page, "বিষয়").selectOption({ label: "পদার্থবিজ্ঞান ১ম পত্র" });
  await field(page, "অধ্যায়").selectOption({ label: "অধ্যায় ৪: নিউটনিয়ান বলবিদ্যা" });
  await page.getByRole("button", { name: "দেখান" }).click();
  const bank = page.getByRole("region", { name: "প্রশ্নব্যাংক থেকে যোগ করুন" });
  await bank.locator("label").filter({ hasText: "ত্বরণ কত হবে" }).getByRole("checkbox").check();
  await bank.locator("label").filter({ hasText: "ঘাত বল কত" }).getByRole("checkbox").check();
  await bank.getByRole("button", { name: "যোগ করুন", exact: true }).click();
  await expect(bank.getByRole("status")).toHaveText("২টি প্রশ্ন যোগ হয়েছে।");
  await expect(bank.locator("label").filter({ hasText: "ত্বরণ কত হবে" })).toContainText("পরীক্ষায় আছে");
  await bank.getByLabel("কয়টি").fill("1");
  await bank.getByRole("button", { name: "এলোমেলো যোগ করুন" }).click();
  await expect(bank.getByRole("status")).toHaveText("১টি প্রশ্ন যোগ হয়েছে।");
  await expect(page.getByRole("region", { name: "প্রশ্ন", exact: true }).getByRole("listitem")).toHaveCount(3);
  await shot(page, "dashboard-exam-1280");

  await page.getByRole("button", { name: "প্রকাশ করুন" }).click();
  await expect(page.getByRole("status").filter({ hasText: "প্রকাশিত: শিক্ষার্থীরা দেখতে পাচ্ছে।" })).toBeVisible();
});

test("a student in the course sits it: the answers never reach the page until the result does", async ({ page, request }) => {
  // Exams are behind a student's sign-in.
  const signedOut = await request.get("/tanvir/exams", { maxRedirects: 0 });
  expect(signedOut.status()).toBe(307);

  await studentLogin(page, "01900000001", "student-password");
  await expect(page).toHaveURL(/\/tanvir\/me$/);
  await page.getByRole("link", { name: "পরীক্ষা" }).click();
  const row = page.getByRole("listitem").filter({ hasText: EXAM });
  await expect(row).toContainText("চলছে");
  await expect(row).toContainText("৩টি প্রশ্ন · ১০ মিনিট");
  await row.getByRole("link").click();

  expect(await page.content()).not.toContain(SECRET);
  await page.getByRole("button", { name: "পরীক্ষা শুরু করো" }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByRole("timer")).toContainText(/[৯১০]:[০-৯]{2}|১০:০০/);
  // Sitting it: three questions to answer, and still no answers or explanations anywhere in the page.
  await expect(page.locator("ol > li.card")).toHaveCount(3);
  expect(await page.content()).not.toContain(SECRET);
  await shot(page, "site-exam-sitting-1280");

  // Right on the first, wrong on the second, the third left blank. Each pick is saved at once.
  const acceleration = page.locator("li.card").filter({ hasText: "ত্বরণ কত হবে" });
  await acceleration.getByRole("radio").nth(1).click();
  await expect(acceleration.getByText("উত্তর সংরক্ষিত")).toBeVisible();
  await expect(acceleration.getByRole("radio").nth(1)).toHaveAttribute("aria-checked", "true");
  const thrust = page.locator("li.card").filter({ hasText: "ঘাত বল কত" });
  await thrust.getByRole("radio").nth(0).click();
  await expect(thrust.getByText("উত্তর সংরক্ষিত")).toBeVisible();
  await expect(page.getByRole("timer")).toContainText("৩টির মধ্যে ২টির উত্তর দিয়েছ");

  // A reload keeps the answers and the time.
  await page.reload();
  await expect(page.locator("li.card").filter({ hasText: "ত্বরণ কত হবে" }).getByRole("radio").nth(1)).toHaveAttribute("aria-checked", "true");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "জমা দাও" }).click();

  // The result at once (as the teacher chose): 1 − 0.25 = 0.75 of 3, first place of the one who sat it.
  await expect(page.getByRole("region", { name: "তোমার নম্বর" })).toContainText("০.৭৫ / ৩");
  await expect(page.getByRole("region", { name: "তোমার নম্বর" })).toContainText("১ জনের মধ্যে ১ নম্বর স্থান");
  // Now the answers and explanations are shown, as the teacher allowed.
  await expect(page.getByText(SECRET)).toBeVisible();
  await shot(page, "site-exam-result-1280");

  // Handed in: it can't be started again, and the list shows the marks.
  await page.goto("/tanvir/exams");
  await expect(page.getByRole("listitem").filter({ hasText: EXAM })).toContainText("০.৭৫ / ৩");
});

test("someone not in the course can't see the exam at all", async ({ page }) => {
  // সাদিয়া was turned down for the course in phase4.
  await studentLogin(page, "01900000002", "student-password");
  await expect(page).toHaveURL(/\/tanvir\/me$/);
  await page.goto("/tanvir/exams");
  await expect(page.getByText(EXAM)).toHaveCount(0);
  await page.goto("/tanvir/exams/1");
  await expect(page.getByRole("heading", { name: "পাতাটি পাওয়া যায়নি" })).toBeVisible();
  expect(await page.content()).not.toContain(SECRET);
});

test("the teacher sees the merit list, who didn't sit it, and how each question went", async ({ page }) => {
  await teacherLogin(page);
  await page.goto(examPath);
  // Someone has started it: its questions can't change now.
  await expect(page.getByText("কেউ শুরু করেছে, তাই প্রশ্ন আর বদলানো যাবে না।", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "খসড়ায় ফেরান" })).toHaveCount(0);
  await page.getByRole("link", { name: "ফলাফল" }).click();
  await expect(page).toHaveURL(/\/results$/);

  const merit = page.getByRole("region", { name: "মেধাতালিকা" });
  await expect(merit.getByRole("row")).toHaveCount(2);
  await expect(merit.getByRole("row").nth(1)).toContainText("রাহিম উদ্দিন");
  await expect(merit.getByRole("row").nth(1)).toContainText("০.৭৫ / ৩");
  await expect(page.getByRole("region", { name: /^দেয়নি/ })).toContainText("নাফিসা রহমান");
  const byQuestion = page.getByRole("region", { name: "প্রশ্ন ধরে" });
  await expect(byQuestion.getByRole("listitem").filter({ hasText: "ত্বরণ কত হবে" })).toContainText("১ জনের মধ্যে ১ জন সঠিক");
  await expect(byQuestion.getByRole("listitem").filter({ hasText: "ঘাত বল কত" })).toContainText("১ জনের মধ্যে ০ জন সঠিক");
  await shot(page, "dashboard-exam-results-1280");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test("the exam pages fit a 360px screen", async ({ page }) => {
    await studentLogin(page, "01900000001", "student-password");
    await expect(page).toHaveURL(/\/tanvir\/me$/);
    await page.goto("/tanvir/exams");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - 360)).toBeLessThanOrEqual(0);
    await page.getByRole("listitem").filter({ hasText: EXAM }).getByRole("link").click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - 360)).toBeLessThanOrEqual(0);
    await shot(page, "site-exam-result-360");
    await page.context().clearCookies();
    await teacherLogin(page);
    for (const path of ["/dashboard/exams", "/dashboard/exams/new", examPath, `${examPath}/results`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - 360), path).toBeLessThanOrEqual(0);
    }
  });
});
