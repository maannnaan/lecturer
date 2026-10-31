import { type Page, expect, test } from "@playwright/test";

// Phase 2: a teacher's website, courses with lesson plans, notices. Runs after phase1.spec.ts on
// the same demo database (tanvir: Ink, nusrat: Mist, rafi: Sage and still pending).

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

// The illustrated portrait from the Phase 0 mockups, as a stand-in for a teacher's real photo.
const PORTRAIT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EAE2D2"/><stop offset="1" stop-color="#DCCFB6"/></linearGradient></defs>
<rect width="400" height="500" fill="url(#g)"/>
<path fill="#1C5D5B" d="M34 500 C40 418 104 380 200 376 C296 380 360 418 366 500 Z"/>
<path fill="#FBF8F1" d="M163 380 L200 452 L237 380 C224 373 176 373 163 380 Z"/>
<path fill="#164B49" d="M163 380 L200 452 L178 474 L138 394 Z"/><path fill="#164B49" d="M237 380 L200 452 L222 474 L262 394 Z"/>
<path fill="#CFA07B" d="M174 318 L174 372 C186 392 214 392 226 372 L226 318 Z"/>
<ellipse fill="#E2B995" cx="129" cy="258" rx="13" ry="21"/><ellipse fill="#E2B995" cx="271" cy="258" rx="13" ry="21"/>
<ellipse fill="#E2B995" cx="200" cy="250" rx="71" ry="86"/>
<path fill="#2A2522" d="M128 246 C118 178 158 150 204 150 C252 150 288 178 272 246 C266 214 248 196 222 192 C200 189 182 200 160 196 C144 202 132 220 128 246 Z"/>
<circle fill="#2A2522" cx="169" cy="257" r="3.6"/><circle fill="#2A2522" cx="231" cy="257" r="3.6"/>
<g fill="rgba(255,255,255,.2)" stroke="#2A2522" stroke-width="4" stroke-linecap="round"><rect x="146" y="240" width="46" height="33" rx="11"/><rect x="208" y="240" width="46" height="33" rx="11"/><path fill="none" d="M192 254 Q200 248 208 254"/></g>
<path fill="none" stroke="#A9744E" stroke-width="4" stroke-linecap="round" d="M184 303 Q200 313 216 303"/></svg>`;

test.describe.configure({ mode: "serial" });

let courseEditUrl = "";

test("a teacher fills in their website and it shows on the public site", async ({ page, request }) => {
  await login(page, "01710000001");
  await page.getByRole("link", { name: "ওয়েবসাইট", exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/website$/);

  const profile = page.locator("form").filter({ has: page.locator("#profile-title") });
  await profile.getByLabel("এক লাইনে পরিচয়").fill("পদার্থবিজ্ঞান হোক আনন্দের বিষয়।");
  await profile.getByRole("button", { name: "সংরক্ষণ করুন" }).click();
  await expect(profile.getByRole("status")).toHaveText("সংরক্ষিত হয়েছে");

  // A half-filled figure is refused, and what was typed stays.
  const highlights = page.locator("form").filter({ has: page.locator("#highlights-title") });
  await highlights.getByLabel("সংখ্যা 4", { exact: true }).fill("");
  await highlights.getByLabel("কীসের 4", { exact: true }).fill("নতুন সংখ্যা");
  await highlights.getByRole("button", { name: "সংরক্ষণ করুন" }).click();
  await expect(highlights.locator("#stat3Value-error")).toHaveText("দুটো ঘরই পূরণ করুন");
  await expect(highlights.getByLabel("কীসের 4", { exact: true })).toHaveValue("নতুন সংখ্যা");

  // The photo goes through the real upload: shrunk in the browser, checked and stored by the server.
  const portrait = await page.context().newPage();
  await portrait.setContent(`<body style="margin:0">${PORTRAIT}</body>`);
  const png = await portrait.locator("svg").screenshot();
  await portrait.close();
  await page.locator("#photo-file").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("button", { name: "ছবি সরান" })).toBeVisible();
  await shot(page, "dashboard-website-ink-1280");

  const site = await (await request.get("/tanvir")).text();
  expect(site).toContain("পদার্থবিজ্ঞান হোক আনন্দের বিষয়।");
  const photo = site.match(/src="(\/media\/[^"]+\.(?:webp|jpg))"/)?.[1];
  expect(photo, "photo on the site").toBeTruthy();
  const image = await request.get(photo!);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toMatch(/^image\/(webp|jpeg)$/);
});

test("a teacher creates a paid course with a lesson plan, and students can see it", async ({ page, request }) => {
  await login(page, "01710000001");
  await page.goto("/dashboard/courses/new");
  await page.getByLabel("কোর্সের নাম").fill("জীববিজ্ঞান ১ম পত্র");
  await page.getByLabel("শ্রেণি বা স্তর").fill("এইচএসসি");
  await page.getByLabel("পেইড: বিকাশে টাকা পাঠিয়ে").check();
  await page.getByLabel("ওয়েবসাইটে দেখান").check();
  await page.getByRole("button", { name: "কোর্স তৈরি করুন" }).click();
  await expect(page.locator("#price-error")).toHaveText("পেইড কোর্সের দাম লিখুন");

  await page.getByLabel("দাম (টাকা)").fill("১,৫০০");
  await page.getByRole("button", { name: "কোর্স তৈরি করুন" }).click();
  await expect(page).toHaveURL(/\/dashboard\/courses\/[0-9a-f-]{36}$/);
  courseEditUrl = page.url();

  const add = page.locator("form").filter({ has: page.locator("input[name=courseId]") }).filter({ has: page.getByRole("button", { name: "অধ্যায় যোগ করুন" }) });
  await add.getByLabel("অধ্যায়ের নাম").fill("কোষ ও এর গঠন");
  await add.getByLabel("চলছে").check();
  await add.getByLabel("শুরু").fill("2026-11-01");
  await add.getByLabel("শেষ").fill("2026-11-20");
  await add.getByRole("button", { name: "অধ্যায় যোগ করুন" }).click();
  await expect(page.getByText("কোষ ও এর গঠন")).toBeVisible();
  await add.getByLabel("অধ্যায়ের নাম").fill("কোষ বিভাজন");
  await add.getByRole("button", { name: "অধ্যায় যোগ করুন" }).click();
  await expect(page.getByText("কোষ বিভাজন")).toBeVisible();
  await shot(page, "dashboard-course-edit-ink-1280");

  const home = await (await request.get("/tanvir")).text();
  expect(home).toContain("জীববিজ্ঞান ১ম পত্র");
  expect(home).toContain("৳ ১,৫০০ / মাস");

  const number = home.match(/\/tanvir\/courses\/(\d+)"[^>]*>জীববিজ্ঞান ১ম পত্র/)?.[1];
  expect(number).toBeTruthy();
  await page.goto(`/tanvir/courses/${number}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("জীববিজ্ঞান ১ম পত্র");
  await expect(page.getByText("১–২০ নভেম্বর")).toBeVisible();
  await expect(page.getByText("চলছে").first()).toBeVisible();
  await shot(page, "site-course-ink-1280");
});

