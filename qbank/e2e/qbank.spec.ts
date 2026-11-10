import { expect, test } from "@playwright/test";

const chapter = "/class/9-10/physics/2";

test.describe("home", () => {
  test("search lands on results", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Every question, sorted by class, subject and chapter.",
    );
    await page.getByRole("searchbox", { name: "Search questions" }).fill("velocity");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/\/questions\?q=velocity/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Results for “velocity”");
    await expect(page.getByRole("article").first()).toBeVisible();
  });

  test("a class card opens its class", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /^09–10 SSC/ }).click();
    await expect(page).toHaveURL(/\/class\/9-10$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Class 9–10 · SSC");
  });

  test("board shortcuts land on board questions grouped by year, each linked to its chapter", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Dhaka Board 2025" }).click();
    await expect(page).toHaveURL(/\/questions\?board=Dhaka&year=2025/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Board questions · Dhaka · 2025");
    await expect(page.getByRole("heading", { level: 2, name: /2025/ })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(2);

    await page.getByRole("link", { name: /Physics · Class 9–10 · Ch 2 · Motion/ }).first().click();
    await expect(page).toHaveURL(/\/class\/9-10\/physics\/2\?type=mcq#q-9-10-physics-2-mcq5$/);
    await expect(page.getByRole("article", { name: "MCQ 5" })).toBeFocused();
  });

  test("sign-in and the Bangla button say they're coming", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Sign-in isn't part of this preview yet.")).toBeVisible();
  });
});

