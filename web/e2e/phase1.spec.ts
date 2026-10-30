import { type Page, expect, test } from "@playwright/test";

// Screenshots for review go here when SHOTS_DIR is set; otherwise they're skipped.
const SHOTS = process.env.SHOTS_DIR;
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

const NEW_TEACHER = {
  nameBn: "মাহমুদ হাসান",
  nameEn: "Mahmud Hasan",
  phone: "01810000099",
  handle: "mr_x",
  subjects: "জীববিজ্ঞান",
  institution: "রাজশাহী",
  password: "a-long-password",
};

test.describe.configure({ mode: "serial" });

test("the landing page opens in Bangla and switches to English", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("আপনার ক্লাস, আপনার নিজের ওয়েবসাইট");
  await shot(page, "landing-bn-1280");
  await page.getByRole("button", { name: "EN" }).first().click();
  await expect(page.locator("h1")).toHaveText("Your classes, your own website");
  await page.getByRole("button", { name: "বাং" }).first().click();
  await expect(page.locator("h1")).toHaveText("আপনার ক্লাস, আপনার নিজের ওয়েবসাইট");
});

test("sign-up explains what's wrong, in Bangla, and keeps what was typed", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("button", { name: "নিবন্ধন করুন" }).click();
  await expect(page.locator("#nameBn-error")).toHaveText("এটি পূরণ করুন");
  await expect(page.locator("#handle-error")).toHaveText("এটি পূরণ করুন");

  await page.getByLabel("নাম (বাংলায়)").fill(NEW_TEACHER.nameBn);
  await page.getByLabel("নাম (ইংরেজিতে)").fill(NEW_TEACHER.nameEn);
  await page.getByLabel("মোবাইল নম্বর").fill("12345");
  await page.getByLabel("ওয়েবসাইটের ঠিকানা").fill("admin");
  await page.getByLabel("পাসওয়ার্ড").fill("short");
  await page.getByRole("button", { name: "নিবন্ধন করুন" }).click();
  await expect(page.locator("#phone-error")).toHaveText("সঠিক মোবাইল নম্বর দিন, যেমন 01712345678");
  await expect(page.locator("#handle-error")).toHaveText("এই ঠিকানাটি ব্যবহার করা যাবে না, অন্য একটি দিন");
  await expect(page.locator("#password-error")).toHaveText("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে");
  await expect(page.getByLabel("নাম (বাংলায়)")).toHaveValue(NEW_TEACHER.nameBn);
  await shot(page, "register-errors-1280");

  // A handle another teacher already has.
  await page.getByLabel("মোবাইল নম্বর").fill(NEW_TEACHER.phone);
  await page.getByLabel("ওয়েবসাইটের ঠিকানা").fill("tanvir");
  await page.getByLabel("পাসওয়ার্ড").fill(NEW_TEACHER.password);
  await page.getByRole("button", { name: "নিবন্ধন করুন" }).click();
  await expect(page.locator("#handle-error")).toHaveText("এই ঠিকানাটি আরেকজন নিয়ে নিয়েছেন");
});