test("courses can be reordered", async ({ page }) => {
  await login(page, "01710000001");
  await page.goto("/dashboard/courses");
  const titles = () => page.locator("main li a.text-lg").allTextContents();
  expect((await titles()).at(-1)).toBe("জীববিজ্ঞান ১ম পত্র");
  await page.getByRole("button", { name: "উপরে নিন: জীববিজ্ঞান ১ম পত্র" }).click();
  await expect.poll(async () => (await titles()).at(-2)).toBe("জীববিজ্ঞান ১ম পত্র");
});

test("a pinned notice tops the notice board", async ({ page, request }) => {
  await login(page, "01710000001");
  await page.goto("/dashboard/notices");
  const form = page.locator("form").filter({ has: page.locator("#notice-form-title") });
  await form.getByLabel("শিরোনাম").fill("আগামী শুক্রবার জীববিজ্ঞানের প্রথম ক্লাস");
  await form.getByLabel("উপরে আটকে রাখুন").check();
  await form.getByRole("button", { name: "নোটিশ দিন" }).click();
  await expect(page.getByText("আগামী শুক্রবার জীববিজ্ঞানের প্রথম ক্লাস").first()).toBeVisible();
  await shot(page, "dashboard-notices-ink-1280");

  const notices = await (await request.get("/tanvir/notices")).text();
  const newest = notices.indexOf("আগামী শুক্রবার জীববিজ্ঞানের প্রথম ক্লাস");
  const older = notices.indexOf("এ সপ্তাহে শুক্রবারের ক্লাস রবিবার বিকেল ৪টায় হবে।");
  expect(newest).toBeGreaterThan(-1);
  expect(older).toBeGreaterThan(newest);
});

