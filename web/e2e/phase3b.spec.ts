import { type Page, expect, test } from "@playwright/test";

// Phase 3b: the question bank on its own, separate from courses: class › subject › chapter ›
// section, in the dashboard and on the website. Runs after phase3 on the same demo database:
// tanvir's bank has the classes এইচএসসি (class 1) and এসএসসি (class 2), with পদার্থবিজ্ঞান ১ম পত্র
// (subject 1) in the first and পদার্থবিজ্ঞান (subject 2) in the second.

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

/** The bank's pages, by role: class cards, subject cards, chapter rows, a chapter's tabs. */
const classCards = (page: Page) => page.getByRole("region", { name: /শ্রেণি বেছে/ }).getByRole("link");
const subjectCards = (page: Page) => page.locator("#qb-subjects:visible > a");
const chapterRows = (page: Page) => page.getByRole("list", { name: "অধ্যায়" }).getByRole("link");
const tabs = (page: Page) => page.getByRole("navigation", { name: "প্রশ্নের ধরন" }).getByRole("link");
const openTab = (page: Page) => page.getByRole("navigation", { name: "প্রশ্নের ধরন" }).locator('[aria-current="page"]');

// A tab's text holds its short and its full name (one is hidden by width), then its count.
const TABS = [/পাঠ্যবই/, /প্র্যাকটিস/, /^MCQ/, /^SQ/, /^CQ/, /বোর্ড/];
const UUID = "[0-9a-f-]{36}";

test.describe.configure({ mode: "serial" });

