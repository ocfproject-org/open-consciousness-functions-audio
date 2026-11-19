'use strict';
const assert = require('node:assert/strict');
const {matches, normalize, safeTranscript, rankDownloads, normalizeCue} = require('../site/assets/js/docs.js');

const card = {
  dataset: {
    search: 'relax plus-relax attention',
    category: 'foundation sleep',
    audio: 'yes',
    language: 'en-US|es-ES',
    voice: 'Mike — Original Voice',
  },
};
assert.equal(normalize('  ＰＬＵＳ—ＲＥＬＡＸ  '), 'plus relax');
assert.equal(matches(card, 'PLUS-RELAX'), true);
assert.equal(matches(card, '  Plus   Relax  '), true);
assert.equal(matches(card, '', 'foundation', 'yes', 'en-US', 'Mike — Original Voice'), true);
assert.equal(matches(card, '', 'cognition'), false);
assert.equal(matches(card, '', '', 'no'), false);
assert.equal(matches(card, '', '', '', 'fr-FR'), false);
assert.equal(matches(card, '', '', '', 'en-US', 'Mike — Original Voice'), true);
const innerPower = {dataset: {search: 'OCF-PRF-002 Inner Power Plus Inner Power'}};
const strongQuick = {dataset: {search: 'OCF-PRF-006 Strong-Quick Plus Strong Quick'}};
assert.equal(matches(innerPower, 'PLUS-STRONG'), false);
assert.equal(matches(strongQuick, 'PLUS-STRONG'), true);
assert.equal(safeTranscript('../../transcripts/asset-a.txt', 'https://example.test/functions/OCF-FND-004/'), 'https://example.test/transcripts/asset-a.txt');
assert.equal(safeTranscript('https://attacker.test/transcripts/a.txt', 'https://example.test/'), null);
assert.equal(safeTranscript('../../outside.txt', 'https://example.test/functions/OCF-FND-004/'), null);
console.log('Documentation UI logic: 13 assertions passed');

const download = (title, cues = [], secondary = '') => ({dataset: {downloadTitle: title, downloadCues: JSON.stringify(cues), downloadSearch: `${title} ${cues.join(' ')} ${secondary}`}});
const secondary = download('Options', ['Plus Options'], 'manifest foundation');
const exact = download('Manifest', ['PLUS MANIFEST']);
const prefix = download('Manifest More');
const fragment = download('More Manifest');
const same = download('Manifest', ['Plus Manifest']);
const typo = download('Manifast');
const pool = [secondary, fragment, prefix, exact, same, typo];
for (const query of ['Manifest', 'ＭＡＮＩＦＥＳＴ', ' manifest ']) {
 assert.deepEqual(rankDownloads(pool, query).matches, [exact, same, prefix, fragment, secondary]);
 assert.equal(rankDownloads(pool, query).fuzzy, false);
}
for (const query of ['PLUS-MANIFEST', 'Plus: Manifest', 'plus—manifest', 'Ｍａｎｉｆｅｓｔ!']) assert.equal(rankDownloads(pool, query).matches[0], exact);
assert.equal(normalizeCue('PLUS—Manifest!'), 'manifest');
assert.deepEqual(rankDownloads(pool, '').matches, pool);
assert.deepEqual(rankDownloads(pool, 'foundation').matches, [secondary]);
assert.deepEqual(rankDownloads(pool, 'zzzzzzzz').matches, []);
assert.deepEqual(rankDownloads([exact], 'man').matches, [exact]);
assert.deepEqual(rankDownloads([exact], 'manfiest'), {matches: [exact], fuzzy: true});
assert.deepEqual(rankDownloads([exact], 'Manifestt'), {matches: [exact], fuzzy: true});
assert.deepEqual(rankDownloads([exact], 'xyz'), {matches: [], fuzzy: false});
assert.deepEqual(rankDownloads([exact], 'x'.repeat(65)).matches, []);
assert.deepEqual(rankDownloads([secondary, exact], 'manifest').matches, [exact, secondary]);
assert.deepEqual(pool, [secondary, fragment, prefix, exact, same, typo]);
console.log('Downloads ranking: exact/cue/prefix/fragment/secondary, stable ties, no loss, normalization and bounded typo fallback passed');