test("another teacher can't open that course's editor", async ({ page }) => {
  await login(page, "01710000002");
  await page.goto(courseEditUrl);
  await expect(page.getByRole("heading", { name: "পাতাটি পাওয়া যায়নি" })).toBeVisible();
  await expect(page.getByText("জীববিজ্ঞান ১ম পত্র")).toHaveCount(0);
});

test("changing the website address keeps the old one working", async ({ page, request }) => {
  await login(page, "01710000002");
  await page.goto("/dashboard/website");
  const form = page.locator("form").filter({ has: page.locator("#address-title") });
  await form.locator("#handle").fill("admin");
  await form.getByRole("button", { name: "ঠিকানা বদলান" }).click();
  await expect(form.locator("#handle-error")).toHaveText("এই ঠিকানাটি ব্যবহার করা যাবে না, অন্য একটি দিন");
  await form.locator("#handle").fill("nusrat-chem");
  await form.getByRole("button", { name: "ঠিকানা বদলান" }).click();
  await expect(form.getByRole("status")).toHaveText("সংরক্ষিত হয়েছে");

  const old = await request.get("/nusrat/courses/1", { maxRedirects: 0 });
  expect(old.status()).toBe(308);
  expect(old.headers().location).toMatch(/\/nusrat-chem\/courses\/1$/);
  await page.goto("/nusrat-chem");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("নুসরাত জাহান");
  await shot(page, "site-home-mist-1280");
});

test("the pending teacher previews their own Sage site", async ({ page }) => {
  await login(page, "01710000003");
  await page.goto("/rafi");
  await expect(page.getByText("এটি শুধু আপনি দেখছেন।", { exact: false })).toBeVisible();
  await expect(page.locator(".theme-scope").first()).toHaveAttribute("data-style", "sage");
  await shot(page, "site-home-sage-1280");
});

test("the Ink site home, on a desktop screen", async ({ page }) => {
  await page.goto("/tanvir");
  await expect(page.locator(".portrait img")).toBeVisible();
  await shot(page, "site-home-ink-1280");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test("the websites and editors fit a 360px screen", async ({ page }) => {
    for (const path of ["/tanvir", "/tanvir/courses/1", "/tanvir/notices", "/nusrat-chem"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - 360), path).toBeLessThanOrEqual(0);
    }
    await page.goto("/tanvir");
    await shot(page, "site-home-ink-360");
    await page.goto("/nusrat-chem");
    await shot(page, "site-home-mist-360");

    await login(page, "01710000001");
    for (const path of ["/dashboard/website", "/dashboard/courses", courseEditUrl.replace(/^https?:\/\/[^/]+/, ""), "/dashboard/notices"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - 360), path).toBeLessThanOrEqual(0);
      // A repeated id silently ties a label to the wrong element, so the field loses its name.
      const repeated = await page.evaluate(() => {
        const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
        return ids.filter((id, i) => ids.indexOf(id) !== i);
      });
      expect(repeated, path).toEqual([]);
    }
    await page.goto("/dashboard/website");
    await shot(page, "dashboard-website-ink-360");
  });
});
