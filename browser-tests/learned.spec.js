const {test, expect} = require('@playwright/test');
const {selectPreference} = require('./preferences');
const {createHash} = require('node:crypto');
const {canonical} = require('../site/assets/js/learned.js');
const KEY = 'ocf-learned:v1';
const route = '/functions/OCF-AUT-001/';
const panel = page => page.locator('.learned-panel');
const saved = page => page.evaluate(key => Object.keys(localStorage).filter(k => k.startsWith(`${key}:record:`)).map(k => JSON.parse(localStorage[k])), KEY);
async function ready(page, url = route) {
  await page.goto(url); await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByRole('status')).toContainText(/Tracking is (off|enabled)/);
  await panel(page).getByText('Mark learned and manage private records', {exact: true}).click();
}
async function enable(page) { await panel(page).getByRole('button', {name: 'Enable private learned tracking'}).click(); }
async function mark(page, value = '0') {
  await panel(page).getByLabel('What did you learn?').selectOption(value);
  await panel(page).getByRole('button', {name: 'Mark learned / save another version'}).click();
  await expect(panel(page).getByRole('status')).toContainText(/saved/);
}
async function importPreview(page, value) {
  const details = panel(page).getByText('Back up, import or reset learned records', {exact: true}).locator('..');
  if ((await details.getAttribute('open')) === null) await details.locator('summary').click();
  await panel(page).getByLabel('Choose a learned JSON backup').setInputFiles({name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))});
}
test('opt-in self-report records exact guide and audio independently, retains versions and deduplicates', async ({page}) => {
  const writes = []; page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
  await ready(page);
  expect(await saved(page)).toEqual([]);
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBeNull();
  await expect(page.locator('main .page-intro + .learned-panel')).toBeVisible();
  await enable(page); await mark(page, '0');
  let records = await saved(page); expect(records).toHaveLength(1);
  expect(records[0].guide.commit).toBe('c79421aee896c49e7da8e52c9171aa5568274291');
  expect(records[0].recording.source_commit).toBe('3bcb8c13214d4d934fb1cddfbe360103c7be0778');
  expect(records[0].recording.tag).toBe('audio-0.2.0');
  expect(records[0].recording.render_source.snapshot_sha256).toMatch(/^a969/);
  await expect(panel(page)).not.toContainText('New audio edition available');
  await expect(panel(page)).not.toContainText('See differences');
  for (let i = 0; i < 3; i++) await mark(page, '0');
  expect(await saved(page)).toHaveLength(1);
  await selectPreference(page, 'Audio edition', '0.1.0'); expect(await saved(page)).toHaveLength(1);
  await mark(page, '1'); expect(await saved(page)).toHaveLength(2);
  await panel(page).locator('summary').filter({hasText: 'audio-0.1.0'}).click();
  await expect(panel(page).getByText('New audio edition available;', {exact: false})).toBeVisible();
  await expect(panel(page).getByRole('link', {name: 'Published release notes for audio-0.2.0'})).toHaveAttribute('href', 'https://github.com/ocfproject-org/open-consciousness-functions-audio/releases/tag/audio-0.2.0');
  await mark(page, 'guide'); expect(await saved(page)).toHaveLength(3);
  await page.reload(); await expect(panel(page)).toContainText('1 learned functions');
  expect(await saved(page)).toHaveLength(3); expect(writes).toEqual([]);
  expect(page.url()).not.toContain('learned');
});
test('learned filters compose across Browse, Quick Reference, navigation and back', async ({page}) => {
  await ready(page); await enable(page); await mark(page);
  await ready(page, '/functions/');
  await expect(page.locator('.session-card')).toHaveCount(118);
  await panel(page).getByLabel('My learned functions only').check();
  await expect(page.locator('.session-card:visible')).toHaveCount(1);
  await expect(page.locator('.session-card:visible')).toHaveAttribute('data-function-id', 'OCF-AUT-001');
  await page.locator('#search').fill('no-such-function'); await expect(page.locator('.session-card:visible')).toHaveCount(0);
  await page.locator('#search').fill(''); await expect(page.locator('.session-card:visible')).toHaveCount(1);
  expect(page.url()).not.toContain('learned');
  await ready(page, '/quick-reference/'); await panel(page).getByLabel('My learned functions only').check();
  await expect(page.locator('[data-reference-row]:visible')).toHaveCount(1);
  await expect(page.locator('[data-reference-row]:visible')).toHaveAttribute('data-learned-id', 'OCF-AUT-001');
  await panel(page).getByLabel('My learned functions only').uncheck(); await expect(page.locator('[data-reference-row]:visible')).toHaveCount(58);
  await page.goBack(); await expect(panel(page)).toContainText('1 learned functions');
  expect(await saved(page)).toHaveLength(1);
});
test('strict import preview preserves existing records; differences use text and fixed source links', async ({page}) => {
  await ready(page); await enable(page); await mark(page);
  const existing = (await saved(page))[0];
  for (const value of ['{', {schema: 2, records: []}, {schema: 1, records: [{...existing, subject: 'unrecognized'}]}, {schema: 1, records: [{...existing, extra: 'bad'}]}]) {
    await importPreview(page, value); await expect(panel(page).getByRole('status')).toContainText('Unsupported or corrupt');
    expect(await saved(page)).toHaveLength(1);
  }
  const changed = structuredClone(existing); changed.id = '01234567-1234-1234-1234-012345678901'; changed.guide.commit = 'a'.repeat(40);
  changed.guide.snapshot.fields.description = '<img src=x onerror="window.BAD=true">old public guide text';
  changed.guide.fingerprint = createHash('sha256').update(canonical(changed.guide.snapshot)).digest('hex');
  await importPreview(page, {schema: 1, records: [existing, changed]});
  await expect(panel(page)).toContainText('1 new records; 1 already saved'); expect(await saved(page)).toHaveLength(1);
  await panel(page).getByRole('button', {name: 'Confirm import and merge'}).click();
  await expect(panel(page).getByRole('status')).toContainText('1 records merged'); expect(await saved(page)).toHaveLength(2);
  const difference = panel(page).getByText('See differences in tracked public guide fields', {exact: true}).locator('../..');
  await difference.locator(':scope > summary').click();
  const nested = difference.locator('details'); await nested.locator('summary').click();
  await expect(nested).toContainText('<img src=x onerror="window.BAD=true">');
  expect(await page.evaluate(() => window.BAD)).toBeUndefined();
  await expect(nested.locator('img')).toHaveCount(0);
  const downloadPromise = page.waitForEvent('download'); await panel(page).getByRole('button', {name: 'Export learned backup'}).click();
  expect((await downloadPromise).suggestedFilename()).toBe('ocf-learned-private-backup.json');
  page.once('dialog', dialog => dialog.dismiss()); await panel(page).getByRole('button', {name: 'Reset all learned records'}).click(); expect(await saved(page)).toHaveLength(2);
  page.once('dialog', dialog => dialog.accept()); await panel(page).getByRole('button', {name: 'Reset all learned records'}).click();
  await expect(panel(page).getByRole('status')).toContainText('Tracking is off'); expect(await saved(page)).toHaveLength(0);
});
test('blocked storage stays memory-only without falling back to session storage or URLs', async ({page}) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', {get() { throw Error('blocked'); }}));
  await ready(page); await expect(panel(page).getByRole('status')).toContainText('only in memory');
  await enable(page); await mark(page); await expect(panel(page)).toContainText('1 learned functions');
  expect(await page.evaluate(() => Object.keys(sessionStorage).some(k => k.includes('learned')))).toBe(false);
  expect(await page.evaluate(() => window.name)).not.toContain('learned');
  await page.reload(); await expect(panel(page)).toContainText('0 learned functions');
});
test('multi-tab additions, removals and reset do not resurrect older records', async ({page, context}) => {
  await ready(page); await enable(page); await mark(page);
  const other = await context.newPage(); await ready(other, '/functions/OCF-BOD-001/');
  await mark(other, 'guide'); await expect(panel(page)).toContainText('2 learned functions');
  await panel(page).locator('summary').filter({hasText: 'audio-0.2.0'}).click();
  page.once('dialog', dialog => dialog.accept()); await panel(page).getByRole('button', {name: 'Remove this learned version'}).click();
  await expect(panel(page).getByRole('status')).toBeFocused();
  await expect(panel(other)).toContainText('1 learned functions');
  await panel(other).getByText('Back up, import or reset learned records', {exact: true}).click();
  other.once('dialog', dialog => dialog.accept()); await panel(other).getByRole('button', {name: 'Reset all learned records'}).click();
  await expect(panel(page).getByRole('status')).toContainText('Tracking is off');
  await page.reload(); await expect(panel(page)).toContainText('0 learned functions'); await other.close();
});
test('Preparation distinguishes official Human Plus unknown edition from OCF audio without adding a function', async ({page}) => {
  await ready(page, '/preparation-learning/');
  await page.locator('.preparation-exception summary').click();
  await expect(page.getByText('Only people who have already learned the official Human Plus preparation track may skip it.', {exact: false}).first()).toBeVisible();
  await enable(page); await mark(page, 'external');
  let records = await saved(page); expect(records[0].subject).toBe('preparation:human-plus'); expect(records[0].guide).toBeNull(); expect(records[0].recording).toBeNull(); expect(records[0].external).toEqual({edition: null, date: null});
  await mark(page, '0'); records = await saved(page); expect(records).toHaveLength(2);
  await expect(panel(page)).toContainText('0 learned functions; 2 separate preparation records');
});
test('keyboard, repeated disclosures, small screens and axe accessibility', async ({page}) => {
  await page.setViewportSize({width: 375, height: 812}); await ready(page);
  const enableButton = panel(page).getByRole('button', {name: 'Enable private learned tracking'});
  await enableButton.focus(); await page.keyboard.press('Enter'); await mark(page);
  const summary = panel(page).locator('summary').filter({hasText: 'audio-0.2.0'});
  for (let i = 0; i < 4; i++) { await summary.focus(); await page.keyboard.press('Enter'); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.addScriptTag({path: require.resolve('axe-core/axe.min.js')});
  const results = await page.evaluate(() => axe.run('.learned-panel', {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']}}));
  expect(results.violations).toEqual([]);
  await page.screenshot({path: 'browser-artifacts/learned-mobile.png', fullPage: true});
});
test('learned filter preserves an active unmatched player, edition preference and Surprise history', async ({page}) => {
  await ready(page); await enable(page); await mark(page);
  await ready(page, '/functions/');
  await expect(page.locator('.session-card')).toHaveCount(118);
  const player = page.locator('.session-card[data-function-id="OCF-BOD-001"][data-edition="0.2.0"] audio').first();
  const wav = Buffer.alloc(44 + 8000 * 30, 128);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVE', 8); wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(8000, 28); wav.writeUInt16LE(1, 32); wav.writeUInt16LE(8, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
  await page.locator('.session-card[data-function-id="OCF-BOD-001"][data-edition="0.2.0"]').getByRole('button', {name: /Show player/}).click();
  await expect(player).toBeVisible();
  expect(await player.evaluate(audio => audio.paused)).toBe(true);
  await player.evaluate(async (audio, src) => { audio.src = src; await audio.play(); }, `data:audio/wav;base64,${wav.toString('base64')}`);
  const before = await page.evaluate(key => Object.fromEntries(Object.entries(localStorage).filter(([k]) => !k.startsWith(key))), KEY);
  await panel(page).getByLabel('My learned functions only').check();
  await expect(player).toBeVisible(); expect(await player.evaluate(audio => audio.paused)).toBe(false);
  await expect(player.locator('..')).toBeVisible();
  expect(await page.evaluate(key => Object.fromEntries(Object.entries(localStorage).filter(([k]) => !k.startsWith(key))), KEY)).toEqual(before);
  await panel(page).getByLabel('My learned functions only').uncheck();
  expect(await player.evaluate(audio => audio.paused)).toBe(false);
});
test('corrupt local data is preserved and reported; future schemas need deliberate reset', async ({page}) => {
  await page.addInitScript(key => {
    localStorage.setItem(key, JSON.stringify({schema: 99, epoch: 'bad'}));
    localStorage.setItem(`${key}:record:unknown:unknown`, '{broken');
  }, KEY);
  await page.goto(route); await expect(panel(page).getByRole('status')).toContainText('unsupported or corrupt');
  await panel(page).getByText('Mark learned and manage private records', {exact: true}).click();
  await panel(page).getByRole('button', {name: 'Enable private learned tracking'}).click();
  await expect(panel(page).getByRole('status')).toContainText('Reset unsupported settings');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).schema, KEY)).toBe(99);
});
test('optional controls remain compact by default, including many saved records', async ({page}) => {
  await ready(page); await enable(page); await mark(page);
  await page.goto('/functions/');
  await expect(panel(page).getByText('Mark learned and manage private records', {exact: true})).toBeVisible();
  await expect(panel(page).getByRole('button', {name: 'Export learned backup'})).not.toBeVisible();
  await expect(panel(page).getByLabel('My learned functions only')).toBeVisible();
  await expect(panel(page)).toContainText('1 learned functions');
});
test('same edition with a different immutable digest is retained but never silently verified', async ({page}) => {
  await ready(page); await enable(page); await mark(page);
  const record = (await saved(page))[0];
  record.id = '01234567-1234-1234-1234-012345678901'; record.recording.master_sha256 = '0'.repeat(64);
  await importPreview(page, {schema: 1, records: [record]});
  await panel(page).getByRole('button', {name: 'Confirm import and merge'}).click();
  await expect(panel(page).getByRole('status')).toContainText('1 records merged');
  expect(await saved(page)).toHaveLength(2);
  const summaries = panel(page).locator('summary').filter({hasText: 'audio-0.2.0'});
  await summaries.nth(0).click(); await summaries.nth(1).click();
  await expect(panel(page).getByText('This saved recording identity is not present', {exact: false})).toBeVisible();
  await expect(panel(page)).not.toContainText('New audio edition available');
});
test('delayed public data preserves repeated reload fragments without overriding user scrolling', async ({page}) => {
  let release;
  let gate = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/data/learning.json*', async route => { await gate; await route.continue(); });
  await page.goto('/functions/OCF-SLP-002/#cues', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#cues')).toBeInViewport();
  release(); await expect(panel(page).getByRole('status')).toContainText('Tracking is off');
  await expect(page.locator('#cues')).toBeInViewport();
  for (let i = 0; i < 2; i++) {
    gate = new Promise(resolve => { release = resolve; });
    await page.reload({waitUntil: 'domcontentloaded'});
    await expect(page.locator('#cues')).toBeInViewport();
    release(); await expect(panel(page).getByRole('status')).toContainText('Tracking is off');
    await expect(page.locator('#cues')).toBeInViewport();
  }
  gate = new Promise(resolve => { release = resolve; });
  await page.reload({waitUntil: 'domcontentloaded'});
  await expect(page.locator('#cues')).toBeInViewport();
  await page.waitForLoadState('load');
  await page.keyboard.press('Control+End');
  await expect(page.locator('#cues')).not.toBeInViewport();
  release(); await expect(panel(page).getByRole('status')).toContainText('Tracking is off');
  await expect(page.locator('#cues')).not.toBeInViewport();
});
test('expanded private controls and records are accessible in light, dark and black themes', async ({page}) => {
  await page.setViewportSize({width: 320, height: 812}); await ready(page); await enable(page); await mark(page);
  await panel(page).locator('summary').filter({hasText: 'audio-0.2.0'}).click();
  await panel(page).getByText('Back up, import or reset learned records', {exact: true}).click();
  await page.addScriptTag({path: require.resolve('axe-core/axe.min.js')});
  for (const theme of ['light', 'dark', 'black']) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const result = await page.evaluate(() => axe.run('.learned-panel', {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']}}));
    expect(result.violations).toEqual([]);
    await panel(page).screenshot({path: `browser-artifacts/learned-panel-${theme}.png`});
  }
});
