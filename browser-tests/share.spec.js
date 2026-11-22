const {test, expect} = require('@playwright/test');
const {publicURL} = require('../site/assets/js/share.js');
const route = '/functions/OCF-AUT-001/';
const canonical = 'https://ocfproject.org' + route;
const share = page => page.getByRole('button', {name: 'Share this page', exact: true});
const status = page => page.locator('[data-share-status]');

test('canonical URL strips all private query and fragment data', () => {
  expect(publicURL('https://ocfproject.org/functions/X/?private=yes#learned')).toBe('https://ocfproject.org/functions/X/');
  for (const url of ['javascript:alert(1)', 'https://example.com/', 'https://me@ocfproject.org/', '/relative']) expect(publicURL(url)).toBeNull();
});

test('one click copies the canonical link without opening a menu or native share', async ({page}) => {
  await page.addInitScript(() => {
    window.calls = [];
    Object.defineProperty(navigator, 'clipboard', {value: {writeText: async x => window.calls.push(x)}});
    Object.defineProperty(navigator, 'share', {value: async () => window.calls.push('native')});
  });
  await page.goto(route + '?learned=private&filter=secret#private');
  await expect(page.locator('.function-intro [data-page-share]')).toHaveCount(1);
  await expect(page.locator('footer [data-page-share]')).toHaveCount(0);
  await expect(page.locator('[data-page-share] button')).toHaveCount(1);
  expect(await page.evaluate(() => window.calls)).toEqual([]);
  await share(page).click();
  await expect(status(page)).toHaveText('Link copied.');
  await expect(share(page)).toBeFocused();
  expect(await page.evaluate(() => window.calls)).toEqual([canonical]);
  await expect(page.locator('[data-share-manual]')).toBeHidden();
});

test('clipboard rejection offers selected manual link and another attempt can succeed', async ({page}) => {
  await page.addInitScript(() => {
    window.allowCopy = false;
    Object.defineProperty(navigator, 'clipboard', {value: {writeText: async () => {
      if (!window.allowCopy) throw new Error('denied');
    }}});
  });
  await page.goto(route);
  await share(page).click();
  const input = page.getByLabel('Page link', {exact: true});
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(canonical);
  expect(await input.evaluate(el => el.selectionEnd - el.selectionStart)).toBe(canonical.length);
  await expect(status(page)).toContainText('Automatic copying is unavailable');
  await page.evaluate(() => window.allowCopy = true);
  await share(page).click();
  await expect(status(page)).toHaveText('Link copied.');
  await expect(input).toBeHidden();
});

test('a pending copy cannot dispatch twice and recovers', async ({page}) => {
  await page.addInitScript(() => {
    window.copies = 0;
    Object.defineProperty(navigator, 'clipboard', {value: {writeText: () => {
      window.copies++;
      return new Promise(resolve => { window.finishCopy = resolve; });
    }}});
  });
  await page.goto(route);
  await share(page).click();
  await expect(share(page)).toBeDisabled();
  await share(page).dispatchEvent('click');
  expect(await page.evaluate(() => window.copies)).toBe(1);
  await page.evaluate(() => window.finishCopy());
  await expect(share(page)).toBeEnabled();
  await expect(status(page)).toHaveText('Link copied.');
});

test('keyboard, mobile layout and no-JS progressive enhancement', async ({page, browser}) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {value: {writeText: async () => {}}}));
  await page.setViewportSize({width: 375, height: 812});
  await page.goto(route);
  await share(page).focus();
  await page.keyboard.press('Enter');
  await expect(status(page)).toHaveText('Link copied.');
  await expect(share(page)).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  const context = await browser.newContext({javaScriptEnabled: false});
  const plain = await context.newPage();
  await plain.goto(new URL(route, page.url()).href);
  await expect(plain.locator('[data-page-share]')).toBeHidden();
  await context.close();
});

test('404 has no sharing control', async ({page}) => {
  await page.goto('/404.html');
  await expect(page.locator('[data-page-share]')).toHaveCount(0);
});

test('public page types have a button; unavailable clipboard stays accessible on mobile', async ({page}) => {
  for (const pageRoute of ['/', '/functions/', '/function-chains/', '/about/']) {
    await page.goto(pageRoute);
    await expect(share(page)).toBeVisible();
  }
  await page.setViewportSize({width: 375, height: 812});
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {value: undefined}));
  await page.goto(route);
  await share(page).click();
  await expect(page.getByLabel('Page link', {exact: true})).toBeFocused();
  await page.addScriptTag({path: require.resolve('axe-core/axe.min.js')});
  const result = await page.evaluate(() => axe.run('[data-page-share]', {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa']}}));
  expect(result.violations).toEqual([]);
  await page.locator('[data-page-share]').screenshot({path: 'browser-artifacts/share-mobile.png'});
});
