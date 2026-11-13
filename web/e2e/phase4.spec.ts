import { type Page, expect, test } from "@playwright/test";

// Phase 4: students, batches and admission. Runs after phase3f on the same demo database: tanvir's
// first course (পদার্থবিজ্ঞান ১ম পত্র, /tanvir/courses/1, paid) has the batches ক and খ, the student
// রাহিম উদ্দিন in ক with roll 1, and a request from সাদিয়া ইসলাম waiting.

const SHOTS = process.env.SHOTS_DIR;
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

const COURSE = "/tanvir/courses/1";
const STUDENT = { name: "নাফিসা রহমান", phone: "01911111111", password: "nafisa-pass" };

async function teacherLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("মোবাইল নম্বর বা ইমেইল").fill("01710000001");
  await page.getByLabel("পাসওয়ার্ড").fill("teacher-password");
  await page.getByRole("button", { name: "লগইন করুন" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function studentLogin(page: Page, password = STUDENT.password) {
  await page.goto("/tanvir/login");
  await page.getByLabel("মোবাইল নম্বর").fill(STUDENT.phone);
  await page.getByLabel("পাসওয়ার্ড").fill(password);
  await page.getByRole("button", { name: "লগইন করো" }).click();
}

/** A visible field by its label: the whole label for a string (so "নাম" isn't "অভিভাবকের নাম"), a pattern otherwise. */
const field = (page: Page, label: string | RegExp) => page.getByLabel(label, { exact: true }).filter({ visible: true });
const menu = (page: Page) => page.getByRole("complementary", { name: "মেনু" });

test.describe.configure({ mode: "serial" });

test("a student opens an account from a course page and asks to join a batch", async ({ page, request }) => {
  // A student's own page needs their sign-in: a real redirect to the way in.
  const signedOut = await request.get("/tanvir/me", { maxRedirects: 0 });
  expect(signedOut.status()).toBe(307);
  expect(signedOut.headers().location).toMatch(/\/tanvir\/login$/);

  await page.goto(COURSE);
  await page.getByRole("link", { name: "ভর্তি হতে চাই" }).click();
  await expect(page).toHaveURL(/\/tanvir\/join\?next=/);

  // What's wrong is said in Bangla, and what was typed stays.
  await field(page, "তোমার নাম").fill(STUDENT.name);
  await field(page, "মোবাইল নম্বর").fill("12345");
  await field(page, "পাসওয়ার্ড").fill("123");
  await page.getByRole("button", { name: "অ্যাকাউন্ট খোলো" }).click();
  await expect(page.locator("#phone-error")).toHaveText("সঠিক মোবাইল নম্বর দিন, যেমন 01712345678");
  await expect(page.locator("#password-error")).toHaveText("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
  await expect(field(page, "তোমার নাম")).toHaveValue(STUDENT.name);

  // A number another student of this teacher has.
  await field(page, "মোবাইল নম্বর").fill("01900000001");
  await field(page, "পাসওয়ার্ড").fill(STUDENT.password);
  await page.getByRole("button", { name: "অ্যাকাউন্ট খোলো" }).click();
  await expect(page.locator("#phone-error")).toHaveText("এই মোবাইল নম্বরে আগেই একজন শিক্ষার্থী আছে");

  await field(page, "মোবাইল নম্বর").fill(STUDENT.phone);
  await field(page, "পাসওয়ার্ড").fill(STUDENT.password);
  await field(page, /^শ্রেণি/).fill("একাদশ");
  await page.getByRole("button", { name: "অ্যাকাউন্ট খোলো" }).click();

  // Signed in, and back on the course they came for.
  await expect(page).toHaveURL(new RegExp(`${COURSE}$`));
  await expect(page.getByRole("banner").getByRole("link", { name: "আমার পাতা" })).toBeVisible();
  await field(page, "কোন ব্যাচে?").selectOption({ label: "খ ব্যাচ · রবি-মঙ্গল-বৃহস্পতি, সন্ধ্যা ৬টা" });
  await field(page, /শিক্ষককে কিছু জানাতে/).fill("সন্ধ্যার ব্যাচে পড়তে চাই।");
  await shot(page, "site-course-apply-1280");
  await page.getByRole("button", { name: "ভর্তি হতে চাই" }).click();
  await expect(page.getByRole("status").filter({ hasText: "তোমার আবেদন জমা হয়েছে" })).toBeVisible();

  await page.getByRole("banner").getByRole("link", { name: "আমার পাতা" }).click();
  await expect(page).toHaveURL(/\/tanvir\/me$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`স্বাগতম, ${STUDENT.name}`);
  const mine = page.getByRole("listitem").filter({ hasText: "পদার্থবিজ্ঞান ১ম পত্র" });
  await expect(mine).toContainText("অনুমোদনের অপেক্ষায়");
  await expect(mine).toContainText("ব্যাচ: খ ব্যাচ");
  await shot(page, "site-me-pending-1280");

  // Signing out ends it: the page is behind the login again.
  await page.getByRole("button", { name: "লগআউট" }).click();
  await expect(page).toHaveURL(/\/tanvir$/);
  await page.goto("/tanvir/me");
  await expect(page).toHaveURL(/\/tanvir\/login$/);
});

test("the teacher sees the requests, admits one with the next roll and declines another", async ({ page }) => {
  await teacherLogin(page);
  const link = menu(page).getByRole("link", { name: /ভর্তির অনুরোধ/ });
  await expect(link).toContainText("২");
  await link.click();
  await expect(page).toHaveURL(/\/dashboard\/requests$/);
  await shot(page, "dashboard-requests-1280");

  const card = page.getByRole("listitem").filter({ hasText: STUDENT.name });
  await expect(card).toContainText("সন্ধ্যার ব্যাচে পড়তে চাই।");
  // The batch the student asked for is already chosen.
  await expect(card.getByLabel("ব্যাচ").locator("option:checked")).toHaveText(/^খ ব্যাচ/);
  // A roll that is taken (রাহিম has 1) is refused; left empty, the next one is given.
  await card.getByLabel("রোল").fill("1");
  await card.getByRole("button", { name: "ভর্তি করুন" }).click();
  await expect(card.getByText("এই রোলটি এই কোর্সে আরেকজনের আছে")).toBeVisible();
  await card.getByLabel("রোল").fill("");
  await card.getByRole("button", { name: "ভর্তি করুন" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: STUDENT.name })).toHaveCount(0);

  const other = page.getByRole("listitem").filter({ hasText: "সাদিয়া ইসলাম" });
  await other.getByLabel("কারণ (শিক্ষার্থী দেখবে)").fill("এই ব্যাচে আসন নেই");
  await other.getByRole("button", { name: "না বলুন" }).click();
  await expect(page.getByText("এখন কোনো অনুরোধ অপেক্ষায় নেই।")).toBeVisible();
  await expect(menu(page).getByRole("link", { name: /ভর্তির অনুরোধ/ })).not.toContainText(/[০-৯]/);

  // In the students list, with the course, batch and roll.
  await menu(page).getByRole("link", { name: "শিক্ষার্থী তালিকা" }).click();
  await expect(page).toHaveURL(/\/dashboard\/students$/);
  const row = page.getByRole("listitem").filter({ hasText: STUDENT.name });
  await expect(row).toContainText("পদার্থবিজ্ঞান ১ম পত্র · খ ব্যাচ · রোল ২");
  await shot(page, "dashboard-students-1280");
  // Found by number, and by the course they are in.
  await field(page, "নাম বা মোবাইল নম্বর").fill("0191111");
  await page.getByRole("button", { name: "দেখান" }).click();
  await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText("১ জন শিক্ষার্থী")).toBeVisible();
});

test("the student sees they are in, with their roll; a wrong password says nothing more", async ({ page }) => {
  await studentLogin(page, "not-my-password");
  await expect(page.locator("form [role=alert]")).toHaveText("মোবাইল নম্বর অথবা পাসওয়ার্ড মেলেনি");
  await studentLogin(page);
  await expect(page).toHaveURL(/\/tanvir\/me$/);
  const mine = page.getByRole("listitem").filter({ hasText: "পদার্থবিজ্ঞান ১ম পত্র" });
  await expect(mine).toContainText("ভর্তি আছো");
  await expect(mine).toContainText("রোল: ২");

  await page.goto(COURSE);
  await expect(page.getByRole("status").filter({ hasText: "তুমি এই কোর্সে ভর্তি আছো।" })).toContainText("রোল: ২");

  // Their own password, changed with the current one.
  await page.goto("/tanvir/me");
  await field(page, "এখনকার পাসওয়ার্ড").fill("wrong-one");
  await field(page, "নতুন পাসওয়ার্ড").fill("nafisa-new-pass");
  await page.getByRole("button", { name: "পাসওয়ার্ড বদলাও" }).click();
  await expect(page.locator("#currentPassword-error")).toHaveText("এখনকার পাসওয়ার্ডটি মেলেনি");
  await field(page, "এখনকার পাসওয়ার্ড").fill(STUDENT.password);
  await field(page, "নতুন পাসওয়ার্ড").fill("nafisa-new-pass");
  await page.getByRole("button", { name: "পাসওয়ার্ড বদলাও" }).click();
  await expect(page.getByRole("status").filter({ hasText: "সংরক্ষিত হয়েছে" })).toBeVisible();
});

test("the teacher adds an offline student, enrols them, gives them a login, and opens a batch", async ({ page, browser }) => {
  await teacherLogin(page);
  await page.goto("/dashboard/students");
  await page.getByRole("link", { name: "নতুন শিক্ষার্থী" }).click();
  await field(page, "নাম").fill("তাসনিম আক্তার");
  await field(page, "মোবাইল নম্বর").fill("01922222222");
  await field(page, /^অভিভাবকের নাম/).fill("আক্তার হোসেন");
  await page.getByRole("button", { name: "শিক্ষার্থী যোগ করুন" }).click();
  await expect(page).toHaveURL(/\/dashboard\/students\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("তাসনিম আক্তার");
  await expect(page.getByText("এই শিক্ষার্থীর এখনো লগইন নেই।", { exact: false })).toBeVisible();

  // Into the first course's batch ক, with a roll and a fee of their own.
  await field(page, "কোর্স").selectOption({ label: "পদার্থবিজ্ঞান ১ম পত্র" });
  await field(page, "ব্যাচ").selectOption({ index: 1 });
  await field(page, "রোল").fill("৫০");
  await field(page, "ফি (টাকা)").fill("১০০০");
  await page.getByRole("button", { name: "ভর্তি করুন", exact: true }).click();
  const place = page.getByRole("listitem").filter({ hasText: "পদার্থবিজ্ঞান ১ম পত্র" });
  await expect(place).toContainText("ভর্তি আছে");
  await expect(place.getByLabel("রোল")).toHaveValue("50");
  await expect(place.getByLabel("ফি (টাকা)")).toHaveValue("1000");
  await shot(page, "dashboard-student-1280");

  // A password from the teacher lets them in on the website.
  await field(page, "নতুন পাসওয়ার্ড").fill("tasnim-pass");
  await page.getByRole("button", { name: "পাসওয়ার্ড দিন" }).click();
  await expect(page.getByText("শিক্ষার্থী নিজের মোবাইল নম্বর আর পাসওয়ার্ড দিয়ে", { exact: false })).toBeVisible();
  const visitor = await browser.newContext();
  const theirs = await visitor.newPage();
  await theirs.goto("/tanvir/login");
  await theirs.getByLabel("মোবাইল নম্বর").fill("01922222222");
  await theirs.getByLabel("পাসওয়ার্ড").fill("tasnim-pass");
  await theirs.getByRole("button", { name: "লগইন করো" }).click();
  await expect(theirs).toHaveURL(/\/tanvir\/me$/);
  await expect(theirs.getByRole("listitem").filter({ hasText: "পদার্থবিজ্ঞান ১ম পত্র" })).toContainText("রোল: ৫০");

  // Switched off, the account is signed out and can't sign in.
  await page.getByRole("button", { name: "অ্যাকাউন্ট বন্ধ করুন" }).click();
  await expect(page.getByText("অ্যাকাউন্ট বন্ধ: এই শিক্ষার্থী এখন লগইন করতে পারবে না।")).toBeVisible();
  await theirs.goto("/tanvir/me");
  await expect(theirs).toHaveURL(/\/tanvir\/login$/);
  await theirs.getByLabel("মোবাইল নম্বর").fill("01922222222");
  await theirs.getByLabel("পাসওয়ার্ড").fill("tasnim-pass");
  await theirs.getByRole("button", { name: "লগইন করো" }).click();
  await expect(theirs.locator("form [role=alert]")).toHaveText("তোমার অ্যাকাউন্টটি এখন বন্ধ আছে। শিক্ষকের সাথে যোগাযোগ করো।");
  await visitor.close();

  // Batches: the two there are, with their students; a new one; a name used twice is refused.
  await menu(page).getByRole("link", { name: "ব্যাচ", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/batches$/);
  const first = page.getByRole("listitem").filter({ hasText: "ক ব্যাচ" });
  await expect(first).toContainText("২ / ৪০ জন");
  await field(page, "ব্যাচের নাম").last().fill("ক ব্যাচ");
  await page.getByRole("button", { name: "ব্যাচ যোগ করুন" }).click();
  await expect(page.getByText("এই নামে এই কোর্সে একটি ব্যাচ আগেই আছে")).toBeVisible();
  await field(page, "ব্যাচের নাম").last().fill("গ ব্যাচ");
  await page.getByRole("button", { name: "ব্যাচ যোগ করুন" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "গ ব্যাচ" })).toContainText("০ জন");
  await shot(page, "dashboard-batches-1280");

  // A batch's list, by roll.
  await first.locator("summary").click();
  await first.getByRole("link", { name: "তালিকা" }).click();
  await expect(page).toHaveURL(/\/dashboard\/batches\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("row")).toHaveCount(3);
  await expect(page.getByRole("row").nth(1)).toContainText("রাহিম উদ্দিন");
  await expect(page.getByRole("row").nth(2)).toContainText("তাসনিম আক্তার");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test("the student pages and the new dashboard sections fit a 360px screen", async ({ page }) => {
    for (const path of ["/tanvir/join", "/tanvir/login", COURSE]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - 360), path).toBeLessThanOrEqual(0);
    }
    await teacherLogin(page);
    for (const path of ["/dashboard/requests", "/dashboard/students", "/dashboard/students/new", "/dashboard/batches"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - 360), path).toBeLessThanOrEqual(0);
    }
    await page.goto("/dashboard/students");
    await shot(page, "dashboard-students-360");
  });
});
