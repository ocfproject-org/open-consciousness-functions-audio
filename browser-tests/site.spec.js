const {openPreferences,closePreferences,selectPreference} = require('./preferences');
const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
let latestEdition;
let publishedCatalog;
test.beforeEach(async ({ request }) => {
  publishedCatalog = await request.get('/catalog.json').then(response => response.json());
  latestEdition = publishedCatalog.releases[0]?.version;
});

async function pinnedSource(page) {
  const pin = JSON.parse(await fs.readFile(path.join(__dirname, '../site/source.json'), 'utf8'));
  expect(pin.source_commit).toMatch(/^[a-f0-9]{40}$/);
  expect(pin.source_repository).toBe('https://github.com/ocfproject-org/open-consciousness-functions');
  const servedPin = await page.request.get('/source.json').then(response => response.json());
  expect(servedPin).toEqual(pin);
  const receipt = await page.request.get('/site-build-receipt.json').then(response => response.json());
  expect(receipt.source_commit).toBe(pin.source_commit);
  expect(receipt.source_repository).toBe(pin.source_repository);
  return pin;
}

async function pinnedGuide(page) {
  const pin = await pinnedSource(page);
  const guide = JSON.parse(await fs.readFile(process.env.GUIDE_EXPORT || 'public-guide-export.json', 'utf8'));
  expect(guide.source_commit).toBe(pin.source_commit);
  const receipt = await page.request.get('/site-build-receipt.json').then(response => response.json());
  expect(guide.build_receipt.export_content_sha256).toBe(receipt.guide_export_sha256);
  expect(guide.functions).toHaveLength(58);
  return guide;
}

async function noAxeViolations(page, context = undefined) {
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const result = await page.evaluate(async contextSelector => axe.run(contextSelector || document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  }), context);
  const details = result.violations.map(({ id, impact, nodes }) => `${id} (${impact}): ${nodes.map(node => node.target.join(' ')).join(', ')}`).join('\n');
  expect(result.violations, details).toEqual([]);
}

function silentWavDataURI(seconds = 3) {
  const sampleRate = 8000;
  const sampleCount = sampleRate * seconds;
  const wav = Buffer.alloc(44 + sampleCount, 128);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + sampleCount, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate, 28); wav.writeUInt16LE(1, 32); wav.writeUInt16LE(8, 34);
  wav.write('data', 36); wav.writeUInt32LE(sampleCount, 40);
  return `data:audio/wav;base64,${wav.toString('base64')}`;
}

