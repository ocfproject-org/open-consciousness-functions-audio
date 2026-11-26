const { expect, test, devices } = require("@playwright/test");
const axe = require("axe-core");

test("glossary searches aliases, preserves context and opens filtered entries from a deep link", async ({page}) => {
  await page.goto("/learn/glossary/");
  const search = page.getByRole("searchbox");
  const shown = page.locator(".learn-row:not([hidden])");
  await expect(page.locator("[data-learn-status]")).toHaveText("154 entries");
  await search.fill("ECB");
  for (const id of ["energy-conversion-box", "transmutation-box"]) await expect(page.locator("#" + id)).toBeVisible();
  await search.fill("rebal");
  for (const id of ["rebal", "monroe-rebal"]) await expect(page.locator("#" + id)).toBeVisible();
  await search.fill("focus 20");
  for (const id of ["focus-20-sleep", "focus-20-miranon"]) await expect(page.locator("#" + id)).toBeVisible();
  await search.fill("Plus Deflate");
  await expect(page.locator("#energy-ball-deflate")).toBeVisible();
  await search.fill("no-matching-phrase-ocf-9999");
  await expect(shown).toHaveCount(0);
  await expect(page.getByText("No entries match.", {exact:false})).toBeVisible();
  await page.evaluate(() => { location.hash = "energy-ball-deflate"; });
  const entry = page.locator("#energy-ball-deflate");
  await expect(entry.locator("details[data-learn-entry]")).toHaveAttribute("open", "");
  await expect(entry.getByRole("link", {name:"Open the current OCF guide"})).toHaveAttribute("href", "../../functions/OCF-EXP-007/");
  await expect(search).toHaveValue("");
  await expect(page.locator("#locale-3,#loosh,#m-band,#expand-app,#kepple-focus,#real-time-zone,#monroe-institute")).toHaveCount(0);
  const numbered = await page.locator("[id^='focus-'].learn-row").evaluateAll(rows =>
    rows.map(row => row.id).filter(id => /^focus-\d/.test(id)));
  expect(numbered.slice(0,4)).toEqual(["focus-1","focus-3","focus-10","focus-11"]);
  await page.getByRole("searchbox").fill("Expand App");
  await expect(page.locator("#expand-app")).toHaveCount(0);
  await page.getByRole("button",{name:"Reset",exact:true}).click();
  await expect(page.locator("[data-learn-status]")).toHaveText("154 entries");
  const summary = page.locator("#transmutation-box > details > summary");
  await expect(summary).toBeVisible();
  await summary.press("Enter");
  await expect(summary.locator("..")).toHaveAttribute("open", "");
});

test("mobile layout, FAQ filters, source aliases and historical provenance work", async ({browser}) => {
  const context = await browser.newContext(devices["Pixel 7"]);
  const page = await context.newPage();
  try {
    for (const path of ["/learn/","/learn/glossary/","/learn/faq/","/learn/sources/","/learn/history/miranon/"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.goto("/learn/faq/");
    await expect(page.locator("#blocked-not-paywall,#reddit-weight,#wayback-status")).toHaveCount(0);
    await expect(page.locator("#free-sources")).toBeVisible();
    await page.getByLabel("Content type").selectOption("Practice tip");
    await expect(page.locator("[data-learn-status]")).toHaveText("23 entries");
    await page.getByRole("button",{name:"Reset", exact:true}).click();
    await expect(page.locator("[data-learn-status]")).toHaveText("118 entries");
    await page.goto("/learn/sources/#RT");
    await expect(page.locator("#RT24 > details")).toHaveAttribute("open", "");
    await expect(page.locator("#RT24 a[href^='https://www.monroeinstitute.org/blogs/blog/how-resonant-tuning']")).toBeVisible();
    await expect(page.locator("a[href*='monroeinstitute.org/products/']")).toHaveCount(0);
    await page.goto("/learn/sources/#W77");
    await expect(page.locator("#W77 a[href^='https://archive.org/details/cia-readingroom-document']")).toBeVisible();
    await page.goto("/learn/sources/#SCI23-OPEN");
    await expect(page.locator("#EEG > details")).toHaveAttribute("open", "");
    await expect(page.getByRole("link", {name:"Public full text"}).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("searchbox").fill("excerpt only");
    const shown = await page.locator(".learn-row:not([hidden])").count();
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(130);
    await page.goto("/learn/history/miranon/#miranon-focus-22");
    await expect(page.locator("#miranon-focus-22 > details")).toHaveAttribute("open","");
    await expect(page.locator("#miranon-focus-22")).toContainText(/Erickson|Miranon/);
    expect(await page.locator("#focus-22").count()).toBe(0);
  } finally { await context.close(); }
});

test("static content is readable without JavaScript and active controls have semantic names", async ({browser,page}) => {
  const context = await browser.newContext({javaScriptEnabled:false});
  try {
    const staticPage = await context.newPage();
    await staticPage.goto("/learn/glossary/#transmutation-box");
    await expect(staticPage.getByRole("searchbox")).toHaveCount(0);
    const entry = staticPage.locator("#transmutation-box");
    await entry.locator("details > summary").first().click();
    await expect(entry.getByText(/OCF’s name for a mental container/)).toBeVisible();
  } finally { await context.close(); }
  await page.goto("/learn/faq/");
  await page.addScriptTag({ content: axe.source });
  const audit = await page.evaluate(() => axe.run("main", {runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]}}));
  expect(audit.violations.map(x => x.id)).toEqual([]);
});
