const { test, expect } = require('@playwright/test');
const { selectPreference } = require('./preferences');

const repo = 'https://github.com/ocfproject-org/open-consciousness-functions-audio/issues/new';
const issueLink = scope => scope.getByRole('link', { name: /^Report an issue with / });
const recordingId = group => group.function_id || 'preparation-learning';

async function expectIssue(link, release, group, session) {
  await expect(link).toBeVisible();
  await expect(link).toHaveText('Report an issue');
  await expect(link).toHaveAttribute('rel', 'noreferrer');
  const url = new URL(await link.getAttribute('href'));
  expect(url.origin + url.pathname).toBe(repo);
  expect([...url.searchParams.keys()].sort()).toEqual(['body', 'title']);
  expect(url.hash).toBe('');
  const title = session.title || group.title;
  expect(url.searchParams.get('title')).toBe(`Recording issue: ${title} (${recordingId(group)})`);
  expect(url.searchParams.get('body').split('\n').slice(0, 5)).toEqual([
    `Recording: ${title} (${recordingId(group)})`,
    `Audio release: ${release.tag}`,
    `Edition: ${session.edition}`,
    `Voice: ${session.voice_name || session.voice_id} (${session.voice_id})`,
    `Locale: ${session.locale}`,
  ]);
  return url;
}

test('function player links to a GitHub issue draft for the exact current and historical recordings', async ({page, request}) => {
  const {releases} = await request.get('/catalog.json').then(r => r.json());
  const id = 'OCF-FND-004';
  await page.goto(`/functions/${id}/?private=should-not-be-included`);
  for (const release of [releases[0], releases.at(-1)]) {
    if (release !== releases[0]) {
      await selectPreference(page, 'Audio edition', release.version);
    }
    const group = release.functions.find(g => g.function_id === id);
    const session = group.sessions[0];
    const card = page.locator(`.edition-card[data-edition-content="${session.edition}"]:visible`).first();
    const link = issueLink(card);
    const url = await expectIssue(link, release, group, session);
    expect(url.href).not.toContain('should-not-be-included');
  }
  // Verify that activating the link navigates by GET to a draft, without contacting GitHub or posting.
  let attempted;
  await page.route(`${repo}?*`, async route => {
    attempted = {method: route.request().method(), url: route.request().url()};
    await route.fulfill({status: 200, contentType: 'text/html', body: '<title>Public issue draft</title>'});
  });
  await issueLink(page.locator('.edition-card:visible').first()).press('Enter');
  await expect(page).toHaveTitle('Public issue draft');
  expect(attempted?.method).toBe('GET');
  expect(new URL(attempted.url).searchParams.get('body')).toContain(`Audio release: ${releases.at(-1).tag}`);
});

test('recording reports follow dynamic Browse and respect the Surprise Me reveal', async ({page, request}) => {
  const {releases: [release]} = await request.get('/catalog.json').then(r => r.json());
  await page.goto('/functions/');
  const id = 'OCF-FND-004';
  const card = page.locator(`.session-card[data-function-id="${id}"]:visible`).first();
  const group = release.functions.find(g => g.function_id === id);
  await expectIssue(issueLink(card), release, group, group.sessions[0]);
  await card.getByRole('button', {name: /^Show player for/}).click();
  await expect(card.getByRole('button', {name: 'Play'})).toBeVisible();
  await expectIssue(issueLink(card), release, group, group.sessions[0]);

  const surprise = page.locator('.surprise-session');
  await surprise.getByRole('checkbox', {name: /Hide session details/}).check();
  await surprise.getByRole('button', {name: 'Surprise me'}).click();
  await expect(surprise.locator('.recording-issue-link')).toHaveCount(0);
  await surprise.getByRole('button', {name: 'Show more'}).click();
  const text = await surprise.locator('h4').textContent();
  const selectedGroup = release.functions.find(g => g.sessions.some(s => (s.title || g.title) === text));
  const selectedSession = selectedGroup.sessions.find(s => (s.title || selectedGroup.title) === text);
  await expectIssue(issueLink(surprise), release, selectedGroup, selectedSession);
  await surprise.getByRole('checkbox', {name: /Hide session details/}).check();
  // The checkbox is already selected after reveal: toggling it back to selected should hide the link again.
  await surprise.getByRole('checkbox', {name: /Hide session details/}).uncheck();
  await surprise.getByRole('checkbox', {name: /Hide session details/}).check();
  await expect(surprise.locator('.recording-issue-link')).toHaveCount(0);
});

test('Preparation Learning and Downloads keep working report links without JavaScript', async ({browser, request}) => {
  const {releases: [release]} = await request.get('/catalog.json').then(r => r.json());
  const context = await browser.newContext({javaScriptEnabled: false});
  try {
    const page = await context.newPage();
    const prep = release.preparations[0];
    await page.goto('/preparation-learning/');
    await expectIssue(issueLink(page.locator('.edition-card:visible').first()), release, prep, prep.sessions[0]);
    await page.goto('/downloads/');
    const id = 'OCF-FND-004';
    const group = release.functions.find(g => g.function_id === id);
    await expectIssue(issueLink(page.locator(`.download-card[data-function-id="${id}"]:visible`).first()), release, group, group.sessions[0]);
  } finally {
    await context.close();
  }
});