async function useSilentWavFixture(page, fixtureURL = silentWavDataURI()) {
  await page.context().route(url => {
    let decoded;
    try { decoded = decodeURIComponent(url.href); } catch (_) { return false; }
    if (!/(?:\.mp3|\.flac)(?:$|[?#])/i.test(decoded)) return false;
    return /(?:^|\.)github\.com$|(?:^|\.)githubusercontent\.com$/.test(url.hostname) || /release-assets\.githubusercontent\.com$/i.test(url.hostname);
  }, route => route.abort());
  await page.addInitScript(fixture => {
    Object.defineProperty(HTMLAudioElement.prototype, 'src', {
      configurable: true,
      get() { return this.getAttribute('src') || ''; },
      set() { this.setAttribute('src', fixture); },
    });
  }, fixtureURL);
}

test('accessibility failure is detected by the same fail-closed gate', async ({ page }) => {
  await page.goto('/quick-reference/');
  await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<button></button>'));
  await expect(noAxeViolations(page)).rejects.toThrow();
});

test('all 58 generated function pages expose spoken cues only and pass axe', async ({ page }) => {
  test.setTimeout(120000); // Aggregate 58 page visits and axe scans; assertion timeouts are unchanged.
  const guide = await pinnedGuide(page);
  const index = await page.request.get('/documentation-index.json').then(response => response.json());
  expect(index.source_commit).toBe(guide.source_commit);
  expect(index.functions).toHaveLength(58);
  for (const row of index.functions) {
    const id = row.function_id;
    const source = guide.functions.find(item => item.function_id === id);
    expect(source).toBeDefined();
    const publicStatuses = ['canonical', 'reviewed'];
    expect(row.search_terms).toEqual([...source.tags, ...source.common_uses]
      .filter(item => publicStatuses.includes(item.status)).map(item => item.text));
    await page.goto(`/functions/${id}/`);
    await expect(page.locator('h1')).toBeVisible();
    for (const [target, label] of [['cues', 'How to use this function'], ['behavior', 'Use and duration']]) {
      await expect(page.locator(`#${target}`)).toHaveText(label);
      const links = page.locator(`.desktop-toc a[href="#${target}"], .mobile-toc a[href="#${target}"]`);
      await expect(links).toHaveCount(2);
      for (const link of await links.all()) await expect(link).toHaveText(label);
    }
    await expect(page.locator('.display-cue, .historical-commands, .historical-cue')).toHaveCount(0);
    await expect(page.locator('.draft-badge, .review-status, .status-line')).toHaveCount(0);
    const pageText = await page.locator('body').innerText();
    expect(pageText).not.toContain('Published audio available');
    expect(pageText).not.toContain('Draft metadata — not reviewed guidance');
    expect(pageText).not.toContain('description review status not recorded');
    expect(pageText).not.toContain('Procedure wording is not published while review is pending.');
    await expect(page.locator('.function-intro .lead')).toHaveText(`Documented practice intent: ${row.description}`);
    await expect(page.locator('.function-intro .lead')).toHaveCount(1);
    await expect(page.getByRole('heading', {name: 'Intended purpose', exact: true})).toHaveCount(0);
    await expect(page.getByRole('heading', {name: 'Purpose', exact: true})).toHaveCount(0);
      await expect(page.locator('.source-details')).toBeAttached();
    const blocks = page.locator('.command-block');
    for (const block of await blocks.all()) {
      const cue = block.locator('.spoken-cue strong');
      await expect(cue).toHaveCount(1);
      const text = await cue.textContent();
      expect(row.cues).toContain(text.trim());
      await expect(block.locator('button.copy-cue, button[aria-label^="Copy cue:"]')).toHaveCount(0);
    }
    expect(await blocks.locator('.spoken-cue strong').allTextContents()).toEqual(row.cues);
    expect(new Set(row.cues).size).toBe(row.cues.length);
    const uses = page.locator('details.discovery-details').filter({
      has: page.locator('summary', { hasText: 'Common-use examples' }),
    });
    const expectedUses = source.common_uses.filter(item => publicStatuses.includes(item.status)).map(item => item.text);
    await expect(uses.locator(':scope > ul > li')).toHaveText(expectedUses);
    if (expectedUses.length) await uses.locator(':scope > summary').click();
    const tags = page.locator('details.discovery-details').filter({
      has: page.locator('summary', { hasText: /^Tags$/ }),
    });
    await expect(tags.locator('li')).toHaveText(source.tags
      .filter(item => publicStatuses.includes(item.status)).map(item => item.text));
    const renderedDiscovery = await page.locator('.discovery-details li').allTextContents();
    for (const item of [...source.tags, ...source.common_uses].filter(item => !publicStatuses.includes(item.status))) {
      // A draft tag may also be an ordinary word in an approved description.
      // Check discovery entries, not arbitrary prose substrings.
      if (!row.search_terms.includes(item.text)) expect(renderedDiscovery).not.toContain(item.text);
    }
    await noAxeViolations(page);
  }
});

test('Sleep has no duplicate step or generic command filler, while distinct guidance remains', async ({ page }) => {
  await page.goto('/functions/OCF-SLP-002/');
  const guide = await pinnedGuide(page);
  const canonicalSteps = guide.functions.find(row => row.function_id === 'OCF-SLP-002')
    .commands.flatMap(command => command.procedure_steps.map(step => step.instruction));
  expect(canonicalSteps).toEqual([
    'Close your eyes.',
    'Take a deep breath in.',
    'Gently hold your breath.',
    'While holding your breath, silently say the command to yourself.',
    'Then slowly exhale and continue breathing naturally.',
    'Continue breathing naturally; keep your eyes closed.',
  ]);
  const renderedSteps = await page.locator('.command-block ol li').allTextContents();
  expect(renderedSteps).toEqual(canonicalSteps);
  expect(new Set(renderedSteps).size).toBe(renderedSteps.length);
  const sleepText = await page.locator('#cues').evaluate(element => element.parentElement.textContent);
  expect(sleepText).not.toContain('Display cues and spoken cues are different fields');
  expect(sleepText).not.toContain('Use only when you choose to activate the documented function.');
  expect(sleepText).not.toContain('This is the primary command for the function.');
  expect(sleepText).not.toContain('Choose the purpose for using this function.');
  expect(sleepText.match(/Close your eyes\./g)).toHaveLength(1);
  expect(await page.locator('#behavior').evaluate(element => element.parentElement.textContent)).toContain('temporary');
  expect(await page.locator('#behavior').evaluate(element => element.parentElement.textContent)).not.toContain('No additional lifecycle scopes are declared.');
  await expect(page.locator('#safety, a[href="#safety"]')).toHaveCount(0);
});

test('Insulate hold guidance uses the spoken Cancel cue without cue copy controls', async ({ page }) => {
  await page.goto('/functions/OCF-EXP-002/');
  const cancelCommand = page.locator('.command-block').filter({ has: page.locator('.spoken-cue strong', { hasText: 'Plus Cancel' }) });
  await expect(cancelCommand).toHaveCount(1);
  await expect(cancelCommand.locator('.spoken-cue strong')).toHaveText('Plus Cancel');
  await expect(cancelCommand.locator('button.copy-cue, button[aria-label^="Copy cue:"]')).toHaveCount(0);

  const releaseCommand = page.locator('.command-block').filter({ has: page.locator('.spoken-cue strong', { hasText: 'Plus Release' }) });
  await expect(releaseCommand).toHaveCount(1);
  const guidance = await releaseCommand.innerText();
  expect(guidance).toContain('Places Insulate on hold; Plus Cancel ends the current adjustment.');
  expect(guidance).not.toContain('PLUS-CANCEL');
  await expect(releaseCommand.locator('button.copy-cue, button[aria-label^="Copy cue:"]')).toHaveCount(0);
});

test('Start Here renders the approved suggestion as an ordered list and presents Preparation Learning first', async ({ page }) => {
  await page.goto('/start/');
  const headings = await page.locator('#main h2').allTextContents();
  await expect(page.locator('.start-steps strong').first()).toHaveText('Prepare');
  await expect(page.locator('.primary-action')).toHaveAttribute('href', '../preparation-learning/#listen');
  await page.locator('.start-more > summary').click();
  expect(headings.indexOf('Choose one practice')).toBeLessThan(headings.indexOf('A suggested way to explore'));
  const text = await page.locator('#main').innerText();
  expect(text).toContain('Complete Preparation Learning before using any OCF function.');
  expect(text).toContain('Only people who have already learned the official Human Plus preparation track may skip it.');
  expect(text).not.toContain('Michael');
  expect(text).not.toContain('not a verified official OCF policy');
  const sequence = page.locator('#main .start-more > ol');
  await expect(sequence).toHaveCount(1);
  const items = await sequence.locator('li').allTextContents();
  expect(items).toHaveLength(5);
  expect(items[0]).toContain('Relax — OCF-FND-004');
  expect(items[1]).toContain('Focus — OCF-FND-002');
  expect(items[2]).toContain('Imprint — OCF-COG-004');
  expect(items[3]).toContain('Recall — OCF-COG-006');
  expect(items[4]).toContain('Think Fast — OCF-COG-007');
  expect(text).not.toContain('distinguishes displayed cues from spoken cues');
  await expect(page.locator('.start-steps li').first()).toContainText('Complete Preparation Learning');
  expect(text).toContain('After Preparation Learning, these five functions can be approachable starting points:');
  expect(text).not.toContain('three functions');
  expect(text).toContain('You can explore these functions in any order;');
  expect(text).toContain('not a required sequence among them');
  await noAxeViolations(page);
  await page.goto('/');
  const homeText = await page.locator('main').innerText();
  const hero = await page.locator('.docs-hero').innerText();
  expect(homeText).toContain('Complete Preparation Learning before using any OCF function.');
  expect(homeText).toContain('Only people who have already learned the official Human Plus preparation track may skip it.');
  expect(homeText).not.toContain('Michael');
  expect(homeText).not.toContain('not a verified official OCF policy');
  await expect(page.locator('.desktop-nav a').first()).toHaveAttribute('href', 'start/');
  await expect(page.locator('.path-card').first()).toHaveAttribute('href', 'start/');
  await expect(page.locator('.desktop-nav a[href="preparation-learning/"]')).toHaveCount(0);
  await expect(page.locator('.path-card[href="preparation-learning/"]')).toHaveCount(0);
  await expect(page.locator('.docs-hero .button-light')).toHaveAttribute('href', 'start/');
  await expect(page.locator('.docs-hero a[href="preparation-learning/"]')).toHaveCount(0);
  await expect(page.locator('.desktop-nav a[href="functions/"]')).toHaveCount(1);
  const quickPath = page.locator('.home-utilities a[href="quick-reference/"]');
  await expect(quickPath).toContainText('current cues');
  await expect(quickPath).not.toContainText('display/spoken');
});

test('historical title map hides cue history, unchanged names and unmapped lists', async ({ page }) => {
  await page.goto('/historical-names/');
  const receipt = await page.request.get('/site-build-receipt.json').then(response => response.json());
  // Complete source provenance stays intact; the public map is a title-only projection.
  expect(receipt.historical_mapping_count).toBe(44);
  expect(receipt.historical_name_count).toBe(95);
  expect(receipt.historical_name_kind_counts).toEqual({
    'former-primary': 24, 'former-teaching': 35, 'former-title': 34, 'legacy-phrase': 2,
  });
  await expect(page.locator('[data-historical-name-entry]')).toHaveCount(32);
  await expect(page.locator('[data-historical-kind="former-title"]')).toHaveCount(32);
  await expect(page.locator('[data-also-current], [data-historical-kind="former-primary"], [data-historical-kind="former-teaching"]')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('historical_lookup.kind');
  await expect(page.locator('main')).not.toContainText('SHA-256');
  await expect(page.locator('main')).not.toContainText('these 15 functions');
  await expect(page.locator('.page-intro a[href*="../functions/"]')).toHaveCount(0);
  for (const id of ['OCF-SLP-005', 'OCF-BOD-002', 'OCF-COG-004', 'OCF-COG-006', 'OCF-FND-004', 'OCF-FND-005', 'OCF-SLP-001', 'OCF-SLP-002']) {
    await expect(page.locator(`[data-historical-name-entry][data-function-id="${id}"]`)).toHaveCount(0);
  }
  await expect(page.locator('[data-function-id="OCF-SEN-003"]')).toContainText('Sensory: Smell');
  const innerPower = page.locator('[data-historical-name-entry][data-function-id="OCF-PRF-002"]');
  await expect(innerPower).toContainText('Eight-Great');
  await expect(innerPower).not.toContainText('Plus Eight Great');
  await expect(innerPower).not.toContainText('PLUS-STRONG');
  await expect(page.locator('[data-function-id="OCF-BOD-006"] .historical-name-text')).toHaveCount(1);
  const pin = await pinnedSource(page);
  await expect(page.locator('a[href*="OCF_HISTORICAL_LOOKUP_CURRENT.md"]')).toHaveAttribute('href', `${pin.source_repository}/blob/${pin.source_commit}/docs/releases/OCF_HISTORICAL_LOOKUP_CURRENT.md`);
  await expect(page.locator('[data-historical-name-entry][data-function-id="OCF-PRF-006"]')).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await noAxeViolations(page);
  for (const id of ['OCF-BOD-004', 'OCF-BOD-009', 'OCF-SLP-005', 'OCF-PRF-002']) {
    await page.goto(`/functions/${id}/`);
    await expect(page.locator('[data-historical-name-entry], [data-also-current]')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText('Also current');
  }
  await expect(page.locator('.spoken-cue strong')).toContainText('Plus Inner Power');
});

test('five optional starter links are compact, accessible and survive navigation back', async ({ page }) => {
  const titles = ['Relax', 'Focus', 'Imprint', 'Recall', 'Think Fast'];
  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const links = page.locator('.starting-practices a');
    await expect(links).toHaveText(titles);
    await expect(page.locator('.home-paths')).toContainText('optional starting choices—not additional prerequisites');
    await expect(page.locator('.home-paths')).toContainText('official Human Plus preparation track');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    for (const link of await links.all()) {
      expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    const first = await links.first().boundingBox();
    const second = await links.nth(1).boundingBox();
    expect(Math.abs(first.y - second.y)).toBeLessThan(1);
    expect(Math.abs(first.x - (await page.locator('.home-paths > h2').boundingBox()).x)).toBeLessThan(1);
    await noAxeViolations(page);
    await links.first().focus();
    await page.keyboard.press('Tab');
    await expect(links.nth(1)).toBeFocused();
    expect(await links.nth(1).evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await links.filter({ hasText: 'Imprint' }).click();
    await expect(page.locator('h1')).toHaveText('Imprint');
    await page.goBack();
    await expect(page.locator('.starting-practices a')).toHaveText(titles);
    await page.locator('.starting-practices a').filter({ hasText: 'Recall' }).click();
    await expect(page.locator('h1')).toHaveText('Recall');
    await page.goBack();
    await expect(page.locator('.starting-practices a')).toHaveText(titles);
  }
});

test('related-practice directory retains all approved one-way records and their reasons', async ({ page }) => {
  await page.goto('/relationships/');
  const receipt = await page.request.get('/site-build-receipt.json').then(response => response.json());
  const rows = page.locator('.relationship-card');
  await expect(rows).toHaveCount(33);
  expect(receipt.approved_relationship_count).toBe(33);
  for (const row of await rows.all()) {
    await expect(row.locator('h3 a')).toHaveCount(2);
    await expect(row.locator('h3')).toContainText('→');
    await expect(row.locator('p').last()).not.toBeEmpty();
  }
  await expect(page.locator('.page-intro')).toContainText('optional and one-way');
});

test('Start Here leads the home paths while Preparation Learning stays available inside onboarding', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.docs-hero .button-light')).toHaveAttribute('href', 'start/');
  await expect(page.locator('.path-card').first()).toHaveAttribute('href', 'start/');
  await expect(page.locator('.path-card[href="preparation-learning/"]')).toHaveCount(0);
  await expect(page.locator('.desktop-nav a[href="preparation-learning/"]')).toHaveCount(0);
  await page.goto('/start/');
  await expect(page.locator('#main')).toContainText('Complete Preparation Learning before using any OCF function.');
  await expect(page.locator('#main')).toContainText('Only people who have already learned the official Human Plus preparation track may skip it.');
  await expect(page.locator('#main a[href="../preparation-learning/"]').first()).toBeVisible();
  await page.goto('/preparation-learning/');
  for (const player of await page.locator('.edition-card:visible audio').all()) await expect(player).toBeVisible();
  await expect(page.locator('.edition-card:visible audio')).toHaveCount(1);
});

test('homepage stays concise, keeps the legacy library fragment, and sends old function queries to Browse & Listen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('audio')).toHaveCount(0);
  await expect(page.locator('script[src*="assets/js/app.js"]')).toHaveCount(0);
  await expect(page.locator('#library')).toBeVisible();
  await expect(page.locator('.hero-actions a[href="functions/"]')).toContainText('Browse & Listen');
  await expect(page.locator('.category-link').first()).toBeVisible();
  await page.goto('/index.html#library');
  await expect(page).toHaveURL(/\/index\.html#library$/);
  await page.goto('/index.html?function=OCF-FND-004');
  await page.waitForURL(/\/functions\/\?function=OCF-FND-004$/);
  await expect(page.locator('#search')).toHaveValue('OCF-FND-004');
  await expect(page.locator('.session-card:visible h3')).toContainText('Relax');
});

test('Browse & Listen stays truthful without JavaScript or when catalog loading fails', async ({ page, browser, context }) => {
  const noScriptContext = await browser.newContext({javaScriptEnabled: false});
  const noScriptPage = await noScriptContext.newPage();
  await noScriptPage.goto('/functions/');
  await expect(noScriptPage.locator('.function-card')).toHaveCount(58);
  await expect(noScriptPage.locator('.function-card').first()).toContainText('Published recording available');
  await expect(noScriptPage.locator('.function-card').first().locator('.browse-action[href^="https://github.com/"]')).toHaveCount(2 * publishedCatalog.releases.length);
  await expect(noScriptPage.locator('audio')).toHaveCount(0);
  await noScriptContext.close();

  await context.route('**/browse-catalog.json', route => route.abort());
  await page.goto('/functions/');
  await expect(page.locator('.function-card')).toHaveCount(58);
  await expect(page.locator('#empty-state')).toContainText('could not be loaded');
  await expect(page.locator('#empty-state')).not.toContainText('No published recordings');
  await expect(page.locator('.function-card').first().locator('.browse-action[href^="https://github.com/"]')).toHaveCount(2 * publishedCatalog.releases.length);
  await expect(page.locator('audio')).toHaveCount(0);
});

test('mobile navigation stays readable, in-flow, keyboard-operable, and overflow-free through zoom widths', async ({ page }) => {
  await page.goto('/');
  for (const width of [160, 320, 360, 375, 390, 414, 760, 768, 820, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const viewportOverflow = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      nodes: [...document.querySelectorAll('body *')]
        .map(element => ({
          tag: element.tagName,
          className: String(element.className || ''),
          text: element.innerText?.slice(0, 60),
          rect: (() => { const {left, right, width: elementWidth} = element.getBoundingClientRect(); return {left, right, width: elementWidth}; })(),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        }))
        .filter(element => element.rect.left < -1 || element.rect.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1)
        .slice(0, 12),
    }));
    expect(viewportOverflow.width, `horizontal overflow at ${width}px: ${JSON.stringify(viewportOverflow.nodes)}`).toBeLessThanOrEqual(width);
    const header = await page.locator('.site-header').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
    });
    expect(header.left).toBeGreaterThanOrEqual(0);
    expect(header.right).toBeLessThanOrEqual(width + 1);
    expect(header.scrollWidth).toBeLessThanOrEqual(header.clientWidth + 1);
    if (width <= 1080) {
      await expect(page.locator('.mobile-nav > summary')).toBeVisible();
      await expect(page.locator('.desktop-nav')).toBeHidden();
    } else {
      await expect(page.locator('.mobile-nav')).toBeHidden();
      await expect(page.locator('.desktop-nav')).toBeVisible();
    }
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  expect(await page.locator('.site-header').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.evaluate(() => { document.documentElement.style.removeProperty('font-size'); });
  await page.goto('/start/');
  await expect(page.locator('.desktop-nav a[aria-current="page"]')).toHaveText('Start Here');
  await page.goto('/functions/');
  await expect(page.locator('.desktop-nav a[aria-current="page"]')).toHaveText('Browse & Listen');
  await page.goto('/functions/OCF-BOD-001/');
  await expect(page.locator('.desktop-nav a[aria-current="location"]')).toHaveText('Browse & Listen');
  await expect(page.locator('.breadcrumbs [aria-current="page"]')).toHaveText('Brain Flow');
  await page.goto('/downloads/');
  await expect(page.locator('.desktop-nav .more-links a[aria-current="page"]')).toHaveText('Downloads');

  await page.goto('/');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => localStorage.setItem('ocf-theme', 'light'));
  await page.reload();
  const menu = page.locator('.mobile-nav');
  const summary = menu.locator(':scope > summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('open', '');
  expect(await menu.locator('nav').evaluate(element => getComputedStyle(element).position)).toBe('static');
  expect(await menu.locator('nav').evaluate(element => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(
    await page.locator('main').evaluate(element => element.getBoundingClientRect().top),
  );
  await page.keyboard.press('Tab');
  await expect(menu.locator('a').first()).toBeFocused();
  await expect(menu.locator('a').first()).toHaveAttribute('href', 'start/');
  await expect(menu.locator('a[href="preparation-learning/"]')).toHaveCount(0);
  expect(await menu.locator('a').count()).toBe(14);
  await expect(menu.getByRole('link',{name:'Affirmations',exact:true})).toHaveAttribute('href','affirmations/');
  await expect(menu.getByRole('link',{name:'My Morning',exact:true})).toHaveAttribute('href','my-morning/');
  const primaryLinks = menu.locator('nav[aria-label="Main navigation"] > a');
  await expect(primaryLinks).toHaveCount(14);
  const linkRects = await primaryLinks.evaluateAll(links => links.map(link => {
    const { x, right, height } = link.getBoundingClientRect();
    return { x, right, height };
  }));
  for (const rect of linkRects) {
    expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(375);
  }
  expect((await summary.boundingBox()).height).toBeGreaterThanOrEqual(44);
  for (const link of await primaryLinks.all()) await expect(link).toBeVisible();
  await expect(menu.locator('.more-menu')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await fs.mkdir('browser-artifacts', { recursive: true });
  await page.screenshot({ path: path.join('browser-artifacts', 'mobile-menu-light-375.png'), fullPage: false });
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open', '');
  await expect(summary).toBeFocused();

  await summary.click();
  await expect(menu).toHaveAttribute('open', '');
  await page.locator('.site-footer p').click();
  await expect(menu).not.toHaveAttribute('open', '');

  await openPreferences(page);
  await page.locator('.theme-toggle').click();
  await closePreferences(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await summary.click();
  await page.screenshot({ path: path.join('browser-artifacts', 'mobile-menu-dark-375.png'), fullPage: false });
  await noAxeViolations(page, '.site-header');
  await page.keyboard.press('Escape');
});

test('Downloads cards keep the selected individual format action visible and named across viewport widths', async ({ page }) => {
  await page.goto('/downloads/');
  const receipt = await page.request.get('/site-build-receipt.json').then(response => response.json());
  await expect(page.locator('.download-card')).toHaveCount(receipt.published_session_count);
  await expect(page.locator('.reference-table')).toHaveCount(0);

  const catalog = await page.request.get('/catalog.json').then(response => response.json());
  const release = catalog.releases[0];
  for (const [functionId, title] of [['OCF-FND-004', 'Relax'], ['OCF-BOD-001', 'Brain Flow']]) {
    const session = release.functions.find(row => row.function_id === functionId).sessions[0];
    const card = page.locator(`.download-card[data-function-id="${functionId}"][data-edition="${session.edition}"]`);
    await page.locator('#download-search').fill(title);
    await expect(card.locator('h2')).toContainText(title);
    for (const format of ['mp3', 'flac']) {
      await selectPreference(page,'Audio format',format);
      const asset = session.assets.find(item => item.format === format);
      const link = card.getByRole('link', { name: new RegExp(`^Download ${format.toUpperCase()} for ${title},`) });
      await expect(link).toHaveAttribute('href', asset.download_url);
      await expect(link).toContainText(`Download ${format.toUpperCase()}`);
      await expect(card).toContainText(asset.sha256);
    }
  }

  await page.locator('#download-search').fill('');
  for (const width of [320, 375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
      cards: [...document.querySelectorAll('.download-card:not([hidden])')].map(card => {
        const cardRect = card.getBoundingClientRect();
        const actions = [...card.querySelectorAll('.download-action')].filter(link => link.getClientRects().length).map(link => {
          const rect = link.getBoundingClientRect();
          return { left: rect.left, right: rect.right, width: rect.width };
        });
        return { width: cardRect.width, scrollWidth: card.scrollWidth, clientWidth: card.clientWidth, actions };
      }),
    }));
    expect(layout.pageWidth, `document overflow at ${width}px`).toBeLessThanOrEqual(width);
    expect(layout.cards).toHaveLength(12);
    for (const card of layout.cards) {
      expect(card.width).toBeGreaterThan(0);
      expect(card.scrollWidth, `card overflow at ${width}px`).toBeLessThanOrEqual(card.clientWidth + 1);
      expect(card.actions.length).toBeGreaterThanOrEqual(1);
      for (const action of card.actions) {
        expect(action.width).toBeGreaterThan(0);
        expect(action.left).toBeGreaterThanOrEqual(-1);
        expect(action.right).toBeLessThanOrEqual(layout.viewport + 1);
      }
    }
    if (width === 390 || width === 1440) {
      await fs.mkdir('browser-artifacts', { recursive: true });
      await page.screenshot({ path: path.join('browser-artifacts', `checkpoint1-downloads-${width}.png`), fullPage: true });
    }
  }
  await noAxeViolations(page);
});

test('manual and system theme combinations keep banner, hover and focus contrast; forced colors and reduced motion remain usable', async ({ page }) => {
  const contrast = (foreground, background) => {
    const channel = value => {
      const n = value / 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    };
    const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = color => {
      const [r, g, b] = rgb(color).map(channel);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  for (const osTheme of ['light', 'dark']) {
    for (const preference of ['light', 'dark', 'black', 'system']) {
      await page.emulateMedia({ colorScheme: osTheme });
      await page.goto('/functions/');
      await page.evaluate(value => localStorage.setItem('ocf-theme', value), preference);
      await page.reload();
      const expected = preference === 'system' ? 'System' : preference[0].toUpperCase() + preference.slice(1);
      const themeButton = page.getByRole('button', { name: `Color theme: ${expected}. Activate to change.` });
      await openPreferences(page);
      await expect(themeButton).toBeVisible();
      await closePreferences(page);
      const resolved = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      expect(resolved).toBe(preference === 'system' ? null : preference);
      const banner = page.locator('.release-banner');
      await expect(banner).toBeVisible();
      const colors = await page.evaluate(() => {
        const banner = document.querySelector('.release-banner');
        const background = getComputedStyle(banner).backgroundColor;
        return ['h2', '.eyebrow', 'p:not(.eyebrow)', '.text-link'].map(selector => ({
          selector, foreground: getComputedStyle(banner.querySelector(selector)).color, background,
        }));
      });
      for (const item of colors) expect(contrast(item.foreground, item.background), `${preference}/${osTheme} ${item.selector}`).toBeGreaterThanOrEqual(4.5);
      const releaseLink = banner.locator('.text-link');
      await releaseLink.hover();
      const hoverColors = await releaseLink.evaluate(link => ({
        foreground: getComputedStyle(link).color,
        background: getComputedStyle(link.closest('.release-banner')).backgroundColor,
      }));
      expect(contrast(hoverColors.foreground, hoverColors.background), `${preference}/${osTheme} hovered link`).toBeGreaterThanOrEqual(4.5);
      await openPreferences(page);
      await themeButton.focus();
      const focusColors = await themeButton.evaluate(button => ({ ring: getComputedStyle(button).outlineColor, background: getComputedStyle(button).backgroundColor }));
      expect(contrast(focusColors.ring, focusColors.background), `${preference}/${osTheme} focus ring`).toBeGreaterThanOrEqual(3);
      await closePreferences(page);
      await page.goto('/functions/OCF-BOD-001/');
      await page.locator('.source-details summary').click();
      const documentationLink = page.locator('.docs-content .source-details a').first();
      await documentationLink.hover();
      const documentationHover = await page.evaluate(link => ({
        foreground: getComputedStyle(link).color,
        background: getComputedStyle(document.body).backgroundColor,
      }), await documentationLink.elementHandle());
      expect(contrast(documentationHover.foreground, documentationHover.background), `${preference}/${osTheme} documentation-link hover`).toBeGreaterThanOrEqual(4.5);

      await page.goto('/downloads/');
      const cardSurfaces = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const expectedValue = root.getPropertyValue('--card').trim();
        const probe = document.createElement('div');
        probe.style.backgroundColor = expectedValue;
        document.body.append(probe);
        const expected = getComputedStyle(probe).backgroundColor;
        probe.remove();
        const card = document.querySelector('.download-card');
        return {
          expected,
          card: getComputedStyle(card).backgroundColor,
          foreground: getComputedStyle(card.querySelector('h2')).color,
        };
      });
      expect(cardSurfaces.card, `${preference}/${osTheme} Downloads card surface`).toBe(cardSurfaces.expected);
      expect(contrast(cardSurfaces.foreground, cardSurfaces.card), `${preference}/${osTheme} Downloads card title`).toBeGreaterThanOrEqual(4.5);
      const moreMenu = page.locator('.desktop-nav .more-menu');
      await moreMenu.locator(':scope > summary').click();
      const menuSurfaces = await moreMenu.locator('.more-links').evaluate(menu => ({
        background: getComputedStyle(menu).backgroundColor,
        foreground: getComputedStyle(menu.querySelector('a')).color,
      }));
      expect(menuSurfaces.background, `${preference}/${osTheme} More menu must be opaque`).toBe(cardSurfaces.expected);
      expect(contrast(menuSurfaces.foreground, menuSurfaces.background), `${preference}/${osTheme} More menu text`).toBeGreaterThanOrEqual(4.5);
    }
  }
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await openPreferences(page);
  await page.keyboard.press('Tab');
  await page.getByRole('button', { name: /Color theme/ }).focus();
  const modes = await page.evaluate(() => ({
    forcedColors: matchMedia('(forced-colors: active)').matches,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    outlineStyle: getComputedStyle(document.activeElement).outlineStyle,
    outlineWidth: getComputedStyle(document.activeElement).outlineWidth,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    transitionDuration: getComputedStyle(document.activeElement).transitionDuration,
  }));
  expect(modes.forcedColors).toBe(true);
  expect(modes.reducedMotion).toBe(true);
  expect(modes.outlineStyle).not.toBe('none');
  expect(parseFloat(modes.outlineWidth)).toBeGreaterThan(0);
  expect(modes.scrollBehavior).toBe('auto');
  await closePreferences(page);
  await noAxeViolations(page, '.site-header');
});

test('current-cue search normalizes separators, offers clear/no-results, and keeps historical labels out', async ({ page }) => {
  await page.goto('/functions/');
  const search = page.locator('#search');
  for (const query of ['PLUS-RELAX', '  Plus   Relax  ', 'plus—relax']) {
    await search.fill(query);
    await expect(page.locator('.session-card:visible')).toHaveCount(1);
    await expect(page.locator('.session-card:visible h3')).toContainText('Relax');
  }
  await search.fill('no-such-current-cue');
  await expect(page.locator('#catalog-no-results')).toBeVisible();
  await expect(page.locator('#clear-library-filters')).toBeVisible();
  await page.locator('#clear-library-filters').click();
  await expect(search).toHaveValue('');
  await expect(page.locator('.session-card:visible')).toHaveCount(59);

  await search.fill('PLUS-STRONG');
  await expect(page.locator('.session-card:visible')).toHaveCount(1);
  await expect(page.locator('.session-card:visible h3')).toContainText('Strong-Quick');

  const directory = await page.request.get('/documentation-index.json').then(response => response.json());
  const relaxCategory = directory.functions.find(row => row.function_id === 'OCF-FND-004').categories[0];
  await page.locator('#clear-library-filters').click();
  await page.locator('#category-filter').selectOption(relaxCategory);
  const categoryFunctionIds = directory.functions.filter(row => row.categories.includes(relaxCategory)).map(row => row.function_id);
  const visibleFunctionIds = await page.locator('.session-card:visible').evaluateAll(cards => cards.map(card => card.dataset.functionId));
  expect(visibleFunctionIds.length).toBeGreaterThan(0);
  expect(visibleFunctionIds.every(id => categoryFunctionIds.includes(id))).toBe(true);
  await expect(page.locator(`.session-card[data-edition="${latestEdition}"][data-function-id="OCF-FND-004"]`)).toBeVisible();

  await page.goto('/quick-reference/');
  const referenceSearch = page.locator('[data-reference-search]');
  await referenceSearch.fill('  PLUS---RELAX  ');
  await expect(page.locator('[data-reference-row]:visible')).toHaveCount(1);
  await expect(page.locator('[data-reference-row]:visible')).toContainText('Plus Relax');
  await referenceSearch.fill('no-such-current-cue');
  await expect(page.locator('[data-reference-no-results]')).toBeVisible();
  await expect(page.locator('[data-reference-clear]')).toBeVisible();
  await page.locator('[data-reference-clear]').click();
  await expect(referenceSearch).toHaveValue('');
  await expect(page.locator('[data-reference-row]:visible')).toHaveCount(58);
  await noAxeViolations(page, '.reference-tools');
});

test('filtered-out synthetic media remains focused, understandable, seekable and resumable after pause and end', async ({ page }) => {
  const audioRequests = [];
  page.on('request', request => { if (/\.(?:mp3|flac)(?:$|[?#])/i.test(request.url())) audioRequests.push(request.url()); });
  await useSilentWavFixture(page);
  await page.goto('/functions/');
  const relax = page.locator(`.session-card[data-edition="${latestEdition}"]`).filter({ has: page.getByRole('link', { name: 'Relax', exact: true }) });
  await relax.getByRole('button', {name: /^Show player for/}).click();
  const player = relax.locator('audio');
  await expect(player).toBeAttached();
  await player.evaluate(audio => audio.load());
  await expect.poll(() => player.evaluate(audio => audio.duration)).toBeGreaterThan(2.9);
  await player.evaluate(audio => { audio.dataset.fixtureIdentity = 'relax-synthetic-wav'; });
  const fixtureControl = await relax.evaluate(card => {
    const player = card.querySelector('audio');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.fixturePlaybackControl = '';
    button.textContent = 'Play synthetic test media';
    button.addEventListener('click', async () => {
      if (player.paused || player.ended) await player.play();
      else player.pause();
    });
    card.append(button);
    return button.dataset.fixturePlaybackControl;
  });
  expect(fixtureControl).toBe('');
  const fixtureButton = relax.locator('[data-fixture-playback-control]');
  await fixtureButton.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => player.evaluate(audio => audio.paused)).toBe(false);
  await player.evaluate(audio => { audio.currentTime = 0.6; });
  await player.evaluate(audio => audio.dispatchEvent(new Event('timeupdate')));
  const positionBeforeFilter = await player.evaluate(audio => audio.currentTime);
  await player.focus();
  const focusedBeforeFilter = await player.evaluate(audio => document.activeElement === audio);
  expect(focusedBeforeFilter).toBe(true);
  await page.locator('#search').evaluate(input => {
    input.value = 'OCF-BOD-001';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#results-count')).toContainText('1 matching');
  await expect(relax).toBeVisible();
  await expect(relax.locator('[data-filter-pinned]')).toContainText('Playing Relax');
  expect(await player.evaluate(audio => audio.isSameNode(document.querySelector('.session-card[data-function-id="OCF-FND-004"] audio')))).toBe(true);
  expect(await player.evaluate(audio => document.activeElement === audio)).toBe(true);
  await fixtureButton.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => player.evaluate(audio => audio.paused)).toBe(true);
  await expect(relax.locator('[data-filter-pinned]')).toContainText('Paused at 0:');
  const pausedPosition = await player.evaluate(audio => audio.currentTime);
  expect(pausedPosition).toBeGreaterThanOrEqual(positionBeforeFilter);
  expect(pausedPosition).toBeLessThan(2.9);
  expect(await player.evaluate(audio => audio.isConnected)).toBe(true);
  expect(await fixtureButton.evaluate(button => document.activeElement === button)).toBe(true);
  await page.locator('#search').evaluate(input => {
    input.value = 'OCF-FND-004';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(relax).toBeVisible();
  await expect(relax.locator('[data-filter-pinned]')).toBeHidden();
  await page.locator('#search').focus();
  await page.locator('#search').evaluate(input => {
    input.value = 'OCF-BOD-001';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(relax).toBeVisible();
  await expect(relax.locator('[data-filter-pinned]')).toContainText('Paused at 0:');
  await fixtureButton.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => player.evaluate(audio => audio.paused)).toBe(false);
  expect(await player.evaluate(audio => audio.currentTime)).toBeGreaterThanOrEqual(pausedPosition);
  await expect(relax.locator('[data-filter-pinned]')).toContainText('Playing Relax');
  await expect.poll(() => player.evaluate(audio => audio.ended), { timeout: 5000 }).toBe(true);
  await expect(relax).toBeVisible();
  await expect(relax.locator('[data-filter-pinned]')).toContainText('Playback ended');
  expect(await player.evaluate(audio => audio.isConnected)).toBe(true);
  expect(await fixtureButton.evaluate(button => document.activeElement === button)).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => player.evaluate(audio => !audio.paused && !audio.ended)).toBe(true);
  await expect(relax).toBeVisible();
  expect(await player.evaluate(audio => audio.isConnected)).toBe(true);
  expect(await player.evaluate(audio => audio.currentTime)).toBeLessThan(0.5);
  expect(await player.evaluate(audio => audio !== document.querySelector('.session-card[data-function-id="OCF-BOD-001"] audio'))).toBe(true);
  expect(await player.evaluate(audio => audio === document.querySelector('.session-card[data-function-id="OCF-FND-004"] audio'))).toBe(true);
  expect(await player.getAttribute('data-fixture-identity')).toBe('relax-synthetic-wav');
  await page.locator('#clear-library-filters').click();
  await expect(relax.locator('[data-filter-pinned]')).toBeHidden();
  expect(await player.evaluate(audio => audio.isConnected && !audio.paused)).toBe(true);
  expect(audioRequests).toEqual([]);

  const directorySearch = page.locator('#search');
  await directorySearch.fill('PLUS-RELAX');
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.getByRole('link', { name: 'Relax', exact: true }).click();
  await expect(page).toHaveURL(/\/functions\/OCF-FND-004\/$/);
  await page.goBack();
  await expect(directorySearch).toHaveValue('PLUS-RELAX');
  await expect(page.locator('.session-card:visible h3')).toContainText('Relax');
});

test('Back navigation preserves the same active synthetic player position and filter state', async ({ page }) => {
  const audioResponses = [];
  page.on('response', response => {
    if (!/\.(?:mp3|flac)(?:$|[?#])/i.test(response.url())) return;
    audioResponses.push({host: new URL(response.url()).hostname, status: response.status()});
  });
  await useSilentWavFixture(page);
  await page.goto('/functions/');
  const relax = page.locator(`.session-card[data-edition="${latestEdition}"]`).filter({has: page.getByRole('link', {name: 'Relax', exact: true})});
  await relax.getByRole('button', {name: /^Show player for/}).click();
  const player = relax.locator('audio');
  await player.evaluate(audio => audio.load());
  await expect.poll(() => player.evaluate(audio => audio.duration)).toBeGreaterThan(2.9);
  await player.evaluate(audio => { audio.dataset.fixtureIdentity = 'back-navigation-synthetic-wav'; });
  await relax.evaluate(card => {
    const audio = card.querySelector('audio');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.backNavigationControl = '';
    button.textContent = 'Play synthetic back-navigation fixture';
    button.addEventListener('click', async () => {
      if (audio.paused || audio.ended) await audio.play();
      else audio.pause();
    });
    card.append(button);
  });
  await relax.locator('[data-back-navigation-control]').focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => player.evaluate(audio => !audio.paused && !audio.ended)).toBe(true);
  await player.evaluate(audio => { audio.currentTime = 1.1; });
  await expect.poll(() => player.evaluate(audio => audio.currentTime)).toBeGreaterThan(1);
  const positionBeforeNavigation = await player.evaluate(audio => audio.currentTime);
  await page.locator('#search').fill('OCF-BOD-001');
  await expect(relax).toBeVisible();
  await expect(relax.locator('[data-filter-pinned]')).toContainText('Playing Relax');

  await relax.getByRole('link', {name: 'Relax', exact: true}).click();
  await expect(page).toHaveURL(/\/functions\/OCF-FND-004\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/functions\/$/);
  const restoredPlayer = page.locator(`.session-card[data-edition="${latestEdition}"][data-function-id="OCF-FND-004"] audio`);
  await expect(restoredPlayer).toBeAttached();
  await expect(page.locator('#search')).toHaveValue('OCF-BOD-001');
  expect(await restoredPlayer.evaluate(audio => audio.currentSrc.startsWith('data:audio/wav'))).toBe(true);
  const nativePosition = await restoredPlayer.evaluate(audio => audio.currentTime);
  let pendingPosition = Number(await restoredPlayer.getAttribute('data-ocf-resume-position')) || 0;
  await expect(restoredPlayer).toHaveAttribute('data-ocf-restored-bookmark-pending', 'true');
  expect(Math.max(nativePosition, pendingPosition)).toBeGreaterThanOrEqual(positionBeforeNavigation - 0.2);
  await expect(relax).toBeVisible();
  expect(await restoredPlayer.evaluate(audio => audio.paused)).toBe(true);
  await expect(relax.locator('[data-playback-status]')).toContainText('Paused at');

  const firstRestorePosition = Math.max(nativePosition, pendingPosition);
  await relax.getByRole('link', {name: 'Relax', exact: true}).click();
  await expect(page).toHaveURL(/\/functions\/OCF-FND-004\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/functions\/$/);
  const secondRestorePlayer = page.locator(`.session-card[data-edition="${latestEdition}"][data-function-id="OCF-FND-004"] audio`);
  await expect(secondRestorePlayer).toBeAttached();
  await expect(page.locator('#search')).toHaveValue('OCF-BOD-001');
  pendingPosition = Number(await secondRestorePlayer.getAttribute('data-ocf-resume-position')) || 0;
  const secondNativePosition = await secondRestorePlayer.evaluate(audio => audio.currentTime);
  await expect(secondRestorePlayer).toHaveAttribute('data-ocf-restored-bookmark-pending', 'true');
  expect(Math.max(secondNativePosition, pendingPosition)).toBeGreaterThanOrEqual(firstRestorePosition - 0.2);
  expect(await secondRestorePlayer.evaluate(audio => audio.paused)).toBe(true);
  await expect(relax).toBeVisible();
  await expect(relax.locator('[data-playback-status]')).toContainText('Paused at');
  const expectedResumePosition = Math.max(secondNativePosition, pendingPosition);

  let restoredControl = relax.locator('[data-back-navigation-control]');
  if (await restoredControl.count() === 0) {
    await relax.evaluate(card => {
      const audio = card.querySelector('audio');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.backNavigationControl = '';
      button.textContent = 'Resume synthetic back-navigation fixture';
      button.addEventListener('click', async () => { if (audio.paused) await audio.play(); else audio.pause(); });
      card.append(button);
    });
    restoredControl = relax.locator('[data-back-navigation-control]');
  }
  await restoredControl.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => secondRestorePlayer.evaluate(audio => !audio.paused && !audio.ended)).toBe(true);
  await expect.poll(() => secondRestorePlayer.evaluate((audio, expected) => audio.currentTime >= expected - 0.2, expectedResumePosition)).toBe(true);
  await expect(secondRestorePlayer).not.toHaveAttribute('data-ocf-restored-bookmark-pending');
  await page.keyboard.press('Enter');
  await expect.poll(() => secondRestorePlayer.evaluate(audio => audio.paused)).toBe(true);
  expect(await secondRestorePlayer.evaluate((audio, expected) => audio.isConnected && audio.currentTime >= expected - 0.2, expectedResumePosition)).toBe(true);

  await secondRestorePlayer.evaluate(audio => { audio.currentTime = 0; });
  await expect.poll(() => page.evaluate(() => {
    const saved = JSON.parse(sessionStorage.getItem('ocf-library-playback:/functions/') || 'null');
    return saved?.position === 0 && saved.positionIsExplicit === true;
  })).toBe(true);
  await expect.poll(() => secondRestorePlayer.evaluate(audio => audio.currentTime)).toBe(0);
  await relax.getByRole('link', {name: 'Relax', exact: true}).click();
  await expect(page).toHaveURL(/\/functions\/OCF-FND-004\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/functions\/$/);
  let zeroPositionPlayer = page.locator(`.session-card[data-edition="${latestEdition}"][data-function-id="OCF-FND-004"] audio`);
  await expect(zeroPositionPlayer).toBeAttached();
  await expect.poll(() => zeroPositionPlayer.getAttribute('data-ocf-resume-position-explicit')).toBe('true');
  await expect(zeroPositionPlayer).toHaveAttribute('data-ocf-restored-bookmark-pending', 'true');
  expect(await zeroPositionPlayer.evaluate(audio => audio.paused && audio.currentTime === 0)).toBe(true);
  await expect(page.locator(`.session-card[data-edition="${latestEdition}"][data-function-id="OCF-FND-004"] [data-playback-status]`)).toContainText('Paused at 0:00');
  await relax.getByRole('link', {name: 'Relax', exact: true}).click();
  await page.goBack();
  await expect(page).toHaveURL(/\/functions\/$/);
  zeroPositionPlayer = page.locator(`.session-card[data-edition="${latestEdition}"][data-function-id="OCF-FND-004"] audio`);
  await expect(zeroPositionPlayer).toBeAttached();
  expect(await zeroPositionPlayer.evaluate(audio => audio.paused && audio.currentTime === 0)).toBe(true);
  await zeroPositionPlayer.evaluate(audio => { audio.dataset.fixtureIdentity = 'back-navigation-synthetic-wav'; });
  const zeroResumeControl = page.locator(`.session-card[data-edition="${latestEdition}"][data-function-id="OCF-FND-004"] [data-back-navigation-control]`);
  if (await zeroResumeControl.count() === 0) {
    await page.locator(`.session-card[data-edition="${latestEdition}"][data-function-id="OCF-FND-004"]`).evaluate(card => {
      const audio = card.querySelector('audio');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.backNavigationControl = '';
      button.textContent = 'Resume from zero synthetic fixture';
      button.addEventListener('click', async () => { if (audio.paused) await audio.play(); else audio.pause(); });
      card.append(button);
    });
  }
  await zeroResumeControl.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => zeroPositionPlayer.evaluate(audio => !audio.paused && audio.currentTime < 0.5)).toBe(true);
  await expect(zeroPositionPlayer).not.toHaveAttribute('data-ocf-restored-bookmark-pending');
  await page.keyboard.press('Enter');
  await expect.poll(() => zeroPositionPlayer.evaluate(audio => audio.paused)).toBe(true);

  await secondRestorePlayer.evaluate(audio => { audio.currentTime = audio.duration - 0.5; });
  await expect.poll(() => secondRestorePlayer.evaluate(audio => audio.paused && audio.currentTime > 2.4)).toBe(true);
  await restoredControl.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => secondRestorePlayer.evaluate(audio => audio.ended), {timeout: 5000}).toBe(true);
  await expect(relax.locator('[data-playback-status]')).toContainText('Playback ended');
  await relax.getByRole('link', {name: 'Relax', exact: true}).click();
  await expect(page).toHaveURL(/\/functions\/OCF-FND-004\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/functions\/$/);
  const endedPlayer = page.locator(`.session-card[data-edition="${latestEdition}"][data-function-id="OCF-FND-004"] audio`);
  await expect(endedPlayer).toBeAttached();
  await expect(page.locator('#search')).toHaveValue('OCF-BOD-001');
  expect(await endedPlayer.evaluate(audio => audio.paused && !audio.ended)).toBe(true);
  await expect(page.locator(`.session-card[data-edition="${latestEdition}"][data-function-id="OCF-FND-004"] [data-playback-status]`)).toContainText('Playback ended');
  let replayControl = page.locator(`.session-card[data-edition="${latestEdition}"][data-function-id="OCF-FND-004"] [data-back-navigation-control]`);
  if (await replayControl.count() === 0) {
    await page.locator(`.session-card[data-edition="${latestEdition}"][data-function-id="OCF-FND-004"]`).evaluate(card => {
      const audio = card.querySelector('audio');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.backNavigationControl = '';
      button.textContent = 'Replay synthetic back-navigation fixture';
      button.addEventListener('click', async () => { if (audio.paused || audio.ended) await audio.play(); else audio.pause(); });
      card.append(button);
    });
    replayControl = page.locator(`.session-card[data-edition="${latestEdition}"][data-function-id="OCF-FND-004"] [data-back-navigation-control]`);
  }
  await replayControl.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => endedPlayer.evaluate(audio => !audio.paused && !audio.ended)).toBe(true);
  await expect.poll(() => endedPlayer.evaluate(audio => audio.currentTime < 0.5)).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => endedPlayer.evaluate(audio => audio.paused)).toBe(true);

  await endedPlayer.evaluate(audio => { audio.currentTime = audio.duration - 0.5; });
  await expect.poll(() => endedPlayer.evaluate(audio => audio.currentTime > 2.4 && !audio.seeking)).toBe(true);
  await replayControl.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => endedPlayer.evaluate(audio => audio.ended), {timeout: 5000}).toBe(true);
  await endedPlayer.evaluate(audio => { audio.currentTime = 1.25; });
  await expect.poll(() => page.evaluate(() => {
    const saved = JSON.parse(sessionStorage.getItem('ocf-library-playback:/functions/') || 'null');
    return saved?.ended === false && saved?.positionIsExplicit === true && saved.position > 1;
  })).toBe(true);
  await relax.getByRole('link', {name: 'Relax', exact: true}).click();
  await expect(page).toHaveURL(/\/functions\/OCF-FND-004\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/functions\/$/);
  let soughtAfterEndPlayer = page.locator(`.session-card[data-edition="${latestEdition}"][data-function-id="OCF-FND-004"] audio`);
  await expect(soughtAfterEndPlayer).toBeAttached();
  await expect.poll(() => soughtAfterEndPlayer.getAttribute('data-ocf-resume-position')).toBe('1.25');
  await expect(soughtAfterEndPlayer).toHaveAttribute('data-ocf-restored-bookmark-pending', 'true');
  expect(await soughtAfterEndPlayer.evaluate(audio => audio.paused && !audio.ended)).toBe(true);
  await expect(page.locator(`.session-card[data-edition="${latestEdition}"][data-function-id="OCF-FND-004"] [data-playback-status]`)).toContainText('Paused at 0:01');
  await relax.getByRole('link', {name: 'Relax', exact: true}).click();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  soughtAfterEndPlayer = page.locator(`.session-card[data-edition="${latestEdition}"][data-function-id="OCF-FND-004"] audio`);
  await expect.poll(() => soughtAfterEndPlayer.getAttribute('data-ocf-resume-position')).toBe('1.25');
  await expect(soughtAfterEndPlayer).toHaveAttribute('data-ocf-restored-bookmark-pending', 'true');
  expect(await soughtAfterEndPlayer.evaluate(audio => audio.paused && !audio.ended)).toBe(true);
  expect(audioResponses.filter(response => response.status >= 200 && response.status < 300)).toEqual([]);
});

test('catalog selection and download controls identify session and format', async ({ page }) => {
  await page.goto('/functions/');
  for (const title of ['Relax', 'Brain Flow']) {
    const card = page.locator(`.session-card[data-edition="${latestEdition}"]`).filter({ has: page.getByRole('link', { name: title, exact: true }) });
    await expect(card).toBeVisible();
    await expect(card.locator('.function-status')).toHaveText('Published recording available');
    for (const summary of await card.locator('details summary').allTextContents()) {
      expect(summary).toMatch(/^(?:MP3|FLAC) file details$/);
    }
    for (const format of ['MP3', 'FLAC']) {
      await selectPreference(page,'Audio format',format.toLowerCase());
      const checkboxName = `Select ${format} for ${title}, en-US, Mike — Original Voice, edition ${latestEdition}`;
      await expect(card.getByRole('checkbox', { name: checkboxName, exact: true })).toBeAttached();
      await expect(card.getByRole('link', { name: new RegExp(`^Download ${format} for ${title},`) })).toBeAttached();
    }
  }
});

test('catalog keeps one synthetic player active and announces a controlled media error', async ({ page }) => {
  const audioRequests = [];
  page.on('request', request => { if (/\.(?:mp3|flac)(?:$|[?#])/i.test(request.url())) audioRequests.push(request.url()); });
  await useSilentWavFixture(page);
  await page.goto('/functions/');
  const relax = page.locator(`.session-card[data-edition="${latestEdition}"]`).filter({ has: page.getByRole('link', { name: 'Relax', exact: true }) });
  const brain = page.locator(`.session-card[data-edition="${latestEdition}"]`).filter({ has: page.getByRole('link', { name: 'Brain Flow', exact: true }) });
  await relax.getByRole('button', {name: /^Show player for/}).click();
  await brain.getByRole('button', {name: /^Show player for/}).click();
  const relaxPlayer = relax.locator('audio');
  const brainPlayer = brain.locator('audio');
  await Promise.all([relaxPlayer.evaluate(audio => audio.load()), brainPlayer.evaluate(audio => audio.load())]);
  await expect.poll(() => relaxPlayer.evaluate(audio => audio.duration)).toBeGreaterThan(2.9);
  await expect.poll(() => brainPlayer.evaluate(audio => audio.duration)).toBeGreaterThan(2.9);

  const addFixtureControl = async (card, label) => {
    await card.evaluate((element, buttonLabel) => {
      const player = element.querySelector('audio');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = buttonLabel;
      button.dataset.syntheticPlayControl = '';
      button.addEventListener('click', async () => {
        if (player.paused || player.ended) await player.play();
        else player.pause();
      });
      element.append(button);
    }, label);
    return card.locator('[data-synthetic-play-control]');
  };
  const relaxControl = await addFixtureControl(relax, 'Play synthetic Relax fixture');
  const brainControl = await addFixtureControl(brain, 'Play synthetic Brain Flow fixture');

  for (const [control, active, other] of [
    [relaxControl, relaxPlayer, brainPlayer],
    [brainControl, brainPlayer, relaxPlayer],
    [relaxControl, relaxPlayer, brainPlayer],
    [brainControl, brainPlayer, relaxPlayer],
  ]) {
    await control.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => active.evaluate(audio => !audio.paused && !audio.ended)).toBe(true);
    await expect.poll(() => other.evaluate(audio => audio.paused)).toBe(true);
    expect(await page.locator('.session-card audio').evaluateAll(players => players.filter(audio => !audio.paused && !audio.ended).length)).toBe(1);
  }
  await brainControl.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => relaxPlayer.evaluate(audio => audio.paused)).toBe(true);
  await expect.poll(() => brainPlayer.evaluate(audio => audio.paused)).toBe(true);

  await relaxPlayer.evaluate(audio => {
    Object.defineProperty(audio, 'error', { configurable: true, value: { code: 4 } });
    audio.dispatchEvent(new Event('error'));
  });
  await expect(relax.locator('[data-playback-status]')).toContainText('Audio could not be played');
  await expect(relax.getByRole('link', { name: /^Download MP3 for Relax/ })).toBeAttached();
  expect(audioRequests).toEqual([]);
});

test('selected files hidden by filters remain reviewable and removable', async ({ page }) => {
  await page.goto('/functions/');
  const relax = page.locator(`.session-card[data-edition="${latestEdition}"]`).filter({ has: page.getByRole('link', { name: 'Relax', exact: true }) });
  const brain = page.locator(`.session-card[data-edition="${latestEdition}"]`).filter({ has: page.getByRole('link', { name: 'Brain Flow', exact: true }) });
  const catalog = await page.request.get('/catalog.json').then(response => response.json());
  const relaxMp3Asset = catalog.releases.flatMap(release => release.functions)
    .find(row => row.function_id === 'OCF-FND-004').sessions[0].assets.find(asset => asset.format === 'mp3');
  const relaxAssetURL = relaxMp3Asset.download_url;
  const relaxMp3 = page.locator(`[data-selected-asset-id="${relaxMp3Asset.asset_id}"]`);
  const brainFlac = brain.getByRole('checkbox', { name: /^Select FLAC for Brain Flow,/ });
  await relaxMp3.check();
  await selectPreference(page,'Audio format','flac');
  await brainFlac.check();
  await expect(page.locator('#selection-count')).toHaveText('2 files selected (1 hidden by filters)');
  const review = page.locator('#selected-files-review');
  await expect(review).toBeVisible();

  await page.locator('#search').fill('OCF-BOD-001');
  await expect(relax).toBeHidden();
  await expect(page.locator('#selection-count')).toHaveText('2 files selected (1 hidden by filters)');
  await review.locator(':scope > summary').focus();
  await page.keyboard.press('Enter');
  await expect(review).toHaveAttribute('open', '');
  await expect(review.locator('#selected-files-summary')).toContainText('1 hidden by filters');
  await expect(review).toContainText(`Relax, en-US, Mike — Original Voice, edition ${latestEdition} — MP3 (hidden by filters)`);
  await expect(review.getByRole('link', { name: `Open MP3 download for Relax, en-US, edition ${latestEdition}` })).toHaveAttribute('href', relaxAssetURL);

  await review.getByRole('button', { name: `Remove MP3 for Relax, edition ${latestEdition} from selected files` }).click();
  await expect(page.locator('#selection-count')).toHaveText('1 file selected');
  expect(await relaxMp3.evaluate(checkbox => checkbox.checked)).toBe(false);
  await expect(page.locator('#selection-count')).toBeFocused();
  await page.locator('#clear-library-filters').click();
  await expect(relax).toBeVisible();
  await expect(review.locator('#selected-files-summary')).toContainText('Review selected files (1)');
  await page.locator('#clear-selection').click();
  await expect(page.locator('#selection-count')).toHaveText('0 files selected');
  await expect(review).toBeHidden();
  await expect(page.locator('#selection-count')).toBeFocused();
  expect(await brainFlac.evaluate(checkbox => checkbox.checked)).toBe(false);

  await selectPreference(page,'Audio format','mp3');
  await brain.getByRole('checkbox', { name: /^Select MP3 for Brain Flow,/ }).check();
  await selectPreference(page,'Audio format','flac');
  await brainFlac.check();
  await page.locator('#clear-selection').click();
  await expect(page.locator('#selection-count')).toHaveText('0 files selected');
  await expect(page.locator('#selection-count')).toBeFocused();
  expect(await brain.getByRole('checkbox', { name: /^Select MP3 for Brain Flow,/, includeHidden:true }).evaluate(checkbox => checkbox.checked)).toBe(false);
});

test('function titles expose direct Listen/MP3/FLAC actions for each published edition', async ({ page }) => {
  await page.goto('/functions/OCF-FND-004/');
  const catalog = await page.request.get('/catalog.json').then(response => response.json());
  const session = catalog.releases.flatMap(release => release.functions)
    .find(row => row.function_id === 'OCF-FND-004').sessions[0];
  const anchorAsset = session.assets[0];
  const actions = page.locator('.function-audio-actions');
  const label = `Relax, en-US, edition ${session.edition}`;
  await expect(actions).toBeVisible();
  await expect(actions.getByRole('link', { name: `Listen to ${label}` })).toHaveAttribute('href', `#session-${anchorAsset.asset_id}`);
  for (const format of ['mp3', 'flac']) {
    await selectPreference(page,'Audio format',format);
    const asset = session.assets.find(row => row.format === format);
    await expect(actions.getByRole('link', { name: `Download ${format.toUpperCase()} for ${label}` })).toHaveAttribute('href', asset.download_url);
  }
  await expect(page.locator(`#session-${anchorAsset.asset_id} audio`)).toBeAttached();
  await noAxeViolations(page, '.function-audio-actions');
});

test('bounded public release MP3 playback uses validated contiguous public byte ranges', async ({ page, browserName }) => {
  test.skip(process.env.OCF_REAL_AUDIO_TESTS !== '1', 'Set OCF_REAL_AUDIO_TESTS=1 to allow a capped public release-media probe.');
  test.setTimeout(90000);
  const catalog = await page.request.get('/catalog.json').then(response => response.json());
  const fn = catalog.releases.flatMap(release => release.functions).find(row => row.function_id === 'OCF-FND-004');
  const session = fn.sessions.find(row => row.title === 'Relax');
  const asset = session.assets.find(row => row.format === 'mp3');
  const anchorAsset = session.assets[0];
  expect(asset).toBeTruthy();
  expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(asset.size_bytes).toBeGreaterThan(0);
  const maxRangeBytes = 256 * 1024;
  const maxRequests = 32;
  const maxTotalBytes = maxRangeBytes * maxRequests;
  let budgetExceeded = false;
  const ranges = [];
  const rangeResponses = [];
  const mediaRequests = [];
  const mediaFailures = [];
  const audioResponses = [];
  const budgetFailures = [];
  const matchesAudioURL = rawURL => {
    try { return decodeURIComponent(rawURL).includes(asset.filename); }
    catch (_) { return false; }
  };
  // Test-only transport: WebKit must receive enough contiguous bytes to cross the
  // published MP3's large ID3 artwork tag before its first MPEG frame (~325 KiB).
  // Never represent this bounded prefix as full-release or native Safari playback.
  const prefixMode = browserName === 'webkit';
  const browserWindowBytes = prefixMode ? 512 * 1024 : maxRangeBytes;
  let reservedBytes = 0;
  const browserRanges = [];
  const fetchChunk = async (url, start, end) => {
    const expectedBytes = end - start + 1;
    if (ranges.length >= maxRequests || reservedBytes + expectedBytes > maxTotalBytes) {
      throw new Error('upstream-request-or-byte-cap');
    }
    reservedBytes += expectedBytes; // Reserve before awaiting, including concurrent requests.
    ranges.push({host: new URL(url).hostname, start, end});
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        headers: {Range: `bytes=${start}-${end}`, 'Accept-Encoding': 'identity'},
        signal: controller.signal,
      });
      const cr = /^bytes (\d+)-(\d+)\/(\d+)$/i.exec(response.headers.get('content-range') || '');
      const encoding = response.headers.get('content-encoding');
      // Reject an ignored Range or misleading length before reading any body.
      if (response.status !== 206 || !cr || Number(cr[1]) !== start || Number(cr[2]) !== end
          || Number(cr[3]) !== asset.size_bytes
          || Number(response.headers.get('content-length')) !== expectedBytes
          || (encoding && encoding !== 'identity')) {
        await response.body?.cancel();
        throw new Error(`invalid-upstream-range-headers:${response.status}:${start}-${end}`);
      }
      const reader = response.body.getReader();
      const pieces = [];
      let received = 0;
      for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > expectedBytes) {
          await reader.cancel();
          throw new Error('upstream-body-exceeds-declared-range');
        }
        pieces.push(Buffer.from(value));
      }
      if (received !== expectedBytes) throw new Error('truncated-upstream-range');
      rangeResponses.push({host: new URL(response.url).hostname, status: 206, start, end, total: asset.size_bytes});
      return {body: Buffer.concat(pieces), contentType: response.headers.get('content-type') || 'application/octet-stream'};
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  };
  await page.route(url => matchesAudioURL(url.href), async route => {
    try {
      const rawRange = route.request().headers().range || 'bytes=0-';
      const match = /^bytes=(\d+)-(\d*)$/i.exec(rawRange);
      if (!match) throw new Error(`unsupported-range:${rawRange}`);
      const start = Number(match[1]);
      const requestedEnd = match[2] ? Number(match[2]) : asset.size_bytes - 1;
      const end = Math.min(requestedEnd, start + browserWindowBytes - 1, asset.size_bytes - 1);
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || end < start) throw new Error('invalid-native-range');
      const parts = [];
      let contentType;
      for (let offset = start; offset <= end; offset += maxRangeBytes) {
        const chunk = await fetchChunk(route.request().url(), offset, Math.min(end, offset + maxRangeBytes - 1));
        parts.push(chunk.body);
        contentType = chunk.contentType;
      }
      const body = Buffer.concat(parts);
      browserRanges.push({requested: rawRange, start, end, bytes: body.length});
      await route.fulfill({status: 206, headers: {
        'content-type': contentType, 'accept-ranges': 'bytes',
        'content-range': `bytes ${start}-${end}/${asset.size_bytes}`,
        'content-length': String(body.length), 'access-control-allow-origin': '*',
      }, body});
    } catch (error) {
      budgetExceeded = true;
      budgetFailures.push(error.message);
      await route.abort().catch(() => {});
    }
  });
  page.on('request', request => {
    if (!matchesAudioURL(request.url())) return;
    const url = new URL(request.url());
    mediaRequests.push({host: url.hostname, resourceType: request.resourceType(), range: request.headers().range || null});
  });
  page.on('requestfailed', request => {
    if (!matchesAudioURL(request.url())) return;
    const url = new URL(request.url());
    mediaFailures.push({host: url.hostname, error: request.failure()?.errorText || 'unknown'});
  });
  page.on('response', response => {
    if (!matchesAudioURL(response.url())) return;
    const headers = response.headers();
    const url = new URL(response.url());
    audioResponses.push({host: url.hostname, status: response.status(), resourceType: response.request().resourceType(), contentType: headers['content-type'] || null, contentRange: headers['content-range'] || null});
  });
  const assertMediaBudget = () => {
    expect(budgetExceeded, `bounded public media request guard: ${budgetFailures.join(', ')} (${ranges.length} ranges)`).toBe(false);
    expect(ranges.length).toBeGreaterThan(0);
    expect(ranges.length).toBeLessThanOrEqual(maxRequests);
    expect(ranges.every(range => range.end - range.start + 1 <= maxRangeBytes)).toBe(true);
    expect(rangeResponses.length).toBeGreaterThan(0);
    expect(rangeResponses.every(range => range.status === 206 && range.end - range.start + 1 <= maxRangeBytes && range.total === asset.size_bytes)).toBe(true);
    const bytes = rangeResponses.reduce((total, range) => total + range.end - range.start + 1, 0);
    expect(bytes).toBeLessThanOrEqual(maxTotalBytes);
    return bytes;
  };

  await page.goto('/functions/OCF-FND-004/');
  const actions = page.locator('.function-audio-actions');
  const editionLabel = `Relax, en-US, edition ${session.edition}`;
  await expect(actions.getByRole('link', {name: `Listen to ${editionLabel}`})).toHaveAttribute('href', `#session-${anchorAsset.asset_id}`);
  await expect(actions.getByRole('link', {name: `Download MP3 for ${editionLabel}`})).toHaveAttribute('href', asset.download_url);
  const player = page.locator(`#session-${anchorAsset.asset_id} audio`);
  const playbackStatus = page.locator(`#session-${anchorAsset.asset_id} [data-playback-status]`);
  await expect(player).toHaveAttribute('preload', 'none');
  await expect(player.locator('source')).toHaveAttribute('src', asset.download_url);
  await player.evaluate(audio => audio.load());
  try {
    // WebKit can decode this bounded prefix while reporting duration 0 until playback.
    await expect.poll(() => player.evaluate((audio, prefix) => !audio.error && (prefix
      ? audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      : Number.isFinite(audio.duration) && audio.duration > 0 && audio.readyState >= HTMLMediaElement.HAVE_METADATA), prefixMode), {timeout: 20000}).toBe(true);
  } catch (error) {
    const state = await player.evaluate(audio => ({readyState: audio.readyState, networkState: audio.networkState, duration: audio.duration, error: audio.error?.code || null}));
    throw new Error(`Bounded public audio metadata failed (not proof of browser incompatibility): ${JSON.stringify({state, budgetFailures, mediaRequests, mediaFailures, audioResponses, ranges, rangeResponses, browserRanges})}; ${error.message}`);
  }
  let observedDuration = await player.evaluate(audio => audio.duration);
  if (!prefixMode) expect(observedDuration).toBeGreaterThan(1000);

  await page.locator('.page-intro').evaluate(intro => {
    const player = document.querySelector('.edition-card audio');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.publicMediaProbe = '';
    button.textContent = 'Start bounded public playback probe';
    button.addEventListener('click', async () => {
      if (player.paused || player.ended) await player.play();
      else player.pause();
    });
    intro.append(button);
  });
  const probe = page.locator('[data-public-media-probe]');
  await probe.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => player.evaluate(audio => !audio.paused && !audio.ended), {timeout: 12000}).toBe(true);
  await expect.poll(() => player.evaluate(audio => audio.currentTime), {timeout: 12000}).toBeGreaterThan(0.5);
  await page.keyboard.press('Enter');
  await expect.poll(() => player.evaluate(audio => audio.paused), {timeout: 5000}).toBe(true);
  const pausedAt = await player.evaluate(audio => audio.currentTime);
  let seekedTo = pausedAt;
  if (!prefixMode) {
    const seekTo = pausedAt + 5;
    await player.evaluate((audio, target) => { audio.currentTime = target; }, seekTo);
    await expect.poll(() => player.evaluate((audio, target) => !audio.seeking && audio.currentTime >= target - 0.25, seekTo), {timeout: 15000}).toBe(true);
    seekedTo = await player.evaluate(audio => audio.currentTime);
    expect(seekedTo).toBeGreaterThanOrEqual(seekTo - 0.25);
  }
  // A truncated WebKit prefix may report duration zero even while playing.
  // Verify pause/resume progression, but do not claim full duration or seeking.
  await page.keyboard.press('Enter');
  await expect.poll(() => player.evaluate(audio => !audio.paused && !audio.ended), {timeout: 8000}).toBe(true);
  await expect.poll(() => player.evaluate((audio, previous) => audio.currentTime > previous + 0.25, seekedTo), {timeout: 10000}).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => player.evaluate(audio => audio.paused), {timeout: 5000}).toBe(true);

  const boundedResponseBytes = assertMediaBudget();
  console.log(`Public release media probe (${asset.format}; ${prefixMode ? "bounded-prefix decode/play/pause/resume, NOT seek/full duration/native Safari" : "bounded range playback"}): ${rangeResponses.length} validated upstream HTTP 206 ranges, ${boundedResponseBytes} bytes; upstream cap ${maxRangeBytes}, total cap ${maxTotalBytes}; observed duration ${observedDuration}.`);
  await expect(playbackStatus).toContainText('Paused at');
});

test('Android-like touch users can open and follow the primary mobile navigation', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright mobile emulation is Chromium-only');
  const context = await browser.newContext({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  try {
    const mobilePage = await context.newPage();
    await mobilePage.goto('/');
    await mobilePage.locator('.mobile-nav > summary').tap();
    await expect(mobilePage.locator('.mobile-nav')).toHaveAttribute('open', '');
    await mobilePage.locator('.mobile-nav a[href="start/"]').tap();
    await expect(mobilePage).toHaveURL(/\/start\/$/);
    await expect(mobilePage.locator('#main')).toContainText('Complete Preparation Learning before using any OCF function.');
  } finally {
    await context.close();
  }
});

test('Listening Guide and Preparation Learning clearly state preparation-first guidance and exception limits', async ({ page }) => {
  await page.goto('/listening/');
  const guidance = page.locator('#preparation-learning-first').locator('..');
  await expect(guidance).toBeVisible();
  await expect(guidance).toContainText('Complete Preparation Learning before using any OCF function.');
  await expect(guidance).toContainText('Only people who have already learned the official Human Plus preparation track may skip it.');
  await expect(page.locator('.preparation-first-link a')).toHaveAttribute('href', '../preparation-learning/');
  await expect(guidance).not.toContainText('Michael');
  await expect(guidance).not.toContainText('not a verified official OCF policy');
  await expect(page.locator('main')).not.toContainText('Function guides distinguish exact display cues from exact spoken cues.');
  await expect(page.locator('main')).not.toContainText('Michael');
  await expect(page.locator('main')).not.toContainText('not a verified official OCF policy');
  const guideText = await page.locator('main').innerText();
  expect(guideText.match(/Stereo headphones or stereo earbuds with separate left\/right playback are required/g)).toHaveLength(1);
  expect(guideText.match(/Do not listen while driving, operating equipment, or doing anything requiring vigilance\./g)).toHaveLength(1);
  expect(guideText).not.toContain('What OCF is');
  expect(guideText).not.toContain('mono mixing does not provide equivalent delivery. Separately');
  expect(guideText).not.toContain('Preserve separate left/right stereo playback for intended');
  for (const id of ['welcome-to-ocf', 'what-ocf-is', 'a-comfortable-environment']) {
    await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
  }

  expect(guideText).toContain('58 of 58 canonical function guides have at least one published recording');
  expect(guideText).toContain('audio-0.1.0-a6-20261111 (edition 0.1.0)');
  await noAxeViolations(page);
  await page.goto('/preparation-learning/');
  const intro = page.locator('.page-intro');
  await expect(intro).toContainText('Complete Preparation Learning before using any OCF function.');
  await expect(intro).toContainText('Only people who have already learned the official Human Plus preparation track may skip it.');
  await expect(intro).not.toContainText('Michael');
  await expect(intro).not.toContainText('not a verified official OCF policy');
  await expect(page.locator('main')).not.toContainText('Michael');
  await expect(page.locator('main')).not.toContainText('not a verified official OCF policy');
  await noAxeViolations(page);
});

test('generated listening and all platform guides require stereo for binaural delivery without changing assets', async ({ page }) => {
  const required = 'Stereo headphones or stereo earbuds with separate left/right playback are required for the intended binaural/channel-separated audio.';
  await page.goto('/listening/');
  const guide = await page.locator('main').innerText();
  expect(guide).toContain(required);
  expect(guide).toContain('Speakers, mono mixing, or a single earpiece are not equivalent delivery of that audio.');
  expect(guide).toContain('use the written guide or an edition-matched transcript if available, or skip the audio');
  expect(guide).toContain('no equivalent effects are promised');
  expect(guide).not.toContain('Can I listen without stereo headphones?');
  expect(guide).not.toContain('Yes. Speakers, mono playback');
  expect(guide).not.toContain('You may listen to the spoken guidance through speakers');
  expect(guide).not.toContain('You may use speakers or mono');

  const settings = page.locator('#recommended-audio-settings');
  await expect(settings).toContainText('Headphones and stereo');
  await expect(settings.locator('h3')).toHaveText('Processing preferences');

  for (const platform of ['android', 'ios', 'linux', 'macos', 'windows']) {
    await page.goto(`/listening/${platform}/`);
    const text = await page.locator('main').innerText();
    expect(text, platform).toContain(required);
    expect(text, platform).toContain('not equivalent delivery of that audio');
    expect(text, platform).toContain('or skip the audio');
    expect(text, platform).not.toContain('stereo baseline is optional');
    expect(text, platform).not.toContain('You may listen to the spoken guidance through speakers');
    expect(text, platform).not.toContain('You may still listen to the spoken guidance');
  }

  const receipt = await page.request.get('/site-build-receipt.json').then(response => response.json());
  const catalogBytes = await page.request.get('/catalog.json').then(response => response.body());
  expect(receipt.catalog_sha256).toBe(createHash('sha256').update(catalogBytes).digest('hex'));
  const sessions = publishedCatalog.releases.flatMap(release => [...release.functions, ...(release.preparations || [])].flatMap(row => row.sessions));
  expect(receipt.published_session_count).toBe(sessions.length);
  expect(receipt.audio_asset_count).toBe(sessions.flatMap(session => session.assets).length);
  for (const release of publishedCatalog.releases) {
    expect(receipt.published_releases.find(row => row.tag === release.tag).publication_manifest_sha256)
      .toBe(release.publication_manifest_sha256);
  }
  await page.goto('/historical-names/');
  await expect(page.locator('[data-historical-name-entry]')).toHaveCount(32);
  expect(receipt.historical_name_count).toBe(95);
  await noAxeViolations(page);
});

test('release downloads stay direct and mobile users get a truthful copy-and-rename filename suggestion', async ({ page, context, browserName }) => {
  const catalog = await page.request.get('/catalog.json').then(response => response.json());
  const release = catalog.releases[0];
  const session = release.functions.find(row => row.function_id === 'OCF-FND-004').sessions[0];
  const mp3 = session.assets.find(asset => asset.format === 'mp3');
  const routeHit = [];
  await page.route(mp3.download_url, async route => {
    routeHit.push(true);
    await route.fulfill({
      status: 200,
      contentType: 'audio/mpeg',
      headers: { 'Content-Disposition': `attachment; filename="${mp3.filename}"` },
      body: Buffer.from([0x49]),
    });
  });
  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  }

  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/functions/OCF-FND-004/');
  const row = page.locator('.asset-download[data-download-format="mp3"]').filter({has: page.locator(`a[href="${mp3.download_url}"]`)});
  await expect(row).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  expect(await row.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);

  await row.locator('.file-details summary').click();
  const suggested = await row.locator('.file-details code').nth(1).textContent();
  expect(suggested).toContain('OCF-FND-004');
  expect(suggested).toContain('Relax');
  expect(suggested).toContain(session.locale);
  expect(suggested).toContain('Mike');
  expect(suggested).toContain(`v${session.edition}`);
  expect(suggested).toContain(release.tag);
  expect(suggested.endsWith('.mp3')).toBe(true);
  expect(suggested).not.toContain(mp3.filename.slice(-16, -4));

  const link = row.locator('a.download-link');
  await expect(link).toHaveAttribute('href', mp3.download_url);
  await expect(link).toHaveAttribute('download', suggested);
  await expect(page.locator('main')).toContainText('rename it locally if needed');
  await expect(page.locator('main')).toContainText('does not buffer audio');
  const copy = row.getByRole('button', { name: 'Copy suggested filename for MP3' });
  await expect(copy).toBeVisible();
  await expect(copy).toHaveAttribute('data-copy', suggested);
  if (browserName === 'chromium') {
    await copy.click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(suggested);
  } else {
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => { throw new Error('clipboard unavailable'); } },
    }));
    await copy.click();
    await expect(copy).toHaveText(suggested);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  }

  if (browserName === 'webkit') {
    const requestPromise = page.waitForRequest(mp3.download_url);
    const responsePromise = page.waitForResponse(mp3.download_url);
    await link.click();
    const [request, response] = await Promise.all([requestPromise, responsePromise]);
    expect(request.url()).toBe(mp3.download_url);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-disposition']).toContain(mp3.filename);
    expect(routeHit).toHaveLength(1);
    return;
  }
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
  expect(routeHit).toHaveLength(1);
  expect(download.suggestedFilename()).toBe(mp3.filename);
  expect(download.suggestedFilename()).not.toBe(suggested);
});

