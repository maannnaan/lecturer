import { type Page, expect, test } from "@playwright/test";

// Phase 8: what the OMR Scanner app talks to. Runs after phase7 on the same demo database: tanvir
// has a final paper "অর্ধবার্ষিক পরীক্ষা: বলবিদ্যা" of four MCQs in three sets, for the course
// where রাহিম উদ্দিন has roll 1 and নাফিসা রহমান roll 2 (whose typed-in sheet has 3 written marks).

const PAPER = "অর্ধবার্ষিক পরীক্ষা: বলবিদ্যা";

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

test.describe.configure({ mode: "serial" });

let token = "";
let paperId = "";
const auth = () => ({ authorization: `Bearer ${token}` });

test("the app signs in with the teacher's own number and password; nothing else gets in", async ({ request }) => {
  expect((await request.post("/api/omr/login", { data: { identifier: "01710000001", password: "not-the-password" } })).status()).toBe(401);
  const res = await request.post("/api/omr/login", { data: { identifier: "01710000001", password: "teacher-password" } });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.teacher).toMatchObject({ handle: "tanvir" });
  token = body.token;
  // Without a token, or with a made-up one, nothing is answered.
  expect((await request.get("/api/omr/papers")).status()).toBe(401);
  expect((await request.get("/api/omr/papers", { headers: { authorization: "Bearer made-up-token-000000000000" } })).status()).toBe(401);
});

test("it finds the final papers, and fetches one with every set's key, the sheet's layout and the students", async ({ request }) => {
  const list: { id: string; title: string }[] = await (await request.get(`/api/omr/papers?q=${encodeURIComponent("বলবিদ্যা")}`, { headers: auth() })).json();
  const found = list.find((p) => p.title === PAPER);
  expect(found).toMatchObject({ questions: 4, options: 4, setCount: 3, firstSet: "101", lastSet: "103" });
  paperId = found!.id;

  const paper = await (await request.get(`/api/omr/papers/${paperId}`, { headers: auth() })).json();
  expect(Object.keys(paper.sets)).toEqual(["101", "102", "103"]);
  for (const key of Object.values(paper.sets) as number[][]) expect(key).toHaveLength(4);
  expect(paper.layout).toMatchObject({ labels: "BANGLA", language: "Bangla", rollDigits: 2, setCode: true, examName: PAPER });
  // Rolls as the sheet's two-digit roll grid reads them.
  expect(paper.students).toContainEqual({ roll: "01", name: "রাহিম উদ্দিন" });
  expect(paper.students).toContainEqual({ roll: "02", name: "নাফিসা রহমান" });
});

test("scanned sheets are marked on the server and land on the teacher's results page", async ({ request, page }) => {
  const paper = await (await request.get(`/api/omr/papers/${paperId}`, { headers: auth() })).json();
  // নাফিসা's sheet, scanned: set 102, every answer right.
  const res = await request.post(`/api/omr/papers/${paperId}/results`, {
    headers: auth(),
    data: { sheets: [{ roll: "02", setCode: "102", marks: (paper.sets["102"] as number[]).join(","), scannedAt: Date.now() }, { roll: "02", setCode: "999", marks: "" }] },
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({
    saved: 1,
    sheets: [
      { roll: "02", ok: true, name: "নাফিসা রহমান", score: 4, total: 4 },
      { roll: "02", ok: false, error: "set" },
    ],
  });

  // Her written 3 stays: 4 + 3.
  await teacherLogin(page);
  await page.goto(`/dashboard/papers/${paperId}/results`);
  const row = page.getByRole("region", { name: "মেধাতালিকা" }).getByRole("row").filter({ hasText: "নাফিসা রহমান" });
  await expect(row).toContainText("১০২");
  await expect(row.getByRole("cell").nth(10)).toHaveText("৭");

  // Another teacher's sign-in can't reach this paper.
  const other = await (await request.post("/api/omr/login", { data: { identifier: "01710000002", password: "teacher-password" } })).json();
  expect((await request.get(`/api/omr/papers/${paperId}`, { headers: { authorization: `Bearer ${other.token}` } })).status()).toBe(404);
  expect((await request.post(`/api/omr/papers/${paperId}/results`, { headers: { authorization: `Bearer ${other.token}` }, data: { sheets: [{ roll: "01", setCode: "101", marks: "" }] } })).status()).toBe(404);

  // Signing out ends the app's session.
  expect((await request.post("/api/omr/logout", { headers: auth() })).status()).toBe(204);
  expect((await request.get("/api/omr/papers", { headers: auth() })).status()).toBe(401);
});

test("the dashboard's scanner page hands out the app and lists the papers it will find", async ({ page }) => {
  await teacherLogin(page);
  await page.getByRole("complementary", { name: "মেনু" }).getByRole("link", { name: "স্ক্যানার অ্যাপ" }).click();
  await expect(page).toHaveURL(/\/dashboard\/scanner$/);
  await expect(page.getByRole("link", { name: "অ্যাপ ডাউনলোড (Android)" })).toHaveAttribute("href", "https://github.com/maannnaan/OMR/releases/latest/download/omr-scanner.apk");
  const papers = page.getByRole("region", { name: "অ্যাপে যে প্রশ্নপত্রগুলো পাবেন" });
  await expect(papers.getByRole("listitem").filter({ hasText: PAPER })).toContainText(/^P-\d+/);
  await shot(page, "dashboard-scanner-1280");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test("the scanner page fits a 360px screen", async ({ page }) => {
    await teacherLogin(page);
    await page.goto("/dashboard/scanner");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - 360)).toBeLessThanOrEqual(0);
    await shot(page, "dashboard-scanner-360");
  });
});
