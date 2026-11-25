const { test, expect } = require('@playwright/test');

test('the website changelog is discoverable from normal pages and lists dated updates newest first', async ({ page, request }) => {
  for (const path of ['/', '/functions/OCF-FND-004/']) {
    await page.goto(path);
    const footerLink = page.getByRole('contentinfo').getByRole('link', { name: 'Website changelog', exact: true });
    await footerLink.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/changelog\/$/);
    await expect(page.getByRole('heading', { name: 'Website changelog', level: 1 })).toBeVisible();
  }

  const article = page.getByRole('main').locator('article');
  const titles = await article.getByRole('heading', { level: 2 }).allTextContents();
  expect(titles.length).toBeGreaterThanOrEqual(6);
  const dates = titles.map(title => {
    const [date, heading] = title.split(': ', 2);
    expect(heading).toBeTruthy();
    return Date.parse(date + ' UTC');
  });
  expect(dates.every(Number.isFinite)).toBe(true);
  expect(dates).toEqual([...dates].sort((a, b) => b - a));
  await expect(article.getByRole('heading', { name: /Smart Play$/ })).toBeVisible();
  await expect(article.getByRole('link', { name: 'published audio release notes' }))
    .toHaveAttribute('href', 'https://github.com/ocfproject-org/open-consciousness-functions-audio/releases');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain('<loc>https://ocfproject.org/changelog/</loc>');

  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'Website changelog', level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