test('cross-origin release response behavior is explicit without buffering the release asset', async ({ page, browserName }) => {
  const catalog = await page.request.get('/catalog.json').then(response => response.json());
  const release = catalog.releases[0];
  const session = release.functions.find(row => row.function_id === 'OCF-FND-004').sessions[0];
  const mp3 = session.assets.find(asset => asset.format === 'mp3');
  const deliveredBytes = Buffer.from([0x49]);
  await page.route(mp3.download_url, route => route.fulfill({
    status: 200,
    contentType: 'audio/mpeg',
    headers: { 'Content-Disposition': `attachment; filename="${mp3.filename}"` },
    body: deliveredBytes,
  }));
  await page.goto('/functions/OCF-FND-004/');
  const row = page.locator('.asset-download[data-download-format="mp3"]').filter({has: page.locator(`a[href="${mp3.download_url}"]`)});
  const friendly = await row.locator('.download-link').getAttribute('download');
  expect(friendly).not.toBe(mp3.filename);
  if (browserName === 'webkit') {
    const requestPromise = page.waitForRequest(mp3.download_url);
    const responsePromise = page.waitForResponse(mp3.download_url);
    await row.locator('.download-link').click();
    const [request, response] = await Promise.all([requestPromise, responsePromise]);
    expect(request.url()).toBe(mp3.download_url);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-disposition']).toContain(mp3.filename);
    expect(deliveredBytes.byteLength).toBe(1);
    return;
  }
  const [download] = await Promise.all([page.waitForEvent('download'), row.locator('.download-link').click()]);
  expect(download.suggestedFilename()).toBe(mp3.filename);
  expect(download.suggestedFilename()).not.toBe(friendly);
  expect(deliveredBytes.byteLength).toBe(1);
  expect(browserName).toMatch(/^(chromium|firefox|webkit)$/);
});

