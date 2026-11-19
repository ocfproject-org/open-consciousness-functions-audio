const assert = require('node:assert/strict');
const {webcrypto} = require('node:crypto');
globalThis.crypto ??= webcrypto;
const {Store, parsePersonalBackup, validateFlag, canonical, digest, parseBackup, validateRecord, identity, status, KEY, LIMIT} = require('../site/assets/js/learned.js');
class MemoryStorage {
  constructor() { this.values = new Map(); }
  get length() { return this.values.size; }
  key(i) { return [...this.values.keys()][i]; }
  getItem(k) { return this.values.get(k) ?? null; }
  setItem(k, v) { this.values.set(k, v); }
  removeItem(k) { this.values.delete(k); }
}
(async () => {
  const pythonCanonical = require('node:fs').readFileSync(require('node:path').join(__dirname, 'fixtures/learned-unicode.json'), 'utf8').trim();
  assert.equal(canonical(JSON.parse(pythonCanonical)), pythonCanonical);
  assert.equal(await digest(JSON.parse(pythonCanonical)), '537d98982612b4ff9291a80335e1831596a43e491c6f6f3c1df9adb17f1154bc');
  const snapshot = {schema: 1, fields: {description: 'Reviewed guide <script>not HTML</script>'}};
  const guide = {commit: 'a'.repeat(40), locale: 'en-US', snapshot, fingerprint: await digest(snapshot)};
  const audio = {tag: 'audio-0.2.0', edition: '0.2.0', locale: 'en-US', voice: 'mike-original', source_commit: 'b'.repeat(40), master_sha256: 'c'.repeat(64), render_source: {base_commit: 'b'.repeat(40), state: 'frozen-working-tree', snapshot_sha256: 'd'.repeat(64)}, assets: [{id: 'asset-' + 'e'.repeat(64), format: 'mp3', sha256: 'f'.repeat(64)}]};
  const subjects = {'OCF-TST-001': {guide, recordings: [audio]}, 'preparation:ocf': {guide: null, recordings: [audio]}, 'preparation:human-plus': {guide: null, recordings: []}};
  const record = {id: crypto.randomUUID(), subject: 'OCF-TST-001', markedAt: new Date().toISOString(), guide, recording: audio, external: null};
  await validateRecord(record, subjects);
  const storage = new MemoryStorage(), first = new Store(storage, subjects), second = new Store(storage, subjects);
  assert.deepEqual(await first.read(), []); assert.equal(storage.length, 0);
  await assert.rejects(first.merge([record]), /Enable/);
  first.enable(); await first.merge([record]);
  assert.equal((await second.read()).length, 1);
  assert.equal((await first.merge([record])), 0);
  const older = {...record, id: crypto.randomUUID(), recording: {...audio, tag: 'audio-0.1.0', edition: '0.1.0'}};
  await Promise.all([first.merge([older]), second.merge([{...record, recording: null}])]);
  assert.equal((await first.read()).length, 3);
  assert.deepEqual(status(record, {...subjects[record.subject], guide: {...guide, commit: '9'.repeat(40)}}), {guideChanged: false, newerEdition: false});
  assert.deepEqual(status(older, subjects[record.subject]), {guideChanged: false, newerEdition: true});
  assert.equal(status(record, {...subjects[record.subject], guide: {...guide, fingerprint: '9'.repeat(64)}}).guideChanged, true);
  const exported = JSON.stringify({schema: 1, records: await first.read()});
  const imported = await parseBackup(exported, subjects); assert.equal(imported.length, 3);
  await first.merge(imported); assert.equal((await first.read()).length, 3);
  for (const corrupt of ['{', JSON.stringify({schema: 2, records: []}), JSON.stringify({schema: 1, records: [record], extra: true}), JSON.stringify({schema: 1, records: [{...record, subject: 'OCF-XXX-999'}]}), JSON.stringify({schema: 1, records: [{...record, guide: {...guide, fingerprint: '0'.repeat(64)}}]}), JSON.stringify({schema: 1, records: [{...record, recording: {...audio, tag: 'javascript:alert(1)'}}]}), JSON.stringify({schema: 1, records: [record, record]}), 'x'.repeat(LIMIT + 1)]) {
    await assert.rejects(parseBackup(corrupt, subjects)); assert.equal((await first.read()).length, 3);
  }
  for (const invalid of [
    {...record, markedAt: '2026-02-30T00:00:00.000Z'},
    {...record, recording: {...audio, url: 'https://untrusted.invalid/'}},
    {...record, external: {edition: 'unrequested', date: null}},
    {...record, id: '-'.repeat(36)},
  ]) await assert.rejects(parseBackup(JSON.stringify({schema: 1, records: [invalid]}), subjects));
  await assert.rejects(parseBackup(JSON.stringify({schema: 1, records: Array(501).fill(record)}), subjects));
  const beforeRemove = await first.read(); second.remove(beforeRemove[0].id); assert.equal((await first.read()).length, 2);
  second.reset(); assert.equal((await first.read()).length, 0); await assert.rejects(first.merge([record]), /Enable/);
  first.enable();
  const interrupted = first.merge([record]); second.reset();
  await assert.rejects(interrupted, /another tab/); assert.equal((await first.read()).length, 0);
  first.enable(); await Promise.all([first.merge([record]), second.merge([record])]);
  assert.equal((await first.read()).length, 1);
  storage.setItem(`${KEY}:record:${first.config().epoch}:bad`, '{');
  assert.equal((await first.read()).length, 1); assert.match(first.warning, /corrupt/); assert.ok(storage.getItem(`${KEY}:record:${first.config().epoch}:bad`));
  const denied = new Store({getItem() { throw Error('blocked'); }}, subjects); denied.enable(); await denied.merge([record]);
  assert.equal((await denied.read()).length, 1); assert.match(denied.warning, /only in memory/);
  const quotaStorage = new MemoryStorage(), quota = new Store(quotaStorage, subjects); quota.enable(); await quota.merge([record]);
  quotaStorage.setItem = () => { throw Error('quota'); }; await quota.merge([older]); assert.equal((await quota.read()).length, 2); assert.match(quota.warning, /only in memory/);
  const other = new Store(quotaStorage, subjects); assert.equal((await other.read()).length, 1);
  const unsupported = new MemoryStorage(); unsupported.setItem(KEY, JSON.stringify({schema: 2}));
  const badStore = new Store(unsupported, subjects); await badStore.read(); assert.throws(() => badStore.enable(), /Reset/); assert.equal(unsupported.getItem(KEY), '{"schema":2}'); badStore.reset(); badStore.enable();
  const external = {...record, subject: 'preparation:human-plus', guide: null, recording: null, external: {edition: null, date: null}};
  await validateRecord(external, subjects); await assert.rejects(validateRecord({...external, recording: audio}, subjects));
  await validateRecord({...record, subject: 'preparation:ocf', guide: null}, subjects);
  await assert.rejects(validateRecord({...record, subject: 'preparation:ocf', guide: null, recording: null}, subjects));
  const flagStorage = new MemoryStorage(), flagStore = new Store(flagStorage, subjects), flagTab = new Store(flagStorage, subjects);
  assert.throws(() => flagStore.setFlag(record.subject, 'favorite', true), /Enable/);
  flagStore.enable(); flagStore.setFlag(record.subject, 'favorite', true); flagTab.setFlag(record.subject, 'todo', true);
  assert.equal(flagStore.readFlags().length, 2); assert.equal((await flagStore.read()).length, 0);
  await flagStore.merge([record]); assert.equal(flagStore.readFlags().length, 2);
  flagTab.setFlag(record.subject, 'favorite', false); assert.deepEqual(flagStore.readFlags(), [{subject:record.subject,kind:'todo'}]);
  const legacy = await parsePersonalBackup(JSON.stringify({schema:1,records:[older]}), subjects);
  assert.deepEqual(legacy.flags, []); await flagStore.mergePersonal(legacy);
  assert.equal((await flagStore.read()).length, 2); assert.equal(flagStore.readFlags().length, 1);
  const personal = {schema:2,records:[record],flags:[{subject:record.subject,kind:'favorite'}]};
  await flagStore.mergePersonal(await parsePersonalBackup(JSON.stringify(personal), subjects));
  assert.equal((await flagStore.read()).length, 2); assert.equal(flagStore.readFlags().length, 2);
  for (const invalid of [ {...personal,schema:3}, {...personal,flags:[{subject:record.subject,kind:'learned'}]}, {...personal,flags:[{subject:'unknown',kind:'todo'}]}, {...personal,flags:[...personal.flags,...personal.flags]}, {...personal,flags:[{...personal.flags[0],url:'https://invalid.example/'}]}, {...personal,records:[{...record,guide:{...guide,fingerprint:'0'.repeat(64)}}]} ]) {
    await assert.rejects(parsePersonalBackup(JSON.stringify(invalid),subjects)); assert.equal(flagStore.readFlags().length,2); assert.equal((await flagStore.read()).length,2);
  }
  const interruptedPersonal=flagStore.mergePersonal({records:[record],flags:personal.flags}); flagTab.reset();
  await assert.rejects(interruptedPersonal,/another tab/); assert.deepEqual(flagStore.readFlags(),[]); assert.deepEqual(await flagStore.read(),[]);
  flagStore.enable(); await flagStore.merge([record]); flagStore.setFlag(record.subject,'favorite',true); await flagStore.read();
  flagStorage.setItem=()=>{throw Error('quota');}; flagStore.setFlag(record.subject,'todo',true);
  assert.equal(flagStore.readFlags().length,2); assert.equal((await flagStore.read()).length,1); assert.match(flagStore.warning,/only in memory/);
  // Real generated projection validates every supported public record, including provenance.
  if (process.env.SITE_DIR) {
    const data = require(require('node:path').resolve(process.env.SITE_DIR, 'assets/data/learning.json'));
    for (const [subject, current] of Object.entries(data.subjects)) {
      for (const recording of current.recordings) await validateRecord({...record, subject, guide: current.guide, recording}, data.subjects);
    }
  }
  console.log('Learned core: identity, provenance, imports, retention, storage failures and concurrent-tab tests passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