test("a new teacher signs up, waits for approval, and can preview their own site", async ({ page, request }) => {
  await page.goto("/register");
  await page.getByLabel("নাম (বাংলায়)").fill(NEW_TEACHER.nameBn);
  await page.getByLabel("নাম (ইংরেজিতে)").fill(NEW_TEACHER.nameEn);
  await page.getByLabel("মোবাইল নম্বর").fill(NEW_TEACHER.phone);
  await page.getByLabel("ওয়েবসাইটের ঠিকানা").fill(NEW_TEACHER.handle);
  await page.getByLabel("যে বিষয়গুলো পড়ান").fill(NEW_TEACHER.subjects);
  await page.getByLabel("প্রতিষ্ঠান").fill(NEW_TEACHER.institution);
  await page.getByLabel("পাসওয়ার্ড").fill(NEW_TEACHER.password);
  await page.getByRole("button", { name: "নিবন্ধন করুন" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("status").getByText("অনুমোদনের অপেক্ষায়")).toBeVisible();
  await expect(page.locator(".theme-scope").first()).toHaveAttribute("data-style", "ink");
  await shot(page, "dashboard-pending-1280");

  // The owner sees their unapproved site with a notice; nobody else can.
  await page.goto(`/${NEW_TEACHER.handle}`);
  await expect(page.getByText("এটি শুধু আপনি দেখছেন।", { exact: false })).toBeVisible();
  expect((await request.get(`/${NEW_TEACHER.handle}`)).status()).toBe(404);
});

test("the admin approves the teacher, and the site goes public", async ({ page, request }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel("ইমেইল").fill("admin@lecturer.test");
  await page.getByLabel("পাসওয়ার্ড").fill("admin-password");
  await page.getByRole("button", { name: "লগইন করুন" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const card = page.getByRole("listitem").filter({ hasText: NEW_TEACHER.nameBn });
  await expect(card).toBeVisible();
  await shot(page, "admin-pending-1280");
  await card.getByRole("button", { name: "অনুমোদন" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: NEW_TEACHER.nameBn })).toHaveCount(0);

  await page.getByRole("link", { name: /অনুমোদিত/ }).click();
  await expect(page.getByRole("listitem").filter({ hasText: NEW_TEACHER.nameBn })).toBeVisible();

  const site = await request.get(`/${NEW_TEACHER.handle}`);
  expect(site.status()).toBe(200);
  expect(await site.text()).toContain(NEW_TEACHER.nameBn);
});

test("the teacher sees the approval and switches their theme", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("মোবাইল নম্বর বা ইমেইল").fill("+880 1810-000099");
  await page.getByLabel("পাসওয়ার্ড").fill(NEW_TEACHER.password);
  await page.getByRole("button", { name: "লগইন করুন" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("status").getByText("আপনার ওয়েবসাইট চালু আছে")).toBeVisible();
  await expect(page.getByText("ফ্রি ট্রায়াল: আর ১৪ দিন বাকি")).toBeVisible();
  await shot(page, "dashboard-approved-ink-1280");

  for (const [theme, label] of [
    ["mist", "কুয়াশা"],
    ["sage", "সবুজ পাতা"],
  ] as const) {
    await page.locator("form").filter({ has: page.locator(`input[name=theme][value=${theme}]`) }).getByRole("button").click();
    await expect(page.locator(".theme-scope").first()).toHaveAttribute("data-style", theme);
    await expect(page.getByText(label, { exact: true })).toBeVisible();
    await shot(page, `dashboard-approved-${theme}-1280`);
  }

  await page.goto(`/${NEW_TEACHER.handle}`);
  await expect(page.locator(".theme-scope").first()).toHaveAttribute("data-style", "sage");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(NEW_TEACHER.nameBn);
});

test("a wrong password is refused without saying which part was wrong", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("মোবাইল নম্বর বা ইমেইল").fill(NEW_TEACHER.phone);
  await page.getByLabel("পাসওয়ার্ড").fill("not-the-password");
  await page.getByRole("button", { name: "লগইন করুন" }).click();
  await expect(page.locator("form [role=alert]")).toHaveText("মোবাইল নম্বর/ইমেইল অথবা পাসওয়ার্ড মেলেনি");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test("pages fit a 360px screen without sideways scrolling", async ({ page }) => {
    for (const path of ["/", "/register", "/login", "/tanvir", "/nusrat"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - 360);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
    await page.goto("/");
    await shot(page, "landing-bn-360");
    await page.goto("/register");
    await shot(page, "register-360");
    await page.goto("/tanvir");
    await shot(page, "site-ink-360");
    await page.goto("/nusrat");
    await shot(page, "site-mist-360");

    await page.goto("/login");
    await page.getByLabel("মোবাইল নম্বর বা ইমেইল").fill("01710000002");
    await page.getByLabel("পাসওয়ার্ড").fill("teacher-password");
    await page.getByRole("button", { name: "লগইন করুন" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - 360)).toBeLessThanOrEqual(0);
    await shot(page, "dashboard-mist-360");
  });
});

test("teacher sites in each theme, on a desktop screen", async ({ page }) => {
  for (const handle of ["tanvir", "nusrat"]) {
    await page.goto(`/${handle}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await shot(page, `site-${handle}-1280`);
  }
});
