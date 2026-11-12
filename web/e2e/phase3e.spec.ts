import { type Page, expect, test } from "@playwright/test";

// Phase 3e: the rich text editor, in the question bank and on the website's texts. Runs after
// phase3d on the same demo database: tanvir's HSC পদার্থবিজ্ঞান ১ম পত্র (class 1, subject 1),
// chapter 4 (নিউটনিয়ান বলবিদ্যা).

const UUID = "[0-9a-f-]{36}";

async function login(page: Page, phone: string) {
  await page.goto("/login");
  await page.getByLabel("মোবাইল নম্বর বা ইমেইল").fill(phone);
  await page.getByLabel("পাসওয়ার্ড").fill("teacher-password");
  await page.getByRole("button", { name: "লগইন করুন" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** An editor's text box and its toolbar, by the field's label (left pages stay mounted, hidden). */
const editor = (page: Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true });
const toolbar = (page: Page, label: string) => page.getByRole("toolbar", { name: `লেখার সাজ: ${label}` }).filter({ visible: true });

test.describe.configure({ mode: "serial" });

test("a question gets subscripts, bold words, an equation and a table, and students see them", async ({ page, request }) => {
  await login(page, "01710000001");
  await page.goto("/dashboard/bank");
  await page.getByRole("region", { name: /শ্রেণি বেছে/ }).getByRole("link").filter({ hasText: "এইচএসসি" }).click();
  await page.locator("#qb-subjects:visible > a").filter({ hasText: "পদার্থবিজ্ঞান ১ম পত্র" }).click();
  await page.getByRole("list", { name: "অধ্যায়" }).getByRole("link").filter({ hasText: "নিউটনিয়ান বলবিদ্যা" }).click();
  await page.getByRole("navigation", { name: "প্রশ্নের ধরন" }).getByRole("link").filter({ hasText: /^SQ/ }).click();
  await expect(page).toHaveURL(/tab=sq/);
  await page.getByRole("link", { name: /^নতুন / }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/bank\/new\?type=short/);

  const stem = editor(page, "প্রশ্ন");
  const tools = toolbar(page, "প্রশ্ন");
  await stem.click();
  await page.keyboard.type("পানি H");
  await tools.getByRole("button", { name: /নিচে ছোট লেখা/ }).click();
  await expect(tools.getByRole("button", { name: /নিচে ছোট লেখা/ })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.type("2");
  await tools.getByRole("button", { name: /নিচে ছোট লেখা/ }).click();
  await page.keyboard.type("O। ");
  await page.keyboard.press("Control+b");
  await page.keyboard.type("গতিশক্তি");
  await page.keyboard.press("Control+b");
  await page.keyboard.type(" হলো ");

  // The equation box: LaTeX in, the formula shown as it will look, then put in the text.
  await tools.getByRole("button", { name: "সমীকরণ" }).click();
  const box = page.getByRole("dialog", { name: "সমীকরণ" });
  await box.getByLabel("সমীকরণ (LaTeX)").fill("\\frac{1}{2}mv");
  await box.getByRole("button", { name: "x^{2}" }).click();
  await expect(box.getByLabel("সমীকরণ (LaTeX)")).toHaveValue("\\frac{1}{2}mvx^{2}");
  await box.getByLabel("সমীকরণ (LaTeX)").fill("\\frac{1}{2}mv^{2}");
  await expect(box.locator(".katex")).toBeVisible();
  await box.getByRole("button", { name: "বসান" }).click();
  await expect(box).toBeHidden();
  await expect(stem.locator(".rich-math .katex")).toBeVisible();

  // A table: the cursor starts in its first cell, Tab moves on.
  await page.keyboard.press("End");
  await tools.getByRole("button", { name: "টেবিল" }).click();
  await page.keyboard.type("ভর");
  await page.keyboard.press("Tab");
  await page.keyboard.type("বেগ");
  await expect(tools.getByRole("button", { name: "+ সারি" })).toBeVisible();
  await expect(stem.locator("table th").first()).toHaveText("ভর");

  // The preview draws it all as students will see it.
  const preview = page.locator(".q-card:visible");
  await expect(preview.locator("sub")).toHaveText("2");
  await expect(preview.locator("strong")).toHaveText("গতিশক্তি");
  await expect(preview.locator(".katex").first()).toBeVisible();
  await expect(preview.locator("table th").first()).toHaveText("ভর");

  await page.getByRole("button", { name: "প্রশ্ন যোগ করুন" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/bank/subject/${UUID}/${UUID}\\?tab=sq$`));
  const card = page.getByRole("article").filter({ hasText: "গতিশক্তি" });
  await expect(card.locator("sub")).toHaveText("2");

  // On the website: the same marks, typeset on the server.
  const site = await (await request.get("/tanvir/bank/1/1/4?tab=sq")).text();
  expect(site).toContain("H<sub>2</sub>O");
  expect(site).toContain("<strong>গতিশক্তি</strong>");
  expect(site).toMatch(/<th[^>]*><p>ভর<\/p><\/th>/);
  expect(site).toContain('class="katex"');

  // Opened again, the question shows in the editor as it was saved.
  await card.getByRole("link", { name: "সম্পাদনা" }).click();
  await expect(editor(page, "প্রশ্ন").locator("sub")).toHaveText("2");
  await expect(editor(page, "প্রশ্ন").locator("table")).toBeVisible();
});

test("an MCQ option takes maths and subscripts in a line, but no lists", async ({ page }) => {
  await login(page, "01710000001");
  await page.goto("/dashboard/bank/new?type=mcq");
  const option = toolbar(page, "অপশন ক");
  await expect(option.getByRole("button", { name: "সমীকরণ" })).toBeVisible();
  await expect(option.getByRole("button", { name: /নিচে ছোট লেখা/ })).toBeVisible();
  await expect(option.getByRole("button", { name: "বুলেট তালিকা" })).toHaveCount(0);
  await expect(option.getByRole("button", { name: "টেবিল" })).toHaveCount(0);
});

test("a notice with a list shows as a list on the website", async ({ page }) => {
  await login(page, "01710000001");
  await page.goto("/dashboard/notices");
  await page.getByLabel("শিরোনাম", { exact: true }).filter({ visible: true }).first().fill("এই সপ্তাহের ক্লাস");
  const body = page.locator("#notice-form-title").locator("xpath=..").getByLabel("বিস্তারিত", { exact: true });
  await body.click();
  await page
    .getByRole("toolbar", { name: "লেখার সাজ: বিস্তারিত" })
    .first()
    .getByRole("button", { name: "বুলেট তালিকা" })
    .click();
  await page.keyboard.type("রবিবার বিকেল ৪টা");
  await page.keyboard.press("Enter");
  await page.keyboard.type("দাম $10 থেকে $20 নয়");
  await page.getByRole("button", { name: "নোটিশ দিন" }).click();
  await expect(page.getByRole("status").filter({ hasText: "সংরক্ষিত" })).toBeVisible();
  // The form starts afresh for the next notice.
  await expect(body).toHaveText("");

  await page.goto("/tanvir");
  const notice = page.getByRole("listitem").filter({ hasText: "এই সপ্তাহের ক্লাস" });
  await expect(notice.locator("ul li")).toHaveText(["রবিবার বিকেল ৪টা", "দাম $10 থেকে $20 নয়"]);
  // A notice's dollar signs stay dollar signs.
  await expect(notice.locator(".katex")).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  test("the editors' toolbars wrap, and nothing scrolls sideways", async ({ page }) => {
    await login(page, "01710000001");
    for (const path of ["/dashboard/bank/new?type=creative", "/dashboard/notices", "/dashboard/website"]) {
      await page.goto(path);
      await expect(page.getByRole("toolbar").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - 360), path).toBeLessThanOrEqual(0);
    }
  });
});