test("the teacher's bank goes class › subject › chapter › section, and adds where you are", async ({ page }) => {
  await login(page, "01710000001");
  await page.getByRole("link", { name: "প্রশ্নব্যাংক" }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/bank$/);
  await expect(classCards(page)).toHaveText([/এসএসসি/, /এইচএসসি/]);
  await shot(page, "dashboard-bank-classes-1280");

  await classCards(page).filter({ hasText: "এইচএসসি" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/bank/class/${UUID}$`));
  // The bank's own subjects (courses, what the website advertises, aren't listed), and a card to add one.
  await expect(subjectCards(page)).toHaveText([/পদার্থবিজ্ঞান ১ম পত্র/, /নতুন বিষয়/]);
  await subjectCards(page).filter({ hasText: "পদার্থবিজ্ঞান ১ম পত্র" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/bank/subject/${UUID}$`));
  await expect(chapterRows(page)).toHaveCount(10);
  await shot(page, "dashboard-bank-chapters-1280");

  await chapterRows(page).filter({ hasText: "নিউটনিয়ান বলবিদ্যা" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/bank/subject/${UUID}/${UUID}$`));
  // All six tabs, in order, empty ones too; the first with questions is open.
  await expect(tabs(page)).toHaveText(TABS);
  await expect(tabs(page).first()).toHaveAttribute("aria-current", "page");

  // The teacher's own view includes private questions, marked.
  await tabs(page).nth(2).click();
  await expect(page).toHaveURL(/tab=mcq/);
  await expect(page.getByRole("article").filter({ hasText: "কোনটি নিউটনের তৃতীয় সূত্রের উদাহরণ?" })).toContainText("শুধু আপনি");

  await tabs(page).nth(1).click();
  await expect(page).toHaveURL(/tab=practice/);
  await expect(page.getByRole("article")).toHaveCount(2);
  await shot(page, "dashboard-bank-section-1280");
  await page.getByRole("link", { name: "নতুন প্র্যাকটিস সমস্যা" }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/bank\/new\?type=practice&subject=.+&chapter=.+/);
  // Subject and chapter are already chosen: where the teacher was.
  await expect(field(page, "অধ্যায়")).toHaveValue(/.+/);
  await field(page, "প্রশ্ন").fill("$2\\,\\text{kg}$ ভরের বস্তুতে $6\\,\\text{N}$ বল প্রয়োগ করলে ত্বরণ কত?");
  await field(page, "উত্তর (ঐচ্ছিক)").fill("$3\\,\\text{m s}^{-2}$");
  await expect(page.locator(".q-card:visible .explain")).toContainText("উত্তর:");
  await page.getByRole("button", { name: "প্রশ্ন যোগ করুন" }).click();

  await expect(page).toHaveURL(new RegExp(`/dashboard/bank/subject/${UUID}/${UUID}\\?tab=practice$`));
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(page.getByRole("article").last()).toContainText("ত্বরণ কত?");
});

test("a teacher names a new class, sets up a subject in it by pasting its chapters, then adds, moves and deletes chapters", async ({ page }) => {
  await login(page, "01710000001");
  await page.goto("/dashboard/bank");
  // The first page adds classes, nothing else: subjects go in a class, questions in a chapter.
  const head = page.locator("main:visible > div").first();
  await expect(head.getByRole("link")).toHaveText([/নতুন শ্রেণি/]);
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /সব প্রশ্ন/ })).toHaveCount(0);
  await head.getByRole("link", { name: "নতুন শ্রেণি" }).click();
  await expect(page).toHaveURL(/\/dashboard\/bank\/class\/new$/);

  // The teacher types the class's name; one the bank already has is refused.
  await field(page, "শ্রেণির নাম").fill("এইচএসসি");
  await page.getByRole("button", { name: "শ্রেণি যোগ করুন" }).click();
  await expect(page.locator("#name-error:visible")).toHaveText("এই নামে আপনার একটি শ্রেণি আগেই আছে");
  await field(page, "শ্রেণির নাম").fill("মেডিকেল ভর্তি");
  await shot(page, "dashboard-bank-new-class-1280");
  await page.getByRole("button", { name: "শ্রেণি যোগ করুন" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/bank/class/${UUID}$`));
  await expect(page.getByRole("heading", { name: "মেডিকেল ভর্তি" })).toBeVisible();
  await expect(subjectCards(page)).toHaveText([/নতুন বিষয়/]);
  await subjectCards(page).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/bank/subject/new\\?class=${UUID}$`));
  await expect(field(page, "শ্রেণি").locator("option:checked")).toHaveText("মেডিকেল ভর্তি");
  await field(page, "বিষয়ের নাম").fill("মেডিকেল ভর্তি: পদার্থবিজ্ঞান");
  // Pasted from a contents page: the numbering goes.
  await field(page, "অধ্যায়গুলো, প্রতি লাইনে একটি (ঐচ্ছিক)").fill("অধ্যায় ১: ভৌতজগৎ ও পরিমাপ\n২. ভেক্টর\n\n৩) গতিবিদ্যা");
  await page.getByRole("button", { name: "বিষয় তৈরি করুন" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/bank/subject/${UUID}$`));
  await expect(chapterRows(page)).toHaveText([/ভৌতজগৎ ও পরিমাপ/, /ভেক্টর/, /গতিবিদ্যা/]);

  await page.getByRole("link", { name: "বিষয় ও অধ্যায় সম্পাদনা" }).filter({ visible: true }).click();
  const chapters = page.locator("#chapters:visible ol > li");
  await field(page, "নতুন অধ্যায়, প্রতি লাইনে একটি").fill("নিউটনিয়ান বলবিদ্যা\nকাজ, শক্তি ও ক্ষমতা");
  await page.getByRole("button", { name: "অধ্যায় যোগ করুন" }).click();
  await expect(chapters).toHaveCount(5);
  await page.getByRole("button", { name: "উপরে নিন: কাজ, শক্তি ও ক্ষমতা" }).click();
  await expect(chapters.nth(3)).toContainText("কাজ, শক্তি ও ক্ষমতা");
  await chapters.filter({ hasText: "গতিবিদ্যা" }).locator("summary").click();
  await chapters.filter({ hasText: "গতিবিদ্যা" }).getByRole("button", { name: "মুছে ফেলুন" }).click();
  await expect(chapters).toHaveCount(4);
  await shot(page, "dashboard-bank-subject-edit-1280");

  // Classes are listed by the class each name reads as: SSC, HSC, then admission tests.
  await page.goto("/dashboard/bank");
  await expect(classCards(page)).toHaveText([/এসএসসি/, /এইচএসসি/, /মেডিকেল ভর্তি/]);
});

