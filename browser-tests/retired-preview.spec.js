const {test, expect} = require('@playwright/test');

const preview = '/experiments/shared-clips-test/';

test('retired shared-clips preview shows a notice with no audition or media endpoints', async ({page, request}) => {
  await page.goto(preview);
  await expect(page.getByRole('heading', {name: 'Smart Play preview retired'})).toBeVisible();
  await expect(page.getByRole('link', {name: 'Browse & Listen'})).toHaveAttribute('href', '../../functions/');
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain(preview);
  for (const path of ['functions/OCF-FND-004/', 'data/inventory.json', 'virtual/options/OCF-FND-004']) {
    expect((await request.get(preview + path, {maxRedirects: 0})).status()).toBe(404);
  }
});

test('retired preview worker unregisters its own scope', async ({page}) => {
  await page.goto('/');
  const scope = await page.evaluate(async prefix => {
    const reg = await navigator.serviceWorker.register(prefix + 'worker.mjs?v=full-options-1', {
      type: 'module', scope: prefix, updateViaCache: 'none',
    });
    return reg.scope;
  }, preview);
  expect(new URL(scope).pathname).toBe(preview);
  await expect.poll(() => page.evaluate(async scope => (
    (await navigator.serviceWorker.getRegistrations()).some(reg => reg.scope === scope)
  ), scope)).toBe(false);
});
