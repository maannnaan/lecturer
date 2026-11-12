import { type Page, expect, test } from "@playwright/test";

// Phase 3f: sub-chapters. Runs after phase3e on the same demo database: tanvir's HSC পদার্থবিজ্ঞান
// ১ম পত্র (class 1, subject 1), chapter 4 (নিউটনিয়ান বলবিদ্যা), has the sub-chapters ৪.১ নিউটনের
// গতিসূত্র ও বল, ৪.২ ভরবেগ ও বলের ঘাত and ৪.৩ ঘর্ষণ. Its public MCQs: one in ৪.১, two in ৪.২.

const CHAPTER = "/tanvir/bank/1/1/4";
const UUID = "[0-9a-f-]{36}";

async function login(page: Page, phone: string) {
  await page.goto("/login");
  await page.getByLabel("মোবাইল নম্বর বা ইমেইল").fill(phone);
  await page.getByLabel("পাসওয়ার্ড").fill("teacher-password");
  await page.getByRole("button", { name: "লগইন করুন" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });
const cards = (page: Page) => page.getByRole("article").filter({ visible: true });

test.describe.configure({ mode: "serial" });

test("students narrow a chapter to one sub-chapter, and each question names its own", async ({ page }) => {
  await page.goto(`${CHAPTER}?tab=mcq`);
  await expect(cards(page)).toHaveCount(3);
  const menu = field(page, "উপ-অধ্যায়");
  await expect(menu.locator("option")).toHaveText(["সব উপ-অধ্যায়", "৪.১ নিউটনের গতিসূত্র ও বল", "৪.২ ভরবেগ ও বলের ঘাত", "৪.৩ ঘর্ষণ"]);

  await menu.selectOption({ label: "৪.২ ভরবেগ ও বলের ঘাত" });
  await expect(page).toHaveURL(/[?&]sub=2(&|$)/);
  await expect(cards(page)).toHaveCount(2);
  for (const card of await cards(page).all()) await expect(card).toContainText("৪.২ ভরবেগ ও বলের ঘাত");
  // The other tabs count what the sub-chapter has: its one creative question is in ৪.৩.
  await expect(page.getByRole("navigation", { name: "প্রশ্নের ধরন" }).getByRole("link").filter({ hasText: /^CQ/ })).toHaveText(/০$/);

  // The address alone opens it, and the printout says which sub-chapter it holds.
  await page.goto(`${CHAPTER}?tab=cq&sub=3`);
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page)).toContainText("৪.৩ ঘর্ষণ");
  const sheet = await (await page.request.get(`${CHAPTER}?print=chapter&sub=3`)).text();
  expect(sheet).toContain("৪.৩ ঘর্ষণ");

  // A chapter without sub-chapters has no such menu.
  await page.goto("/tanvir/bank/1/1/3?tab=mcq");
  await expect(page.getByRole("article").first()).toBeVisible();
  await expect(field(page, "উপ-অধ্যায়")).toHaveCount(0);
});

