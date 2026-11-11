import { type Page, expect, test } from "@playwright/test";

// Phase 3d: the question bank in the QBank design (qbank-handoff/), on the website and in the
// dashboard. Runs after phase3b on the same demo database: tanvir's HSC পদার্থবিজ্ঞান ১ম পত্র,
// chapter 4 (নিউটনিয়ান বলবিদ্যা), has every kind of question, four of them public board questions.

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
const tabs = (page: Page) => page.getByRole("navigation", { name: "প্রশ্নের ধরন" }).getByRole("link");
const openTab = (page: Page) => page.getByRole("navigation", { name: "প্রশ্নের ধরন" }).locator('[aria-current="page"]');
const subjectCards = (page: Page) => page.locator("#qb-subjects:visible > a");
const classCards = (page: Page) => page.getByRole("region", { name: /শ্রেণি বেছে/ }).getByRole("link");

/** The dashboard's এইচএসসি class page, from the bank's first page. */
async function openHsc(page: Page) {
  await page.goto("/dashboard/bank");
  await classCards(page).filter({ hasText: "এইচএসসি" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/bank/class/${UUID}$`));
  return page.url();
}
/** The board tab's rows: one per board question, each with its Open link. */
const boardRows = (page: Page) => page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "খোলো" }) });

test.describe.configure({ mode: "serial" });

test("the filters narrow every tab, live in the address, and reset", async ({ page }) => {
  await page.goto(`${CHAPTER}?tab=mcq`);
  await expect(page.getByRole("article")).toHaveCount(3);

  // Questions from other sources and the teacher's own only: every MCQ here is a board question.
  await page.getByLabel("বোর্ড প্রশ্ন", { exact: true }).uncheck();
  await expect(page).toHaveURL(/src=school%2Cown/);
  await expect(page.getByText("এই ফিল্টারে কোনো বহুনির্বাচনি প্রশ্ন নেই।")).toBeVisible();
  await page.getByRole("link", { name: "সব ফিল্টার তুলে দিন" }).click();
  await expect(page.getByRole("article")).toHaveCount(3);

  // Difficulty: the hard MCQ only, and the other tabs count what the filter leaves them.
  await page.getByLabel("কঠিন", { exact: true }).check();
  await expect(page).toHaveURL(/diff=hard/);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("ভরবেগ সম্পর্কে");
  await expect(tabs(page).filter({ hasText: /^CQ/ })).toHaveText(/১$/);
  await expect(tabs(page).filter({ hasText: "পাঠ্যবই" })).toHaveText(/০$/);

  await page.getByRole("button", { name: "রিসেট" }).click();
  await expect(page).toHaveURL(new RegExp(`${CHAPTER}\\?tab=mcq$`));
  await expect(page.getByRole("article")).toHaveCount(3);
});

test("the board tab's chips filter its rows, and Open jumps to the question in its own tab", async ({ page }) => {
  await page.goto(`${CHAPTER}?tab=board`);
  await expect(boardRows(page)).toHaveCount(4);
  const chips = page.getByRole("group", { name: "বোর্ড" }).getByRole("link");
  await expect(chips).toHaveText(["সব বোর্ড", "ঢাকা বোর্ড", "রাজশাহী বোর্ড", "চট্টগ্রাম বোর্ড"]);

  await chips.filter({ hasText: "ঢাকা বোর্ড" }).click();
  await expect(page).toHaveURL(/board=dhaka/);
  await expect(boardRows(page)).toHaveCount(2);
  // The chips and the sidebar's board menu are the same filter.
  await expect(page.getByRole("combobox", { name: "বোর্ড" })).toHaveValue("dhaka");

  await boardRows(page)
    .filter({ has: page.getByText("CQ", { exact: true }) })
    .getByRole("link", { name: "খোলো" })
    .click();
  await expect(page).toHaveURL(new RegExp(`\\?tab=cq&board=dhaka&q=${UUID}#q-${UUID}$`));
  await expect(openTab(page)).toHaveText(/^CQ/);
  await expect(page.getByRole("article", { name: "CQ ১" })).toBeFocused();
});

test("all answers open at once, and a bookmark stays in this browser", async ({ page }) => {
  await page.goto(`${CHAPTER}?tab=practice`);
  await expect(page.getByText("উত্তর:")).toHaveCount(0);
  await page.getByRole("button", { name: "সব উত্তর দেখো" }).click();
  await expect(page.getByText("উত্তর:")).toHaveCount(3);
  await page.getByRole("button", { name: "সব উত্তর লুকাও" }).click();
  await expect(page.getByText("উত্তর:")).toHaveCount(0);

  const card = page.getByRole("article", { name: "প্র্যাকটিস ১" });
  await card.getByRole("button", { name: "বুকমার্ক", exact: true }).click();
  await expect(card.getByRole("button", { name: "বুকমার্ক করা" })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("article", { name: "প্র্যাকটিস ১" }).getByRole("button", { name: "বুকমার্ক করা" })).toBeVisible();
});

test("the chapter PDF opens the print dialog on every public question, with its answer", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { prints: number };
    w.prints = 0;
    window.print = () => {
      w.prints += 1;
    };
  });
  await page.goto(`${CHAPTER}?tab=mcq`);
  await page.getByRole("link", { name: "অধ্যায়ের PDF" }).click();
  await expect(page).toHaveURL(/print=chapter/);
  const sheet = page.locator("[data-print-sheet]");
  await expect(sheet.getByRole("heading", { level: 1 })).toContainText("নিউটনিয়ান বলবিদ্যা");
  await expect(sheet.getByRole("heading", { level: 2 })).toHaveText([
    "পাঠ্যবইয়ের গাণিতিক সমস্যা",
    "প্র্যাকটিসের গাণিতিক সমস্যা",
    "বহুনির্বাচনি প্রশ্ন",
    "সংক্ষিপ্ত প্রশ্ন",
    "সৃজনশীল প্রশ্ন",
  ]);
  await expect(sheet).toContainText("সুতরাং গতীয় ঘর্ষণ বল");
  await expect(sheet).not.toContainText("কোনটি নিউটনের তৃতীয় সূত্রের উদাহরণ?");
  await expect.poll(() => page.evaluate(() => (window as unknown as { prints: number }).prints)).toBe(1);

  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".site-header")).toBeHidden();
  await expect(sheet).toBeVisible();
});

