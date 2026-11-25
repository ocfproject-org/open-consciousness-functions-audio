const { test, expect } = require('@playwright/test');

const listening = '/listening/';
const retained = {
  'welcome-to-ocf': 'listening-guide',
  'what-ocf-is': 'project-overview',
  'a-comfortable-environment': 'before-listening',
};

test('Listening Guide and device headings link to unique native section destinations', async ({ page }) => {
  for (const path of [listening, ...['android', 'ios', 'windows', 'macos', 'linux'].map(x => listening + x + '/')]) {
    await page.goto(path);
    const headings = await page.locator('main .docs-content :is(h1, h2, h3, h4)').evaluateAll(elements =>
      elements.map(heading => ({
        id: heading.id || heading.closest('section[id]')?.id,
        text: heading.textContent.trim(),
        link: heading.querySelector(':scope > a.heading-permalink')?.getAttribute('href'),
      }))
    );
    const expected = headings.filter(x => x.id || x.link);
    expect(expected.length).toBeGreaterThan(2);
    for (const { id, text, link } of expected) {
      // The stereo section retains both its external section ID and aria-labelledby target.
      const target = id === 'stereo-test-title' ? 'stereo-test' : id;
      expect(link, text).toBe('#' + target);
      await expect(page.locator('[id="' + target + '"]')).toHaveCount(1);
    }
    if (path === listening) {
      const questions = page.locator('main h3 .heading-permalink').filter({ hasText: /\?$/ });
      expect(await questions.count()).toBeGreaterThan(3);
      for (const id of ['stereo-test', 'recommended-audio-settings', 'device-specific-setup', 'headphones-and-stereo']) {
        await expect(page.locator('main .heading-permalink[href="#' + id + '"]')).toBeVisible();
      }
    }
  }
});

test('keyboard activates a heading link and direct phone-sized links land on the requested content', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(listening);
  const link = page.locator('main h3 .heading-permalink').filter({ hasText: /\?$/ }).first();
  const hash = await link.getAttribute('href');
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => new URL(page.url()).hash).toBe(hash);
  await expect(page.locator(hash)).toBeInViewport();

  const generated = ['stereo-test', 'recommended-audio-settings', 'device-specific-setup'];
  const links = [hash.slice(1), ...generated].map(id => [id, id]);
  for (const [fragment, heading] of [...links, ...Object.entries(retained)]) {
    const fresh = await context.newPage();
    try {
      await fresh.setViewportSize({ width: 320, height: 740 });
      await fresh.goto(listening + '#' + fragment);
      await expect(fresh.locator('[id="' + fragment + '"]')).toHaveCount(1);
      const target = fresh.locator('[id="' + heading + '"]');
      await expect(target).toBeInViewport();
      expect(await target.evaluate(el => !el.closest('details:not([open])'))).toBe(true);
      await expect(fresh.locator('details.mobile-toc')).not.toHaveAttribute('open');
      expect(await fresh.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    } finally { await fresh.close(); }
  }
});

test('a self-link works without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 375, height: 800 } });
  try {
    const page = await context.newPage();
    await page.goto(listening + '#headphones-and-stereo');
    const heading = page.locator('main #headphones-and-stereo');
    await expect(heading).toBeInViewport();
    await heading.getByRole('link').click();
    await expect(page).toHaveURL(/#headphones-and-stereo$/);
  } finally { await context.close(); }
});

test('Smart Play FAQ links work on the generated public Smart Play guide', async ({ page, context }) => {
  await page.goto(listening);
  const feature = page.locator('main [id="smart-play"]');
  test.skip(!await feature.count(), 'Public Smart Play help is not enabled in this fixture');
  await expect(feature.getByRole('link', { name: 'Smart Play', exact: true })).toHaveAttribute('href', '#smart-play');
  const question = page.getByRole('heading', { name: "Why don't I see Smart Play settings or all the choices?", exact: true }).getByRole('link');
  const href = await question.getAttribute('href');
  const fresh = await context.newPage();
  try {
    await fresh.goto(listening + href);
    await expect(fresh.locator(href)).toBeInViewport();
    await expect(fresh.locator(href + ' + p')).toContainText('you can still play the Original recording');
  } finally { await fresh.close(); }
});