test("a teacher adds a sub-chapter, files a new question there, renames, moves and deletes it", async ({ page, request }) => {
  await login(page, "01710000001");
  await page.goto("/dashboard/bank");
  await page.getByRole("region", { name: /শ্রেণি বেছে/ }).getByRole("link").filter({ hasText: "এইচএসসি" }).click();
  await page.locator("#qb-subjects:visible > a").filter({ hasText: "পদার্থবিজ্ঞান ১ম পত্র" }).click();
  await page.getByRole("list", { name: "অধ্যায়" }).getByRole("link").filter({ hasText: "নিউটনিয়ান বলবিদ্যা" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/bank/subject/${UUID}/${UUID}`));
  const chapterPage = page.url().split("?")[0];

  // From the chapter, to its panel on the subject's edit page, already open.
  await page.getByRole("link", { name: "উপ-অধ্যায় সাজান" }).click();
  await expect(page).toHaveURL(/\/edit\?chapter=/);
  const panel = page.locator("li[id^='chapter-']").filter({ has: page.locator("details[open]") });
  await expect(panel).toContainText("নিউটনিয়ান বলবিদ্যা");
  await expect(panel).toContainText("৩টি উপ-অধ্যায়");
  // Pasted with its numbers: they're dropped, and the new one is ৪.৪.
  await panel.getByLabel("নতুন উপ-অধ্যায়, প্রতি লাইনে একটি").fill("৪.৪ নিউটনের তৃতীয় সূত্র");
  await panel.getByRole("button", { name: "উপ-অধ্যায় যোগ করুন" }).click();
  const added = panel.getByLabel("৪.৪ · উপ-অধ্যায়ের নাম", { exact: true });
  await expect(added).toHaveValue("নিউটনের তৃতীয় সূত্র");

  // On the chapter page, looking at ৪.৪: "new" files the question there.
  await page.goto(`${chapterPage}?tab=sq`);
  await field(page, "উপ-অধ্যায়").selectOption({ label: "৪.৪ নিউটনের তৃতীয় সূত্র" });
  await expect(page).toHaveURL(/sub=4/);
  await page.getByRole("link", { name: /^নতুন / }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/bank\/new\?.*topic=/);
  await expect(field(page, "উপ-অধ্যায়")).toHaveValue(/.+/);
  await expect(field(page, "উপ-অধ্যায়").locator("option:checked")).toHaveText("৪.৪ নিউটনের তৃতীয় সূত্র");
  await field(page, "প্রশ্ন").click();
  await page.keyboard.type("ক্রিয়া ও প্রতিক্রিয়া বল কি একই বস্তুর উপর কাজ করে?");
  await page.getByRole("button", { name: "প্রশ্ন যোগ করুন" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/bank/subject/${UUID}/${UUID}\\?tab=sq$`));
  await expect(page.getByRole("article").filter({ hasText: "ক্রিয়া ও প্রতিক্রিয়া" })).toContainText("৪.৪ নিউটনের তৃতীয় সূত্র");

  // Changing the chapter in the editor changes the sub-chapter menu with it.
  await page.getByRole("article").filter({ hasText: "ক্রিয়া ও প্রতিক্রিয়া" }).getByRole("link", { name: "সম্পাদনা" }).click();
  await expect(field(page, "উপ-অধ্যায়").locator("option:checked")).toHaveText("৪.৪ নিউটনের তৃতীয় সূত্র");
  await field(page, "অধ্যায়").selectOption({ label: "অধ্যায় ৩: গতিবিদ্যা" });
  await expect(field(page, "উপ-অধ্যায়")).toHaveCount(0);
  await field(page, "অধ্যায়").selectOption({ label: "অধ্যায় ৪: নিউটনিয়ান বলবিদ্যা" });
  await expect(field(page, "উপ-অধ্যায়").locator("option")).toHaveCount(5);

  // Renamed and moved to the top, it becomes ৪.১; deleted, its question stays in the chapter.
  await page.goto(`${chapterPage.replace(/\/[^/]+$/, "")}/edit?chapter=${chapterPage.split("/").pop()}`);
  await added.fill("ক্রিয়া-প্রতিক্রিয়া");
  await added.locator("xpath=ancestor::form[1]").getByRole("button", { name: "সংরক্ষণ করুন" }).click();
  await expect(panel.getByText("সংরক্ষিত").first()).toBeVisible();
  for (const number of ["৪.৩", "৪.২", "৪.১"]) {
    await panel.getByRole("button", { name: /^উপরে নিন: .*ক্রিয়া-প্রতিক্রিয়া$/ }).click();
    await expect(panel.getByLabel(`${number} · উপ-অধ্যায়ের নাম`, { exact: true })).toHaveValue("ক্রিয়া-প্রতিক্রিয়া");
  }
  await expect(panel.getByRole("button", { name: /^উপরে নিন: .*ক্রিয়া-প্রতিক্রিয়া$/ })).toBeDisabled();
  const site = await (await request.get(`${CHAPTER}?tab=sq`)).text();
  expect(site).toContain("৪.১ ক্রিয়া-প্রতিক্রিয়া");
  expect(site).toContain("৪.২ নিউটনের গতিসূত্র ও বল");

  await panel.getByRole("button", { name: /মুছে ফেলুন.*ক্রিয়া-প্রতিক্রিয়া/ }).click();
  await expect(panel).toContainText("৩টি উপ-অধ্যায়");
  await page.goto(`${chapterPage}?tab=sq`);
  const question = page.getByRole("article").filter({ hasText: "ক্রিয়া ও প্রতিক্রিয়া" });
  await expect(question).toBeVisible();
  await expect(question).not.toContainText("ক্রিয়া-প্রতিক্রিয়া");
});