test("a class is renamed, and stays in the bank until it is removed, which only an empty class can be", async ({ page }) => {
  await login(page, "01710000001");
  await page.goto("/dashboard/bank/class/new");
  await field(page, "শ্রেণির নাম").fill("সপ্তম শ্রেণী");
  await page.getByRole("button", { name: "শ্রেণি যোগ করুন" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/bank/class/${UUID}$`));
  const classPage = page.url();

  // A spelling fixed: the class keeps its subjects and its address.
  await page.getByRole("link", { name: "শ্রেণির নাম বদলান" }).click();
  await expect(field(page, "শ্রেণির নাম")).toHaveValue("সপ্তম শ্রেণী");
  await field(page, "শ্রেণির নাম").fill("সপ্তম শ্রেণি");
  await page.getByRole("button", { name: "সংরক্ষণ করুন" }).click();
  await expect(page).toHaveURL(classPage);
  await expect(page.getByRole("heading", { name: "সপ্তম শ্রেণি" })).toBeVisible();

  await page.goto("/dashboard/bank");
  await expect(classCards(page)).toHaveText([/সপ্তম শ্রেণি/, /এসএসসি/, /এইচএসসি/, /মেডিকেল ভর্তি/]);
  await expect(classCards(page).filter({ hasText: "সপ্তম শ্রেণি" })).toContainText("০টি বিষয়");

  await classCards(page).filter({ hasText: "সপ্তম শ্রেণি" }).click();
  await expect(page.getByText("এই শ্রেণিতে এখনো কোনো বিষয় নেই।")).toBeVisible();
  await page.getByRole("button", { name: "শ্রেণিটি সরান" }).click();
  await expect(page).toHaveURL(/\/dashboard\/bank$/);
  await expect(classCards(page)).toHaveText([/এসএসসি/, /এইচএসসি/, /মেডিকেল ভর্তি/]);

  // A class with subjects has no such button, and a removed class is no page.
  await classCards(page).filter({ hasText: "এইচএসসি" }).click();
  await expect(subjectCards(page).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "শ্রেণিটি সরান" })).toHaveCount(0);
  await page.goto(classPage);
  await expect(page.getByRole("heading", { name: "পাতাটি পাওয়া যায়নি" })).toBeVisible();
});

test("a subject can take its chapters from a course, and is deleted with its questions", async ({ page }) => {
  await login(page, "01710000001");
  await page.goto("/dashboard/bank");
  await classCards(page).filter({ hasText: "এইচএসসি" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/bank/class/${UUID}$`));
  const hscPage = page.url();
  await subjectCards(page).filter({ hasText: "নতুন বিষয়" }).click();
  await expect(field(page, "শ্রেণি").locator("option:checked")).toHaveText("এইচএসসি");
  await field(page, "বিষয়ের নাম").fill("পদার্থবিজ্ঞান ২য় পত্র");
  await field(page, "অথবা কোনো কোর্সের অধ্যায়গুলো নিন").selectOption({ label: "পদার্থবিজ্ঞান ২য় পত্র (১১টি অধ্যায়)" });
  await page.getByRole("button", { name: "বিষয় তৈরি করুন" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/bank/subject/${UUID}$`));
  await expect(chapterRows(page)).toHaveCount(11);

  await page.getByRole("link", { name: "বিষয় ও অধ্যায় সম্পাদনা" }).filter({ visible: true }).click();
  await field(page, "হ্যাঁ, বিষয়টি মুছে ফেলতে চাই").check();
  await page.getByRole("button", { name: "মুছে ফেলুন" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(hscPage);
  await expect(subjectCards(page)).toHaveText([/পদার্থবিজ্ঞান ১ম পত্র/, /নতুন বিষয়/]);

  // Courses are adverts now: their form no longer asks for a subject.
  await page.goto("/dashboard/courses/new");
  await expect(field(page, "শ্রেণি")).toBeVisible();
  await expect(page.getByLabel("বিষয়", { exact: true })).toHaveCount(0);
});

test("students reach a chapter's sections through the website's question bank", async ({ page }) => {
  await page.goto("/tanvir");
  await page.locator(".site-nav").getByRole("link", { name: "প্রশ্নব্যাংক" }).click();
  await expect(page).toHaveURL(/\/tanvir\/bank$/);
  // Only classes and subjects with public questions: the new admission class has none yet.
  await expect(classCards(page)).toHaveText([/এসএসসি/, /এইচএসসি/]);
  await shot(page, "site-bank-ink-1280");
  await classCards(page).filter({ hasText: "এইচএসসি" }).click();
  await expect(page).toHaveURL(/\/tanvir\/bank\/1$/);
  await expect(subjectCards(page)).toHaveText([/পদার্থবিজ্ঞান ১ম পত্র/]);
  await subjectCards(page).click();
  await expect(page).toHaveURL(/\/tanvir\/bank\/1\/1$/);
  await shot(page, "site-bank-chapters-ink-1280");

  // Each chapter row counts its tabs' questions (the first test added a practice problem);
  // a chapter without any says so.
  const newton = chapterRows(page).filter({ hasText: "নিউটনিয়ান বলবিদ্যা" });
  await expect(newton).toContainText("প্র্যাকটিস ৩");
  await expect(newton).toContainText("বোর্ড ৪");
  await expect(chapterRows(page).filter({ hasText: "আদর্শ গ্যাস" })).toContainText("এখনো প্রশ্ন নেই");

  await newton.click();
  await tabs(page).filter({ hasText: "প্র্যাকটিস" }).click();
  await expect(page).toHaveURL(/\/tanvir\/bank\/1\/1\/4\?tab=practice$/);
  await expect(tabs(page)).toHaveText(TABS);
  await expect(openTab(page)).toContainText("প্র্যাকটিস সমস্যা");
  await expect(page.getByRole("navigation", { name: "অবস্থান" })).toContainText("প্রশ্নব্যাংক");
  await expect(page.getByRole("article")).toHaveCount(3);

  // Students try first: the answer and the solution open only when asked.
  const card = page.getByRole("article").filter({ hasText: "ভরবেগের পরিবর্তন কত?" });
  await expect(card.getByText("উত্তর:")).toBeHidden();
  await card.getByRole("button", { name: "উত্তর দেখো" }).click();
  await expect(card.getByText("উত্তর:")).toBeVisible();
  await expect(card.getByText("বলের ঘাত")).toBeHidden();
  await card.getByRole("button", { name: "সমাধান দেখো" }).click();
  await expect(card.getByText("বলের ঘাত")).toBeVisible();

  // The course page advertises the course; it no longer links into the bank.
  await page.goto("/tanvir/courses/1");
  await expect(page.locator('main a[href*="/bank/"]')).toHaveCount(0);
});

test("old and moved addresses land on the right page", async ({ page, request }) => {
  await page.goto("/tanvir/bank/1/1/4?tab=problem");
  await expect(openTab(page)).toContainText("পাঠ্যবইয়ের সমস্যা");
  await page.goto("/tanvir/bank/1/1/4?tab=creative");
  await expect(openTab(page)).toHaveText(/^CQ/);
  // ?tab=board is the board questions' tab again: every type, one row each.
  await page.goto("/tanvir/bank/1/1/4?tab=board");
  await expect(openTab(page)).toContainText("বোর্ড");
  await expect(page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "খোলো" }) })).toHaveCount(4);

  // A subject asked for under another class is sent to its class, permanently; so is an address
  // from before teachers named their classes, when the class was a fixed key such as "hsc".
  for (const old of ["/tanvir/bank/2/1/4?tab=mcq", "/tanvir/bank/hsc/1/4?tab=mcq", "/tanvir/bank/01/1/4?tab=mcq"]) {
    const moved = await request.get(old, { maxRedirects: 0 });
    expect(moved.status(), old).toBe(308);
    expect(moved.headers().location, old).toMatch(/\/tanvir\/bank\/1\/1\/4\?tab=mcq$/);
  }
});

test("bank addresses that don't exist are real 404s", async ({ request }) => {
  for (const path of ["/tanvir/bank", "/tanvir/bank/1", "/tanvir/bank/1/1", "/tanvir/bank/2/2/2"]) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
  for (const path of [
    "/tanvir/bank/nope",
    "/tanvir/bank/99",
    // A fixed-list key only finds a class made from it before teachers named their own.
    "/tanvir/bank/class-6",
    "/tanvir/bank/1/99",
    "/tanvir/bank/1/1/99",
    "/tanvir/bank/1/x",
    "/tanvir/bank/1/1/4/more",
    "/tanvir/courses/1/chapters",
    "/no-such-teacher-xyz/bank",
  ]) {
    expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(404);
  }
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  const fits = async (page: Page, label: string) =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth - 360), label).toBeLessThanOrEqual(0);

  test("the bank's pages fit a 360px screen", async ({ page }) => {
    for (const path of ["/tanvir/bank", "/tanvir/bank/1", "/tanvir/bank/1/1", "/tanvir/bank/1/1/4?tab=practice"]) {
      await page.goto(path);
      await fits(page, path);
    }
    await page.goto("/tanvir/bank/1/1");
    await shot(page, "site-bank-chapters-ink-360");

    await login(page, "01710000001");
    await page.goto("/dashboard/bank");
    await fits(page, "classes");
    await classCards(page).filter({ hasText: "এইচএসসি" }).click();
    await expect(page).toHaveURL(new RegExp(`/class/${UUID}$`));
    await fits(page, "subjects");
    await subjectCards(page).filter({ hasText: "পদার্থবিজ্ঞান ১ম পত্র" }).click();
    await expect(page).toHaveURL(new RegExp(`/subject/${UUID}$`));
    await fits(page, "chapters");
    await shot(page, "dashboard-bank-chapters-360");
    await chapterRows(page).filter({ hasText: "নিউটনিয়ান বলবিদ্যা" }).click();
    await expect(page).toHaveURL(new RegExp(`/subject/${UUID}/${UUID}$`));
    await fits(page, "questions");
    await shot(page, "dashboard-bank-section-360");
    await page.goBack();
    await page.getByRole("link", { name: "বিষয় ও অধ্যায় সম্পাদনা" }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/edit$/);
    await fits(page, "edit subject");
  });
});
