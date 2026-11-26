const {test, expect} = require('@playwright/test');

test('home explains the site and links to the audio and session explanations', async ({page}) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({width, height: 900});
    await page.goto('/');
    await expect(page.locator('#home-title')).toContainText('Guided audio for focus,');
    await expect(page.locator('.hero-lede')).toContainText('a short phrase, called a cue');
    await expect(page.locator('#practice-paths-title')).toHaveText('What’s an OCF function?');
    await expect(page.locator('#site-footer').getByRole('link', {name: 'Glossary and FAQ'})).toHaveAttribute('href', 'learn/glossary/');
    await page.getByRole('link', {name: 'What’s in a session', exact: true}).click();
    await expect(page).toHaveURL(/how-it-works\/#what-a-typical-function-session-looks-like$/);
    await expect(page.locator('#what-a-typical-function-session-looks-like + ol li')).toHaveCount(5);
    await expect(page.locator('#what-the-stereo-audio-does + p')).toContainText('background layers');
    await expect(page.locator('#what-you-hear')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('every glossary and FAQ heading has a unique native direct link and inline references', async ({page}) => {
  await page.setViewportSize({width: 375, height: 812});
  await page.goto('/glossary/#energy-ball');
  const headings = page.locator('main article :is(h2,h3)[id]');
  expect(await headings.count()).toBeGreaterThan(14);
  const ids = await headings.evaluateAll(nodes => nodes.map(node => node.id));
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) {
    await expect(page.locator(`#${id} > a`)).toHaveAttribute('href', '#' + id);
  }
  await expect(page.locator('#energy-ball + p a')).toHaveCount(2);
  await expect(page.locator('#resonant-tuning + p').getByRole('link', {name: /Monroe Institute/})).toHaveAttribute('href', /monroeinstitute.org/);
  await page.locator('#energy-ball > a').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/glossary\/#energy-ball$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const path of ['/start/', '/listening/']) {
    await page.goto(path);
    await expect(page.locator('#glossary-link a').first()).toHaveAttribute('href', '../learn/glossary/');
  }
});

test('the menu and older glossary URL lead straight to the full searchable glossary', async ({page}) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({width, height: 900});
    await page.goto('/glossary/#common-questions');
    await expect(page.locator('#common-questions')).toBeVisible();
    await page.getByRole('link', {name:'Open the full searchable glossary', exact:true}).click();
    await expect(page).toHaveURL(/learn\/glossary\/$/);
    await expect(page.getByRole('searchbox')).toBeVisible();
    await page.locator('.learn-nav').getByRole('link', {name:'Concept FAQ', exact:true}).click();
    await expect(page).toHaveURL(/learn\/faq\/$/);
    await page.locator('.learn-nav').getByRole('link', {name:'Full glossary', exact:true}).click();
    await expect(page.getByRole('searchbox')).toBeVisible();
    await page.goto('/');
    const menu = page.locator(width < 700 ? '.mobile-nav' : '.more-menu');
    await menu.locator('summary').click();
    await menu.getByRole('link', {name:'Glossary and FAQ', exact:true}).click();
    await expect(page).toHaveURL(/learn\/glossary\/$/);
    await expect(page.getByRole('searchbox')).toBeVisible();
  }
});

test('cue explanation distinguishes activation from repeating the lesson', async ({page}) => {
  await page.goto('/how-it-works/#cues-are-like-human-hotkeys');
  await expect(page.getByRole('heading',{name:/Cues are like human hotkeys/})).toBeVisible();
  await expect(page.locator('#cues-are-like-human-hotkeys + p')).toContainText('Repeat it as needed');
  await expect(page.locator('#cues-are-like-human-hotkeys + p')).toContainText('Once the cue works for you');
  await expect(page.locator('#cues-are-like-human-hotkeys + p + p')).toContainText('don’t have to repeat');
  await expect(page.getByText(/Let it happen without checking whether it’s working/)).toBeVisible();
  await page.locator('#cues-are-like-human-hotkeys + p + p + p').getByRole('link',{name:'Relax',exact:true}).click();
  await expect(page).toHaveURL(/functions\/OCF-FND-004\/$/);
  await expect(page.getByText('Plus Relax',{exact:true}).first()).toBeVisible();
  await page.goto('/glossary/#cue');
  await expect(page.locator('#cue + p')).toContainText('human hotkey');
  await page.goto('/learn/glossary/#function-command');
  await expect(page.locator('#function-command')).toContainText('human hotkey');
  await page.goto('/learn/faq/#learned');
  await expect(page.locator('#learned')).toContainText('without replaying the learning track');
  await expect(page.locator('#learned')).toContainText('do the guided session again as needed');
});