test('Quick Reference filters, keyboard controls, narrow widths, print, themes, transcript and deep links work', async ({ page, browserName }) => {
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/quick-reference/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await expect(page.locator('.reference-table tbody tr')).toHaveCount(58);
    await expect(page.getByRole('table', {name: 'Current cues, function descriptions, and audio availability'})).toBeVisible();
    await expect(page.locator('.reference-table tbody tr').first().locator('td[data-label="Description"]')).toBeVisible();
    await expect(page.locator('.reference-table tbody tr').first().locator('td[data-label="Audio"] a')).toHaveText('Listen');
    await expect(page.locator('main')).not.toContainText('Published audio available');
    expect(await page.locator('.reference-table').evaluate(table => table.scrollWidth <= table.clientWidth)).toBe(true);
    await expect(page.locator('.historical-cue')).toHaveCount(0);
    await expect(page.locator('.reference-table .copy-cue')).toHaveCount(0);
    await expect(page.locator('.reference-table strong').first()).toHaveText('Plus Automate');
  }

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/quick-reference/');
  const search = page.getByLabel('Search title, ID, cue or description');
  await search.focus();
  await page.keyboard.type('OCF-EXP-001');
  await expect(page.locator('[data-reference-count]')).toHaveText('1 function');
  await search.fill('Plus Focus');
  await expect(page.locator('[data-reference-count]')).toHaveText('1 function');
  const domain = page.getByLabel('Category');
  await domain.selectOption('foundation');
  await search.fill('OCF-EXP-001');
  await expect(page.locator('[data-reference-count]')).toHaveText('1 function');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('data-reference-category');

  await page.goto('/functions/OCF-SLP-002/#cues');
  await page.reload();
  await expect(page).toHaveURL(/#cues$/);
  await expect(page.locator('#cues')).toBeInViewport();
  await page.locator('.mobile-toc summary').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.mobile-toc')).toHaveAttribute('open', '');
  await page.locator('.mobile-toc a[href="#behavior"]').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#behavior$/);

  await page.goto('/');
  await openPreferences(page);
  const initialTheme = await page.locator('[data-theme-toggle]').getAttribute('data-theme-preference');
  await page.locator('[data-theme-toggle]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-theme-toggle]')).not.toHaveAttribute('data-theme-preference', initialTheme);
  await closePreferences(page);

  await page.goto('/functions/OCF-FND-004/');
  const transcript = page.locator('[data-transcript]').first();
  await transcript.locator(':scope > summary').click();
  await expect(transcript.locator('.transcript-body')).not.toContainText('Transcript loads when expanded.');
  await expect(transcript.locator('.transcript-search input')).toBeEnabled();
  const transcriptHeight = await transcript.locator('.transcript-body').evaluate(el => el.scrollHeight);
  expect(transcriptHeight).toBeGreaterThan(512);
  expect(await transcript.locator('.transcript-body').evaluate(el => getComputedStyle(el).maxHeight)).toBe('none');
  expect(await transcript.locator('.transcript-body').evaluate(el => getComputedStyle(el).overflowY)).toBe('visible');
  expect(await transcript.locator('.transcript-body').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  await transcript.locator('.transcript-body').evaluate(el => el.scrollIntoView({block: 'end'}));
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await page.goto('/quick-reference/');
  if (browserName === 'chromium') {
    await page.emulateMedia({ media: 'print' });
    expect(await page.evaluate(() => getComputedStyle(document.body).color)).toBe('rgb(17, 17, 17)');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)');
    expect(await page.locator('.reference-table').evaluate(table => getComputedStyle(table).minWidth)).toBe('0px');
    expect(await page.locator('.reference-table').evaluate(table => table.scrollWidth <= table.clientWidth)).toBe(true);
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    await fs.mkdir('browser-artifacts', { recursive: true });
    await fs.writeFile(path.join('browser-artifacts', 'quick-reference-print.pdf'), pdf);
    expect(pdf.byteLength).toBeGreaterThan(10_000);
  }
  await noAxeViolations(page);
});