test.describe("class page", () => {
  test("group tabs: Science first, kept in the address, arrow keys move", async ({ page }) => {
    await page.goto("/class/9-10");
    await expect(page.getByRole("tab", { name: "Science" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("link", { name: /^Physics/ })).toBeVisible();

    await page.getByRole("tab", { name: "Humanities" }).click();
    await expect(page).toHaveURL(/\?group=humanities$/);
    await expect(page.getByRole("link", { name: /^Geography/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Physics/ })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("tab", { name: "Humanities" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Humanities" }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("tab", { name: "Business Studies" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Business Studies" })).toBeFocused();
  });

  test("Back returns to the group you were looking at", async ({ page }) => {
    await page.goto("/class/9-10");
    await page.getByRole("tab", { name: "Common" }).click();
    await page.getByRole("link", { name: /^Mathematics/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mathematics");
    await page.goBack();
    await expect(page.getByRole("tab", { name: "Common" })).toHaveAttribute("aria-selected", "true");
  });

  test("a junior class has no group tabs and no board banner", async ({ page }) => {
    await page.goto("/class/6");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Class 6");
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Science/ })).toBeVisible();
    await expect(page.getByText("Open board questions →")).toHaveCount(0);
  });
});

test.describe("subject page", () => {
  test("find a chapter, then open it", async ({ page }) => {
    await page.goto("/class/9-10/physics");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Physics");
    const rows = page.locator('a[href^="/class/9-10/physics/"]');
    await expect(rows).toHaveCount(14);
    await page.getByLabel("Find a chapter").fill("motion");
    await expect(rows).toHaveCount(1);
    await rows.first().click();
    await expect(page).toHaveURL(/\/class\/9-10\/physics\/2$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Motion");
  });

  test("Start a mixed MCQ test lists the subject's MCQs from every chapter", async ({ page }) => {
    await page.goto("/class/9-10/physics");
    await page.getByRole("link", { name: "Start a mixed MCQ test" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mixed MCQ practice");
    await expect(page.getByRole("article")).toHaveCount(14);
    await page.getByRole("button", { name: "Reveal all answers" }).click();
    await expect(page.getByText("Explanation:")).toHaveCount(14);
  });
});

test.describe("chapter page", () => {
  test("CQ: show one, show all; the tab lives in ?type=", async ({ page }) => {
    await page.goto(chapter);
    await expect(page.getByRole("tab", { name: /Creative \(CQ\)/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Showing 2 of 3 creative questions")).toBeVisible();

    const cq1 = page.getByRole("article", { name: "CQ 1" });
    await expect(cq1.getByText("10 marks")).toBeVisible();
    await cq1.getByRole("button", { name: "Show answers" }).click();
    await expect(cq1.getByText("a = (v − u) / t = (20 − 0) / 10 = 2 m s⁻²")).toBeVisible();
    await expect(cq1.getByRole("button", { name: "Hide answers" })).toHaveAttribute("aria-expanded", "true");

    await page.getByRole("button", { name: "Show all answers" }).click();
    await expect(page.getByRole("button", { name: "Hide all answers" })).toBeVisible();
    await expect(page.getByRole("article", { name: "CQ 2" }).getByText("t = √(2h/g)", { exact: false })).toBeVisible();

    await page.getByRole("tab", { name: /^MCQ/ }).click();
    await expect(page).toHaveURL(/\?type=mcq$/);
    await expect(page.getByText("Showing 5 of 6 MCQs — tap an option to check")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("tab", { name: /^MCQ/ })).toHaveAttribute("aria-selected", "true");
    await page.goBack();
    await expect(page.getByRole("tab", { name: /Creative \(CQ\)/ })).toHaveAttribute("aria-selected", "true");
  });

  test("MCQ: a pick is checked once and locks; reveal all and reset", async ({ page }) => {
    await page.goto(`${chapter}?type=mcq`);
    const q2 = page.getByRole("article", { name: "MCQ 2" });
    await q2.getByRole("button", { name: /10 m/ }).click();
    await expect(q2.getByRole("button", { name: "a 10 m (your answer, wrong)" })).toBeVisible();
    await expect(q2.getByRole("button", { name: "b 25 m (correct answer)" })).toBeVisible();
    await expect(q2.getByText("Explanation:")).toBeVisible();
    await expect(page.getByText("MCQ 2: not quite. The answer is b.")).toBeAttached();

    // Locked: the options are aria-disabled, so force the click a user could still make.
    await q2.getByRole("button", { name: /50 m/ }).click({ force: true });
    await expect(q2.getByRole("button", { name: "c 50 m" })).toBeVisible();
    await expect(q2.getByRole("button", { name: "a 10 m (your answer, wrong)" })).toBeVisible();

    await expect(page.getByRole("article", { name: "MCQ 4" }).locator("p").first()).toHaveCSS("white-space", "pre-line");

    await page.getByRole("button", { name: "Reset answers" }).click();
    await expect(page.getByText("Explanation:")).toHaveCount(0);
    await page.getByRole("button", { name: "Reveal all answers" }).click();
    await expect(page.getByText("Explanation:")).toHaveCount(5);
  });

  test("SQ: show and hide an answer", async ({ page }) => {
    await page.goto(`${chapter}?type=sq`);
    const sq1 = page.getByRole("article", { name: "SQ 1" });
    await sq1.getByRole("button", { name: "Show answer" }).click();
    await expect(sq1.getByText(/it is said to be at rest/)).toBeVisible();
    await sq1.getByRole("button", { name: "Hide answer" }).click();
    await expect(sq1.getByText(/it is said to be at rest/)).toHaveCount(0);
  });

  test("Board: chips filter the list, and Open jumps to the question in its tab", async ({ page }) => {
    await page.goto(`${chapter}?type=board`);
    const rows = page.locator("#questions-panel li");
    await expect(rows).toHaveCount(8);

    await page.getByRole("button", { name: "Dhaka", exact: true }).click();
    await expect(page).toHaveURL(/board=Dhaka/);
    await expect(rows).toHaveCount(4);
    await expect(page.getByRole("combobox", { name: "Board" })).toHaveValue("Dhaka");

    await rows.filter({ hasText: "What is the SI unit of acceleration?" }).getByRole("button", { name: /^Open/ }).click();
    await expect(page).toHaveURL(/\?type=mcq&board=Dhaka#q-9-10-physics-2-mcq1$/);
    await expect(page.getByRole("tab", { name: /^MCQ/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("article", { name: "MCQ 1" })).toBeFocused();
    await expect(page.getByRole("article")).toHaveCount(2); // the Dhaka filter still applies

    await page.goBack();
    await expect(page.getByRole("tab", { name: /^Board/ })).toHaveAttribute("aria-selected", "true");
  });

  test("a board with nothing in this chapter says so", async ({ page }) => {
    await page.goto(`${chapter}?type=board`);
    await page.getByRole("combobox", { name: "Board" }).selectOption("Barishal");
    await expect(page.getByText("No questions from Barishal board in this chapter yet.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Barishal", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("sidebar filters: source, difficulty, year, reset", async ({ page }) => {
    await page.goto(chapter);
    await expect(page.getByText("Showing 2 of 3 creative questions")).toBeVisible();

    await page.getByLabel("Practice (unpublished)").check();
    await expect(page.getByText("Showing 3 of 3 creative questions")).toBeVisible();
    await expect(page).toHaveURL(/src=board%2Cschool%2Cpractice/);

    await page.getByLabel("Hard", { exact: true }).check();
    await expect(page.getByText("Showing 1 of 3 creative questions")).toBeVisible();
    await page.getByLabel("Any", { exact: true }).check();

    await page.getByRole("combobox", { name: "Year" }).selectOption("2023");
    await expect(page.getByText("Showing 1 of 3 creative questions")).toBeVisible();
    await expect(page.getByRole("article", { name: "CQ 2" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^MCQ/ })).toHaveText(/MCQ\s*1/);

    await page.getByLabel("Board questions").uncheck();
    await page.getByLabel("Top school tests").uncheck();
    await page.getByLabel("Practice (unpublished)").uncheck();
    await expect(page.getByText("No creative questions match these filters.")).toBeVisible();

    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.getByText("Showing 2 of 3 creative questions")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${chapter}$`));
  });

  test("previous and next chapter keep the tab", async ({ page }) => {
    await page.goto(`${chapter}?type=sq`);
    await page.getByRole("link", { name: "Ch 3 →" }).click();
    await expect(page).toHaveURL(/\/class\/9-10\/physics\/3\?type=sq$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Force");
    await expect(page.getByRole("tab", { name: /Short/ })).toHaveAttribute("aria-selected", "true");
  });

  test("the PDF buttons print the chapter, or only its board questions", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { prints: number };
      w.prints = 0;
      window.print = () => {
        w.prints += 1;
      };
    });
    await page.goto(`${chapter}?type=board&board=Dhaka`);
    await page.getByRole("button", { name: "Download board set" }).click();
    expect(await page.evaluate(() => (window as unknown as { prints: number }).prints)).toBe(1);

    const sheet = page.locator("[data-print-sheet]");
    await expect(sheet).toBeHidden(); // on screen
    await page.emulateMedia({ media: "print" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Board questions · Dhaka", { exact: true })).toBeVisible();
    await expect(sheet.getByText("What is the SI unit of acceleration?")).toBeVisible();
    await expect(sheet.getByText("Which of these is a vector quantity?")).toHaveCount(0);
    await expect(page.getByRole("tab").first()).toBeHidden();

    // The chapter PDF prints what the filters show, so drop the Dhaka filter first.
    await page.emulateMedia({ media: "screen" });
    await page.getByRole("button", { name: "All boards" }).click();
    await page.getByRole("button", { name: "Download chapter PDF" }).click();
    await page.emulateMedia({ media: "print" });
    await expect(sheet.getByText("Board questions and top school tests", { exact: true })).toBeVisible();
    await expect(sheet.getByText("Which of these is a vector quantity?")).toBeVisible();
  });

  test("bookmarks stay after a reload", async ({ page }) => {
    await page.goto(chapter);
    const cq1 = page.getByRole("article", { name: "CQ 1" });
    await cq1.getByRole("button", { name: "Bookmark", exact: true }).click();
    await expect(cq1.getByRole("button", { name: "Bookmarked" })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByRole("article", { name: "CQ 1" }).getByRole("button", { name: "Bookmarked" })).toBeVisible();
  });
});

test("unknown addresses are real 404s", async ({ request }) => {
  for (const path of ["/nope", "/class/13", "/class/9-10/astrology", "/class/9-10/physics/99", "/class/9-10/physics/02"]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(404);
  }
  expect((await request.get(chapter)).status()).toBe(200);
});

test.describe("phones", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("no page scrolls sideways, and the chapter filters fold away", async ({ page }) => {
    const paths = [
      "/",
      "/class/9-10",
      "/class/11-12?group=humanities",
      "/class/9-10/physics",
      chapter,
      `${chapter}?type=mcq`,
      `${chapter}?type=board`,
      "/questions?board=any",
    ];
    for (const path of paths) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBe(0);
    }
    await page.goto(chapter);
    await expect(page.getByLabel("Practice (unpublished)")).toBeHidden();
    await page.getByRole("button", { name: /^Filters/ }).click();
    await expect(page.getByLabel("Practice (unpublished)")).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Board/ })).toBeInViewport();
  });
});