test('Transmutation Box examples are figurative and optional cues link to their guides', async ({page}) => {
  for (const [path, selector] of [
    ['/glossary/#transmutation-box', 'main'],
    ['/learn/glossary/#transmutation-box', '#transmutation-box'],
    ['/learn/faq/#box-contents', '#box-contents'],
  ]) {
    await page.goto(path);
    const content = page.locator(selector);
    await expect(content.getByText(/keys, wallet, phone or work phone/)).toBeVisible();
    await expect(content.getByText(/cue you already know as taught/)).toBeVisible();
    await expect(content.getByRole('link',{name:'Plus Let Go',exact:true})).toHaveAttribute('href',/functions\/OCF-EMO-001\/$/);
    await expect(content.getByRole('link',{name:'Plus Offload',exact:true})).toHaveAttribute('href',/functions\/OCF-EMO-002\/$/);
  }
});

test('pre-meditation cue example is optional and links to the existing instructions', async ({page}) => {
  await page.goto('/how-it-works/#use-a-learned-cue-before-you-meditate');
  const example=page.locator('#use-a-learned-cue-before-you-meditate + p');
  await expect(example).toContainText('a cue you already know');
  for (const [name,id] of [['Plus Relax','OCF-FND-004'],['Plus Focus','OCF-FND-002'],['Plus Inner Power','OCF-PRF-002']]) {
    await expect(example.getByRole('link',{name,exact:true})).toHaveAttribute('href','../functions/'+id+'/');
  }
  await expect(page.locator('#use-a-learned-cue-before-you-meditate + p + p')).toContainText('not a three-step routine');
});