test("a subject's group gives its class page tabs, and a question gets a difficulty", async ({ page }) => {
  await login(page, "01710000001");
  const hsc = await openHsc(page);
  await subjectCards(page).filter({ hasText: "নতুন বিষয়" }).click();
  await field(page, "বিষয়ের নাম").fill("তথ্য ও যোগাযোগ প্রযুক্তি");
  await field(page, "বিভাগ").selectOption({ label: "সব বিভাগ" });
  await page.getByRole("button", { name: "বিষয় তৈরি করুন" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/bank/subject/${UUID}$`));
  await expect(page.getByText(/এইচএসসি · সব বিভাগের জন্য/)).toBeVisible();

  await page.goto(hsc);
  const groups = page.getByRole("tablist", { name: "বিভাগ" }).getByRole("tab");
  await expect(groups).toHaveText(["সব বিভাগ", "বিজ্ঞান"]);
  // It opens on the group of the teacher's first subject in the class.
  await expect(groups.filter({ hasText: "বিজ্ঞান" })).toHaveAttribute("aria-selected", "true");
  await expect(subjectCards(page)).toHaveText([/পদার্থবিজ্ঞান ১ম পত্র/, /নতুন বিষয়/]);
  await groups.filter({ hasText: "সব বিভাগ" }).click();
  await expect(page).toHaveURL(/group=common/);
  await expect(subjectCards(page)).toHaveText([/তথ্য ও যোগাযোগ প্রযুক্তি/, /নতুন বিষয়/]);

  // Tidy up: the subject goes again.
  await subjectCards(page).filter({ hasText: "তথ্য ও যোগাযোগ প্রযুক্তি" }).click();
  await page.getByRole("link", { name: "বিষয় ও অধ্যায় সম্পাদনা" }).filter({ visible: true }).click();
  await field(page, "হ্যাঁ, বিষয়টি মুছে ফেলতে চাই").check();
  await page.getByRole("button", { name: "মুছে ফেলুন" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(hsc);
  await expect(page.getByRole("tablist", { name: "বিভাগ" })).toHaveCount(0);

  await page.goto("/dashboard/bank/new?type=short");
  await expect(field(page, "কাঠিন্য")).toHaveValue("");
  await expect(field(page, "কাঠিন্য").locator("option")).toHaveText(["বলা নেই", "সহজ", "মাঝারি", "কঠিন"]);
});

test("in the dashboard each card carries the teacher's tools", async ({ page }) => {
  await login(page, "01710000001");
  await openHsc(page);
  await subjectCards(page).filter({ hasText: "পদার্থবিজ্ঞান ১ম পত্র" }).click();
  await page.getByRole("list", { name: "অধ্যায়" }).getByRole("link").filter({ hasText: "নিউটনিয়ান বলবিদ্যা" }).click();
  await tabs(page).filter({ hasText: "MCQ" }).click();
  await expect(page).toHaveURL(/tab=mcq/);

  const first = () => page.getByRole("article", { name: "MCQ ১" });
  await expect(first()).toContainText("ভরের একটি বস্তুর উপর");
  await expect(first().getByRole("link", { name: "সম্পাদনা" })).toHaveAttribute("href", new RegExp(`^/dashboard/bank/${UUID}$`));
  await first().getByRole("button", { name: "নিচে নিন" }).click();
  await expect(first()).toContainText("রকেট");
  await page.getByRole("article", { name: "MCQ ২" }).getByRole("button", { name: "উপরে নিন" }).click();
  await expect(first()).toContainText("ভরের একটি বস্তুর উপর");
  // The private question is marked, and students never see it.
  await expect(page.getByRole("article", { name: "MCQ ৪" })).toContainText("শুধু আপনি");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test("the filters fold into a button, and nothing scrolls sideways", async ({ page }) => {
    // The printout opens the print dialog by itself; nothing to print here.
    await page.addInitScript(() => {
      window.print = () => {};
    });
    for (const path of [`${CHAPTER}?tab=board`, `${CHAPTER}?tab=mcq`, `${CHAPTER}?print=chapter`]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - 360), path).toBeLessThanOrEqual(0);
    }
    await page.goto(CHAPTER);
    await expect(page.getByLabel("বোর্ড প্রশ্ন", { exact: true })).toBeHidden();
    await page.getByRole("button", { name: /^ফিল্টার/ }).click();
    await expect(page.getByLabel("বোর্ড প্রশ্ন", { exact: true })).toBeVisible();
  });
});