test('mobile Quick Reference cards retain descriptions, cues, and accurate audio status', async ({ page }) => {
  await page.setViewportSize({width: 320, height: 900});
  await page.goto('/quick-reference/');
  const rows = page.locator('.quick-reference-table tbody tr[data-reference-row]');
  await expect(rows).toHaveCount(58);
  await expect(page.getByRole('columnheader', {name: 'Description'})).toHaveCount(1);
  await expect(page.getByRole('columnheader', {name: 'Audio availability'})).toHaveCount(1);
  for (const row of await rows.all()) {
    for (const label of ['Current cues', 'Description', 'Audio']) {
      const cell = row.locator(`td[data-label="${label}"]`);
      await expect(cell).toBeVisible();
      await expect(cell).toContainText(/\S/);
    }
  }
  await expect(page.getByRole('table', {name: 'Current cues, function descriptions, and audio availability'})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  expect(await page.locator('.quick-reference-table').evaluate(table => table.scrollWidth <= table.clientWidth)).toBe(true);
});

test('all five device baselines render the exact source checklist as semantic lists', async ({ page }) => {
  for (const platform of ['android', 'ios', 'windows', 'macos', 'linux']) {
    const markdown = await fs.readFile(path.join(__dirname, '../docs/website/listening', `${platform}.md`), 'utf8');
    const lines = markdown.split(/\r?\n/);
    const start = lines.indexOf('## Baseline');
    expect(start, `${platform} baseline heading exists in source`).toBeGreaterThanOrEqual(0);
    const expected = [];
    for (const line of lines.slice(start + 1)) {
      if (/^## /.test(line)) break;
      if (line.startsWith('- ')) expected.push(line.slice(2));
      else if (expected.length && /^\s{2,}\S/.test(line)) expected[expected.length - 1] += ` ${line.trim()}`;
      else if (line.trim()) throw new Error(`Unexpected non-list baseline content in ${platform}: ${line}`);
    }
    const pageResponse = await page.goto(`/listening/${platform}/`);
    expect(pageResponse?.ok()).toBe(true);
    const baseline = page.locator('#baseline');
    const list = baseline.locator('xpath=following-sibling::ul[1]');
    await expect(list).toBeVisible();
    const actual = (await list.locator('li').allTextContents()).map(text => text.replace(/\s+/g, ' ').trim());
    expect(actual).toEqual(expected.map(text => text.replace(/\s+/g, ' ').trim()));
  }
});

test('mobile transcript expands into natural page reading and retries a failed exact-edition load', async ({ page }) => {
  await page.setViewportSize({width: 375, height: 900});
  let transcriptRequests = 0;
  await page.route('**/transcripts/*.txt', async route => {
    transcriptRequests += 1;
    if (transcriptRequests === 1) await route.abort();
    else await route.continue();
  });
  await page.goto('/functions/OCF-FND-004/');
  const transcript = page.locator('[data-transcript]').first();
  const summary = transcript.locator(':scope > summary');
  await summary.scrollIntoViewIfNeeded();
  const scrollBeforeExpansion = await page.evaluate(() => window.scrollY);
  await summary.click();
  await expect(transcript.locator('[data-transcript-status]')).toContainText('Transcript unavailable');
  expect(Math.abs(await page.evaluate(() => window.scrollY) - scrollBeforeExpansion)).toBeLessThan(24);
  const retry = transcript.locator('[data-transcript-retry]');
  await expect(retry).toBeVisible();
  await noAxeViolations(page);
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => transcript.locator('.transcript-body').textContent()).not.toContain('Transcript loads when expanded.');
  await expect(transcript.locator('[data-transcript-status]')).toContainText('transcript loaded');
  await expect(retry).toBeHidden();
  expect(Math.abs(await page.evaluate(() => window.scrollY) - scrollBeforeExpansion)).toBeLessThan(24);
  const body = transcript.locator('.transcript-body');
  const mediaLayout = await body.evaluate(element => ({
    maxHeight: getComputedStyle(element).maxHeight,
    overflowY: getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(mediaLayout.maxHeight).toBe('none');
  expect(mediaLayout.overflowY).toBe('visible');
  expect(mediaLayout.scrollHeight).toBeLessThanOrEqual(mediaLayout.clientHeight + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await expect(transcript.getByRole('link', {name: `Download transcript text for Relax, edition ${latestEdition}, en-US`})).toHaveAttribute('href', /\/transcripts\/.*\.txt$/);
  await expect(transcript.getByRole('link', {name: `Original release asset, TXT for Relax, edition ${latestEdition}, en-US`})).toHaveAttribute('href', /^https:\/\/github\.com\//);
  const timed = page.getByRole('link', {name: `Download timed subtitles for Relax, edition ${latestEdition}, en-US`});
  await expect(timed).toHaveAttribute('href', /\/transcripts\/.*\.vtt$/);
  await expect(page.getByRole('link', {name: `Original release asset, VTT for Relax, edition ${latestEdition}, en-US`})).toHaveAttribute('href', /^https:\/\/github\.com\//);
  expect(transcriptRequests).toBe(2);
});

test('About leads with reader context and keeps provenance in native disclosure', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.locator('h1')).toHaveText('About OCF');
  const introText = await page.locator('.page-intro').innerText();
  expect(introText).toContain('independent, open-source guided audio project');
  expect(introText).toContain('Our growing library of functions');
  expect(introText).toContain('Our Vision');
  expect(introText).not.toContain('source commit');
  const transparency = page.locator('.technical-transparency');
  await expect(transparency).not.toHaveAttribute('open', '');
  await transparency.locator(':scope > summary').click();
  const pin = await pinnedSource(page);
  await expect(transparency).toContainText(pin.source_commit);
  await expect(transparency.getByRole('link', { name: 'Pinned source tree' })).toHaveAttribute('href', `${pin.source_repository}/tree/${pin.source_commit}`);
  await expect(transparency).toContainText('audio-0.1.0-a6-20261111');
  await expect(page.locator('main')).toContainText('freely accessible, clearly documented, and open to improvement');
  await noAxeViolations(page);
});

test('mobile navigation, spoken cue text without redundant cue copy controls, focus order, and accessibility', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/functions/OCF-SLP-002/');
  await expect(page.locator('.spoken-cue strong').first()).toHaveText('Plus Sleep');
  await expect(page.locator('button.copy-cue, button[aria-label^="Copy cue:"]')).toHaveCount(0);
  await page.locator('.mobile-nav > summary').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.mobile-nav')).toHaveAttribute('open', '');
  await page.locator('.mobile-nav a[href$="quick-reference/"]').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/quick-reference\/$/);
  await expect(page.locator('.mobile-nav')).not.toHaveAttribute('open', '');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  await noAxeViolations(page);
});


test('quality metadata, slim catalog, static fallback and narrow print stay truthful', async ({ browser, page }) => {
  await page.goto('/functions/OCF-AUT-001/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://ocfproject.org/functions/OCF-AUT-001/');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Automatic Action/);
  const full = await page.request.get('/catalog.json').then(r => r.text());
  const slim = await page.request.get('/browse-catalog.json').then(r => r.text());
  expect(slim.length).toBeLessThan(full.length / 2);
  expect(slim).not.toContain('provenance');
  const sitemap = await page.request.get('/sitemap.xml').then(r => r.text());
  expect(sitemap).toContain('https://ocfproject.org/functions/OCF-AUT-001/');
  expect(sitemap).not.toContain('404.html');
  await page.goto('/404.html');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('main a').first()).toHaveAttribute('href', 'https://ocfproject.org/functions/');
  const context = await browser.newContext({javaScriptEnabled: false});
  const staticPage = await context.newPage();
  await staticPage.goto('/functions/');
  await expect(staticPage.locator('.library-tools')).toBeHidden();
  await expect(staticPage.locator('.selection-tools')).toBeHidden();
  await expect(staticPage.locator('#results-count')).not.toContainText('Loading');
  await expect(staticPage.locator('[data-function-card]')).toHaveCount(58);
  await context.close();
  await page.setViewportSize({width: 320, height: 800});
  await page.goto('/quick-reference/');
  await page.emulateMedia({media: 'print'});
  expect(await page.locator('tr[data-reference-row]').first().evaluate(el => getComputedStyle(el).display)).toBe('table-row');
});


test('browse constructs only requested players and preserves selection and identity', async ({ page }) => {
  await page.goto('/functions/');
  await expect(page.locator('.session-card')).toHaveCount(59 * publishedCatalog.releases.length);
  await expect(page.locator('.session-card:visible')).toHaveCount(59);
  await expect(page.locator('.session-card audio')).toHaveCount(0);
  const card = page.locator(`.session-card[data-edition="${latestEdition}"][data-function-id="OCF-FND-004"]`);
  const checkbox = card.getByRole('checkbox', {name:/^Select MP3/});
  await checkbox.check();
  await card.getByRole('button', {name: /^Show player for/}).focus();
  await page.keyboard.press('Enter');
  const player = card.locator('audio');
  await expect(player).toBeFocused();
  await expect(page.locator('.session-card audio')).toHaveCount(1);
  expect(await player.evaluate(audio => audio.paused)).toBe(true);
  await player.evaluate(audio => { audio.dataset.identity = 'original'; });
  await page.locator('#search').fill('Brain Flow');
  await page.locator('#search').fill('Relax');
  await expect(player).toHaveAttribute('data-identity', 'original');
  await expect(checkbox).toBeChecked();
  await expect(page.locator('#selection-count')).toContainText('1 file selected');
});


test('approved function chains are discoverable, optional, accessible and retain navigation', async ({ page }) => {
  for (const width of [320, 1280]) {
    await page.setViewportSize({width, height: 900});
    await page.goto('/start/');
    await page.locator('.start-more > summary').click();
    await page.locator('main a[href$="function-chains/"]').click();
    await expect(page).toHaveURL(/function-chains\/$/);
    await expect(page.locator('h1')).toHaveText('Function Chains');
    await expect(page).toHaveTitle('Function Chains — OCF');
    await expect(page.locator('.mobile-nav a[aria-current="page"]')).toHaveText('Function Chains');
    await expect(page.locator('.chain-original ol')).toHaveCount(17);
    const toc = page.locator(width === 320 ? '.mobile-toc' : '.desktop-toc');
    if (width === 320) await toc.locator('summary').click();
    await toc.locator('a[href="#daily-learning"]').click();
    await expect(page).toHaveURL(/#daily-learning$/);
    await expect(page.locator('#daily-learning')).toBeInViewport();
    await page.goBack();
    await expect(page).toHaveURL(/function-chains\/$/);

    await expect(page.locator('.chain-original ol').nth(0).locator('a')).toHaveText(['Relax', 'Focus', 'Think Fast', 'Imprint', 'Recall']);
    await expect(page.locator('.chain-original ol').nth(1).locator('a')).toHaveText(['Relax', 'Think Fast', 'Coordination', 'Focus']);
    await expect(page.locator('.chain-original ol').nth(2).locator('a')).toHaveText(['Relax', 'Focus', 'Speak Up', 'Inner Power', 'Think Fast']);
    await expect(page.locator('.chain-original ol').nth(3).locator('a')).toHaveText(['Relax', 'Let Go', 'Reset']);
    await expect(page.locator('.chain-original ol').nth(4).locator('a')).toHaveText(["Relax", "Let Go", "Options", "Manifest"]);
    await expect(page.locator('.chain-original ol').nth(5).locator('a')).toHaveText(["Relax", "Inner Power", "Think Fast", "Focus", "Options", "Manifest"]);
    await expect(page.locator('.chain-original ol').nth(6).locator('a')).toHaveText(["Think Fast", "Focus", "Coordination", "Do This Now"]);
    await expect(page.locator('.chain-original ol').nth(7).locator('a')).toHaveText(["Relax", "Body Tune-Up", "Restorative Sleep"]);
    await expect(page.locator('.chain-original ol').nth(8).locator('a')).toHaveText(["Relax", "Sleep", "Restorative Sleep"]);
    await expect(page.locator('.chain-original ol').nth(9).locator('a')).toHaveText(["Relax", "Dream Theme", "Sleep"]);
    await expect(page.locator('.chain-original ol').nth(10).locator('a')).toHaveText(["Relax", "Options", "Contemplation", "Sleep Insight"]);
    await expect(page.locator('.chain-original ol').nth(11).locator('a')).toHaveText(["Relax", "Habit Freedom", "Let Go", "Offload"]);
    await expect(page.locator('.chain-original ol').nth(12).locator('a')).toHaveText(["Relax", "Do This Now", "Think Fast", "Coordination"]);
    await expect(page.locator('.chain-original ol').nth(13).locator('a')).toHaveText(["Relax", "Body Tune-Up", "Circulation", "Restorative Sleep"]);
    await expect(page.locator('.chain-original ol').nth(14).locator('a')).toHaveText(["Relax", "Focus", "Think Fast", "Imprint", "Recall", "Information Access"]);
    await expect(page.locator('.chain-original ol').nth(15).locator('a')).toHaveText(["Relax", "Options", "Sleep Insight"]);
    await expect(page.locator('.chain-original ol').nth(16).locator('a')).toHaveText(['Nutricia', 'Appetite Choice', 'Habit Freedom', 'Detox']);
    await expect(page.locator('.chain-original ol').nth(16).locator('.chain-spoken-cue')).toHaveText(['(Plus Food Less)', '(Plus Satisfied)', '(Plus Free This Habit)', '(Plus Detox)']);
    await expect(page.locator('.chain-original ol li .chain-spoken-cue')).toHaveCount(69);
    await expect(page.locator('.chain-original button')).toHaveCount(0);
    await expect(page.locator('.chain-directory button')).toHaveCount(1);

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await noAxeViolations(page);
    const link = page.locator('.chain-original ol').nth(3).getByRole('link', {name: 'Let Go', exact: true});
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/functions\/OCF-EMO-001\/$/);
    await page.goBack();
    await expect(page.locator('h1')).toHaveText('Function Chains');
    await page.locator('.chain-original ol').nth(3).getByRole('link', {name: 'Reset', exact: true}).click();
    await expect(page).toHaveURL(/functions\/OCF-FND-005\/$/);
    await page.goBack();
    await expect(page.locator('.chain-original ol')).toHaveCount(17);
  }
});


test('branding and four theme choices preserve device defaults and persistent overrides', async ({ page }) => {
  await page.emulateMedia({colorScheme: 'dark'});
  await page.goto('/');
  await expect(page.locator('[data-theme-toggle]')).toHaveText('Theme: System');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await expect(page.locator('.brand-mark')).toHaveAttribute('src', 'assets/branding/ocf-app-icon-128.png');
  expect(await page.locator('.brand-mark').evaluate(img => img.complete && img.naturalWidth === 128)).toBe(true);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', 'assets/branding/ocf-app-icon-32.png');
  const background = () => page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
  const dark = await background();
  await page.emulateMedia({colorScheme: 'light'});
  await expect.poll(background).not.toBe(dark);
  await openPreferences(page);
  const control = page.locator('[data-theme-toggle]');
  for (const name of ['Light', 'Dark', 'Black']) {
    await control.click();
    await expect(control).toHaveText('Theme: ' + name);
  }
  await closePreferences(page);
  await expect.poll(background).toBe('rgb(0, 0, 0)');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#000000');
  await noAxeViolations(page);
  await page.emulateMedia({colorScheme: 'dark'});
  await page.goto('/function-chains/');
  await expect(control).toHaveText('Theme: Black');
  await expect.poll(background).toBe('rgb(0, 0, 0)');
  await page.setViewportSize({width:320,height:900});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await noAxeViolations(page);
  await openPreferences(page);
  await control.click();
  await closePreferences(page);
  await expect(control).toHaveText('Theme: System');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  await page.emulateMedia({colorScheme:'light'});
  await expect.poll(background).not.toBe('rgb(0, 0, 0)');
  await page.reload();
  await expect(control).toHaveText('Theme: System');
});


test('dedicated Start Here and homepage both show all five optional starter links on mobile', async ({page}) => {
  await page.setViewportSize({width:320,height:900});
  const expected = ['OCF-FND-004','OCF-FND-002','OCF-COG-004','OCF-COG-006','OCF-COG-007'];
  for (const [route, selector] of [['/start/', '.start-more > ol a'], ['/', '.starting-practices a']]) {
    await page.goto(route);
    if(route==='/start/') await page.locator('.start-more > summary').click();
    const ids = await page.locator(selector).evaluateAll(links => links.map(a => a.getAttribute('href').match(/OCF-[A-Z]{3}-[0-9]{3}/)[0]));
    expect(ids).toEqual(expected);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await noAxeViolations(page);
    await page.locator(selector).nth(2).click();
    await expect(page).toHaveURL(/functions\/OCF-COG-004\/$/);
    await page.goBack();
    await expect(page.locator(selector)).toHaveCount(5);
  }
});


test('transcript match navigation counts, wraps and preserves keyboard focus', async ({ page }) => {
  await page.setViewportSize({width: 375, height: 900});
  await page.goto('/functions/OCF-FND-004/');
  const t = page.locator('[data-transcript]').first();
  await t.locator(':scope > summary').click();
  await expect(t.locator('[data-transcript-status]')).toContainText('transcript loaded');
  const search = t.locator('[data-transcript-search]');
  await search.fill('relax');
  const count = await t.locator('mark').count();
  expect(count).toBeGreaterThan(1);
  await expect(t.locator('[data-transcript-matches]')).toHaveText(`Match 1 of ${count}`);
  await search.press('Enter');
  await expect(search).toBeFocused();
  await expect(t.locator('[data-transcript-matches]')).toHaveText(`Match 2 of ${count}`);
  await search.press('Shift+Enter');
  await t.locator('[data-transcript-previous]').click();
  await expect(t.locator('[data-transcript-matches]')).toHaveText(`Match ${count} of ${count}`);
  await t.locator('[data-transcript-next]').click();
  await expect(t.locator('[data-transcript-matches]')).toHaveText(`Match 1 of ${count}`);
  await search.fill('zzzz-no-match');
  await expect(t.locator('[data-transcript-matches]')).toHaveText('No matches');
  await expect(t.locator('[data-transcript-next]')).toBeDisabled();
  await search.fill('');
  await expect(t.locator('[data-transcript-navigation]')).toBeHidden();
  await noAxeViolations(page);
});

test('exact lead duplicates are omitted without losing distinct command instructions', async ({ page }) => {
  for (const id of ['OCF-EXP-003','OCF-EXP-005']) {
    await page.goto(`/functions/${id}/`);
    const lead = await page.locator('.lead').innerText();
    const normalize = value => value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
    const paragraphs = await page.locator('.command-block p').allTextContents();
    expect(paragraphs.some(text => normalize(text) === normalize(lead))).toBe(false);
    await expect(page.locator('.command-block .spoken-cue').first()).toBeVisible();
    expect(await page.locator('.command-block ol li').count()).toBeGreaterThan(0);
  }
});

test('both published editions retain exact provenance, downloads and accessible version selection', async ({ page }) => {
  const contracts = [
    ['audio-0.2.0', '0.2.0', 5, 'd75262e2ebd70fcb768bfb6f7cca207fa644bfbee83d6be9cfa94924319e3c43'],
    ['audio-0.1.0-a6-20261111', '0.1.0', 6, '48cb39bcc3dfd7f7e211b3093cd927c3a790cd9ad28d6b47faad956014c85c14'],
  ];
  for (const [tag, version, zipCount, manifestHash] of contracts) {
    const release = publishedCatalog.releases.find(row => row.tag === tag);
    expect(release, `required published edition ${tag}`).toBeDefined();
    expect(release.version).toBe(version);
    expect(release.publication_manifest_sha256).toBe(manifestHash);
    expect(release.functions).toHaveLength(58);
    expect(release.preparations).toHaveLength(1);
    const sessions = [...release.preparations, ...release.functions].flatMap(row => row.sessions);
    expect(sessions).toHaveLength(59);
    expect(sessions.flatMap(session => session.assets)).toHaveLength(118);
    expect(release.collections).toHaveLength(zipCount);
    for (const asset of [...sessions.flatMap(session => session.assets), ...release.collections, ...release.companions]) {
      expect(asset.download_url).toBe(`https://github.com/ocfproject-org/open-consciousness-functions-audio/releases/download/${tag}/${asset.filename}`);
      expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  }
  await page.goto('/functions/');
  const selector = page.getByLabel('Audio edition', {exact: true});
  await expect(selector).toHaveValue('latest');
  await expect(page.locator('.session-card:visible')).toHaveCount(59);
  for (const [, version] of contracts) {
    await selectPreference(page,'Audio edition',version);
    await expect(page.locator('.session-card:visible')).toHaveCount(59);
    expect(await page.locator('.session-card:visible').evaluateAll(cards => [...new Set(cards.map(card => card.dataset.edition))])).toEqual([version]);
    const release = publishedCatalog.releases.find(row => row.version === version);
    const actualURLs = await page.locator('.session-card:visible .asset-row a').evaluateAll(links => links.map(link => link.href).sort());
    const expectedURLs = [...release.preparations, ...release.functions].flatMap(row => row.sessions.flatMap(session => session.assets.map(asset => asset.download_url))).sort();
    expect(actualURLs).toEqual(expectedURLs);
    await noAxeViolations(page, '.library-section');
  }
  await page.reload();
  await expect(selector).toHaveValue('0.1.0');
  await selectPreference(page,'Audio edition','latest');
  await expect(selector).toHaveValue('latest');
  await expect(page.locator('.session-card:visible')).toHaveCount(59);
  await page.goto('/downloads/');
  await expect(page.locator('.download-card[data-edition="0.2.0"]')).toHaveCount(59);
  await expect(page.locator('.download-card[data-edition="0.1.0"]')).toHaveCount(59);
  const current = publishedCatalog.releases.find(row => row.tag === 'audio-0.2.0');
  for (const entry of current.changelog) {
    // The safe renderer turns Markdown links into their visible labels.
    const visible = entry.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    await expect(page.locator('.release-changelog:visible')).toContainText(visible);
  }
});

test('edition changes retain selected-file provenance and an active historical player', async ({ page }) => {
  await useSilentWavFixture(page);
  await page.goto('/functions/');
  const latest = page.locator('.session-card[data-function-id="OCF-FND-004"][data-edition="0.2.0"]');
  const historical = page.locator('.session-card[data-function-id="OCF-FND-004"][data-edition="0.1.0"]');
  const checkbox = latest.getByRole('checkbox', {name: /^Select MP3/});
  await checkbox.check();
  const expectedURL = await latest.getByRole('link', {name: /^Download MP3/}).getAttribute('href');
  await selectPreference(page,'Audio edition','0.1.0');
  await expect(page.locator('#selection-count')).toHaveText('1 file selected (1 hidden by filters)');
  await page.locator('#selected-files-summary').click();
  await expect(page.locator('#selected-files-review').getByRole('link')).toHaveAttribute('href', expectedURL);
  await historical.getByRole('button', {name: /^Show player/}).click();
  const player = historical.locator('audio');
  await player.evaluate(async audio => { audio.load(); await audio.play(); audio.dataset.editionIdentity = 'historical'; });
  await selectPreference(page,'Audio edition','0.2.0');
  await expect(historical).toBeVisible();
  await expect(historical).toHaveAttribute('data-filtered-out', 'true');
  await expect(player).toHaveAttribute('data-edition-identity', 'historical');
  await expect(player).toHaveAttribute('data-session-edition', '0.1.0');
  await expect(checkbox).toBeChecked();
  await expect(page.locator('#selection-count')).toHaveText('1 file selected');
  await player.evaluate(audio => audio.pause());
  await expect(historical).toBeVisible();
});

test('function source history is pinned, keyboard operable, and responsive', async ({ page }) => {
  const guide = await pinnedGuide(page);
  for (const fn of guide.functions) {
    await page.goto(`/functions/${fn.function_id}/`);
    const history = page.locator('#function-history');
    await expect(history).not.toHaveAttribute('open', '');
    await expect(history.locator('a[href*="/commits/"]')).toHaveAttribute('href',
      `${guide.source_repository}/commits/${guide.source_commit}/${fn.canonical_resource}`);
    expect(await history.locator('.source-revisions li').count()).toBeGreaterThan(0);
    expect(await history.locator('.source-revisions li').count()).toBeLessThanOrEqual(5);
  }
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const history = page.locator('#function-history');
    const summary = history.locator('summary');
    await summary.focus();
    for (let cycle = 0; cycle < 3; cycle++) {
      await page.keyboard.press('Enter');
      await expect(history).toHaveAttribute('open', '');
      await expect(history.locator('a').first()).toBeVisible();
      await expect(summary).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.keyboard.press('Space');
      await expect(history).not.toHaveAttribute('open', '');
    }
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(history.locator('a').first()).toBeFocused();
    await noAxeViolations(page, '#function-history');
    await summary.click();
  }
});

test('function source history works without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto('/functions/OCF-BOD-003/');
    const history = page.locator('#function-history');
    await history.locator('summary').click();
    await expect(history.locator('a').first()).toBeVisible();
    await history.locator('summary').click();
    await expect(history.locator('a').first()).not.toBeVisible();
  } finally {
    await context.close();
  }
});

// Presentation only: source values and exact-edition assets remain untouched.
test('function guides show original copy without a Precautions section', async ({ page }) => {
  await page.goto('/functions/OCF-EXP-007/');
  await expect(page.locator('#overview')).not.toContainText('Documented practice intent:');
  await expect(page.locator('#safety, a[href="#safety"]')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('no physical field, protection or guaranteed effect is claimed');
  await expect(page.locator('main')).not.toContainText('Function-specific notes:');
  await expect(page.locator('#listening')).toBeVisible();
  await noAxeViolations(page);
  await page.goto('/functions/OCF-EMG-001/');
  await expect(page.locator('main')).toContainText('call your local emergency number first.');
  await expect(page.locator('#safety, a[href="#safety"]')).toHaveCount(0);
});