test('listening guidance explains that OCF writes with aphantasia in mind', async ({page}) => {
  await page.setViewportSize({width:375,height:812});
  await page.goto('/listening/#imagery-is-not-required');
  const paragraph=page.locator('#imagery-is-not-required + p');
  await expect(paragraph).toContainText('with aphantasia in mind');
  await paragraph.getByRole('link',{name:'aphantasia',exact:true}).click();
  await expect(page).toHaveURL(/learn\/glossary\/#aphantasia$/);
  await expect(page.locator('#aphantasia')).toContainText('intentionally written with aphantasia in mind');
  await page.goto('/learn/faq/#no-visual');
  await expect(page.locator('#no-visual')).toContainText('intentionally worded with aphantasia in mind');
});

test('the Energy Ball tip supports visual, nonvisual and mixed approaches', async ({page}) => {
  for (const [path, selector] of [
    ['/glossary/#energy-ball', 'main article'],
    ['/learn/glossary/#rebal', '#rebal'],
  ]) {
    await page.goto(path);
    const copy=page.locator(selector);
    const tip = copy.locator("p").filter({hasText: "Aphantasia-friendly tip:"});
    await expect(tip).toContainText("spinning so fast it’s invisible");
    await expect(tip).toContainText("No picture needed.");
    await expect(tip).toContainText("feeling of being energized or powered up");
    await expect(copy.getByText(/vivid colors, light, or trails/)).toBeVisible();
  }
  await page.goto('/listening/#imagery-is-not-required');
  await expect(page.locator('#imagery-is-not-required + p')).toContainText('If images come naturally, use them.');
  await expect(page.getByRole('link', {name: 'aphantasia-friendly Energy Ball tip'})).toHaveAttribute('href', '../learn/glossary/#rebal');
});

test('the Energy Ball function guide has its own aphantasia-friendly tip', async ({page}) => {
  await page.goto('/functions/OCF-EXP-007/#aphantasia-friendly-tip');
  const tip = page.getByRole('region', {name: 'Aphantasia-friendly tip'});
  await expect(tip.getByRole('heading', {name: 'Aphantasia-friendly tip'})).toBeVisible();
  await expect(tip.locator('p').first()).toContainText('spinning so fast it’s invisible');
  await expect(tip.locator('p').first()).toContainText('feeling of being energized or powered up');
  await expect(tip.locator('p').nth(1)).toContainText('You can use images, feelings, or both.');
  await expect(page.getByRole('link', {name: 'Aphantasia-friendly tip'})).toHaveAttribute('href', '#aphantasia-friendly-tip');
  await page.setViewportSize({width: 390, height: 844});
  await expect(tip).toBeVisible();
  await page.locator('.mobile-toc > summary').click();
  await expect(page.locator('.mobile-toc').getByRole('link', {name: 'Aphantasia-friendly tip'})).toBeVisible();
  await page.goto('/functions/OCF-FND-004/');
  await expect(page.locator('#aphantasia-friendly-tip')).toHaveCount(0);
});

test('Energy Ball recommends learning Access to Energy without requiring it', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/functions/OCF-EXP-007/#optional-preparation');
  const note = page.locator('.function-intro #optional-preparation');
  await expect(note).toContainText('Optional: Consider learning Access to Energy before Energy Ball.');
  await expect(note).toContainText('If you already know it, you can use it during the session.');
  await expect(note).toContainText('You can also learn Energy Ball on its own.');
  await note.getByRole('link', {name: 'Access to Energy'}).click();
  await expect(page).toHaveURL(/functions\/OCF-FND-001\/$/);
  await expect(page.getByRole('heading', {name: 'Access to Energy', exact: true, level: 1})).toBeVisible();
  await expect(page.locator('#optional-preparation')).toHaveCount(0);
});

test('primary activation precedes secondary cues on function pages and the Quick Reference', async ({page}) => {
  for (const [id, cues] of [
    ['OCF-EXP-007', ['Plus Inflate', 'Plus Deflate']],
    ['OCF-EXP-005', ['Plus Clear Zone', 'Plus Clear Zone, Observe', 'Plus Clear Zone, Suspend']],
  ]) {
    await page.goto(`/functions/${id}/#cues`);
    await expect(page.locator('.command-block .spoken-cue')).toHaveText(cues);
    await expect(page.locator('.command-block h3').first()).toHaveText('Primary activation');
  }
  await page.goto('/quick-reference/');
  const energyBall = page.getByRole('row').filter({has: page.getByRole('link', {name: 'Energy Ball', exact: true})});
  await expect(energyBall.locator('.cue-role')).toHaveText(['Primary', 'Secondary']);
  await expect(energyBall.locator('[data-label="Current cues"] strong')).toHaveText(['Plus Inflate', 'Plus Deflate']);
  await page.goto('/downloads/');
  await expect(page.locator('[data-function-id="OCF-EXP-007"] .download-cues').first()).toContainText('Plus Inflate · Plus Deflate');
});

test('Energy Ball common uses include travel, healing intentions and a sense of protection', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/functions/OCF-EXP-007/#common-use-examples');
  const uses = page.locator('#common-use-examples');
  await expect(uses).toBeVisible();
  await expect(uses.getByRole('listitem').filter({hasText: 'Travel:'})).toContainText('Before a car trip, bike ride, or flight');
  await expect(uses.getByRole('listitem').filter({hasText: 'Healing intention:'})).toContainText('set an intention for healing');
  await expect(uses.getByRole('listitem').filter({hasText: 'Feeling protected:'})).toContainText('as a boundary around you');
  await expect(uses.getByRole('listitem')).toHaveCount(6);
  await page.goto('/functions/OCF-FND-001/');
  await expect(page.locator('#common-use-examples')).toHaveCount(0);
});
