/* Explicit private self-reports. No analytics, progress URLs, or network writes. */
(() => {
  'use strict';
  const KEY = 'ocf-learned:v1';
  const LIMIT = 2 * 1024 * 1024;
  const MAX_RECORDS = 500;
  const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
  const digest = async value => Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)))), b => b.toString(16).padStart(2, '0')).join('');
  const fail = () => { throw new Error('Unsupported or corrupt learned backup. Existing records have not been replaced.'); };
  const object = (v, keys) => {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join('|') !== [...keys].sort().join('|')) fail();
  };
  const string = (v, max = 2048) => { if (typeof v !== 'string' || !v.length || v.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v)) fail(); };
  const hex = (v, length) => { if (typeof v !== 'string' || !(new RegExp(`^[a-f0-9]{${length}}$`)).test(v)) fail(); };
  const nullableHex = (v, length) => { if (v !== null) hex(v, length); };
  const uuid = v => { if (typeof v !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v)) fail(); };
  const identity = record => canonical({subject: record.subject, guide: record.guide, recording: record.recording, external: record.external});
  async function validateRecord(record, subjects) {
    object(record, ['id', 'subject', 'markedAt', 'guide', 'recording', 'external']);
    uuid(record.id);
    if (!Object.hasOwn(subjects, record.subject)) fail();
    if (typeof record.markedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(record.markedAt) || !Number.isFinite(Date.parse(record.markedAt)) || new Date(record.markedAt).toISOString() !== record.markedAt) fail();
    if (canonical(record).length > 64000) fail();
    const guide = record.guide;
    if (record.subject.startsWith('OCF-')) {
      object(guide, ['commit', 'locale', 'fingerprint', 'snapshot']);
      hex(guide.commit, 40); string(guide.locale, 32); hex(guide.fingerprint, 64);
      object(guide.snapshot, ['schema', 'fields']);
      if (guide.snapshot.schema !== 1 || !guide.snapshot.fields || typeof guide.snapshot.fields !== 'object' || Array.isArray(guide.snapshot.fields)) fail();
      const fields = Object.entries(guide.snapshot.fields);
      if (fields.length > 256) fail();
      for (const [key, value] of fields) { if (!/^(description|command\.[A-Za-z0-9_.-]+|lifecycle\.(activation|persistence|release_command|trigger\.\d+|scope\.\d+\.(kind|activation|persistence|description))|safety\.\d+)$/.test(key)) fail(); string(value, 4096); }
      if (await digest(guide.snapshot) !== guide.fingerprint) fail();
    } else if (guide !== null) fail();
    const recording = record.recording;
    if (recording !== null) {
      object(recording, ['tag', 'edition', 'locale', 'voice', 'source_commit', 'master_sha256', 'render_source', 'assets']);
      if (!/^audio-\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(recording.tag) || (!/^\d+\.\d+\.\d+$/.test(recording.edition) || !(recording.tag === `audio-${recording.edition}` || recording.tag.startsWith(`audio-${recording.edition}-`)))) fail();
      string(recording.locale, 32); string(recording.voice, 100);
      nullableHex(recording.source_commit, 40); nullableHex(recording.master_sha256, 64);
      if (recording.render_source !== null) {
        object(recording.render_source, ['base_commit', 'state', 'snapshot_sha256']);
        nullableHex(recording.render_source.base_commit, 40); nullableHex(recording.render_source.snapshot_sha256, 64);
        if (!['committed', 'clean', 'frozen-working-tree'].includes(recording.render_source.state)) fail();
      }
      if (!Array.isArray(recording.assets) || !recording.assets.length || recording.assets.length > 8) fail();
      for (const asset of recording.assets) {
        object(asset, ['id', 'format', 'sha256']); hex(asset.sha256, 64);
        if (!/^asset-[a-f0-9]{64}$/.test(asset.id) || !['flac', 'mp3'].includes(asset.format)) fail();
      }
    }
    if (record.subject === 'preparation:ocf' && recording === null) fail();
    if (record.subject === 'preparation:human-plus') {
      if (recording !== null) fail();
      object(record.external, ['edition', 'date']);
      if (record.external.edition !== null) string(record.external.edition, 120);
      if (record.external.date !== null && (!/^\d{4}-\d\d-\d\d$/.test(record.external.date) || new Date(`${record.external.date}T00:00:00Z`).toISOString().slice(0, 10) !== record.external.date)) fail();
    } else if (record.external !== null) fail();
    return record;
  }
  async function parseBackup(text, subjects) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > LIMIT) fail();
    let parsed; try { parsed = JSON.parse(text); } catch (_) { fail(); }
    object(parsed, ['schema', 'records']);
    if (parsed.schema !== 1 || !Array.isArray(parsed.records) || parsed.records.length > MAX_RECORDS) fail();
    const ids = new Set(); const identities = new Set();
    for (const record of parsed.records) {
      await validateRecord(record, subjects);
      if (ids.has(record.id) || identities.has(identity(record))) fail();
      ids.add(record.id); identities.add(identity(record));
    }
    return parsed.records;
  }
  const newer = (a, b) => {
    if (!/^\d+\.\d+\.\d+$/.test(a) || !/^\d+\.\d+\.\d+$/.test(b)) return false;
    const x = a.split('.').map(Number), y = b.split('.').map(Number);
    return x[0] !== y[0] ? x[0] > y[0] : x[1] !== y[1] ? x[1] > y[1] : x[2] > y[2];
  };
  function status(record, current) {
    return {
      guideChanged: Boolean(record.guide && current.guide && record.guide.fingerprint !== current.guide.fingerprint),
      newerEdition: Boolean(record.recording && current.recordings.some(r => r.locale === record.recording.locale && r.voice === record.recording.voice && newer(r.edition, record.recording.edition))),
    };
  }
  class Store {
    constructor(storage, subjects) { this.storage = storage; this.subjects = subjects; this.memory = new Map(); this.warning = ''; this.blocked = false; }
    fallback() { this.storage = null; this.warning = 'Changes are only in memory and will be lost when you leave this page. Browser storage is unavailable; saved data in other tabs may differ.'; }
    config() {
      let raw;
      try { raw = this.storage ? this.storage.getItem(KEY) : this.memory.get(KEY); } catch (_) { this.fallback(); raw = this.memory.get(KEY); }
      if (!raw) { this.blocked = false; return null; }
      try { const value = JSON.parse(raw); object(value, ['schema', 'epoch']); if (value.schema !== 1) fail(); uuid(value.epoch); this.blocked = false; return value; }
      catch (_) { this.blocked = true; this.warning = 'Stored learned settings are unsupported or corrupt. They have not been overwritten. Export any readable records before deliberately resetting.'; return null; }
    }
    put(key, value) {
      try { if (this.storage) this.storage.setItem(key, value); } catch (_) { this.fallback(); }
      this.memory.set(key, value);
    }
    enable() {
      if (this.blocked) throw new Error('Reset unsupported settings before enabling tracking.');
      if (!this.config()) this.put(KEY, JSON.stringify({schema: 1, epoch: globalThis.crypto.randomUUID()}));
    }
    async read() {
      const config = this.config(); if (!config) return [];
      const prefix = `${KEY}:record:${config.epoch}:`;
      let entries;
      try {
        entries = this.storage ? Array.from({length: this.storage.length}, (_, i) => this.storage.key(i)).filter(k => k?.startsWith(prefix)).map(k => [k, this.storage.getItem(k)]) : [...this.memory].filter(([k]) => k.startsWith(prefix));
        if (this.storage) { this.memory.clear(); this.memory.set(KEY, JSON.stringify(config)); for (const [k, v] of entries) this.memory.set(k, v); }
      } catch (_) { this.fallback(); entries = [...this.memory].filter(([k]) => k.startsWith(prefix)); }
      const records = [];
      for (const [key, value] of entries.slice(0, MAX_RECORDS)) {
        try { if (value.length > 64000) fail(); const record = await validateRecord(JSON.parse(value), this.subjects); if (!key.endsWith(`:${record.id}`)) fail(); records.push(record); }
        catch (_) { this.warning = 'Some stored records are corrupt or unsupported and were not loaded or deleted. Export readable records before resetting.'; }
      }
      if (entries.length > MAX_RECORDS) this.warning = 'Too many stored records; only the first 500 were loaded. Export before resetting.';
      return records.sort((a, b) => b.markedAt.localeCompare(a.markedAt) || a.id.localeCompare(b.id));
    }
    async merge(records) {
      const config = this.config(); if (!config || this.blocked) throw new Error('Enable private tracking before saving.');
      for (const record of records) await validateRecord(record, this.subjects);
      const existing = await this.read();
      const identities = new Set(existing.map(identity));
      const additions = records.filter(record => !identities.has(identity(record)));
      if (existing.length + additions.length > MAX_RECORDS) throw new Error('The 500-record limit would be exceeded. Export and remove records first.');
      const prepared = [];
      for (const record of additions) {
        const hash = await digest(identity(record));
        const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
        prepared.push({...record, id});
      }
      // Re-check after asynchronous validation: another tab may have reset tracking.
      if (this.config()?.epoch !== config.epoch) throw new Error('Tracking changed in another tab. Review its current state before saving.');
      for (const saved of prepared) {
        // Identity-derived keys deduplicate concurrent saves without overwriting other versions.
        this.put(`${KEY}:record:${config.epoch}:${saved.id}`, JSON.stringify(saved));
      }
      return additions.length;
    }
    remove(id) {
      const config = this.config(); if (!config) return;
      const key = `${KEY}:record:${config.epoch}:${id}`;
      try { this.storage?.removeItem(key); } catch (_) { this.fallback(); this.warning += ' The saved browser copy could not be removed.'; }
      this.memory.delete(key);
    }
    reset() {
      // Disable first; an interrupted cleanup cannot reactivate old epochs.
      try {
        if (this.storage) {
          this.storage.removeItem(KEY);
          const keys = Array.from({length: this.storage.length}, (_, i) => this.storage.key(i));
          keys.filter(k => k?.startsWith(`${KEY}:record:`)).forEach(k => this.storage.removeItem(k));
        }
        this.memory.clear(); this.blocked = false;
        this.warning = this.storage ? '' : 'Memory records cleared. Storage is unavailable; browser copies, if any, could not be checked or cleared.';
      } catch (_) { this.fallback(); this.memory.clear(); this.blocked = false; this.warning += ' Browser copies could not be fully cleared. Use browser site-data settings to remove them.'; }
    }
  }
  const API = {canonical, digest, validateRecord, parseBackup, status, Store, identity, KEY, LIMIT};
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  const panel = document.querySelector('[data-learned-src]'); if (!panel) return;
  let records = [], onlyLearned = false;
  window.ocfLearned = {matches: id => !onlyLearned || records.some(r => r.subject === id)};
  const changed = () => document.dispatchEvent(new CustomEvent('ocf-learned-filter-change'));
  const node = (tag, text, parent) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; parent?.append(n); return n; };
  const button = (text, parent, action) => { const b = node('button', text, parent); b.type = 'button'; b.addEventListener('click', action); return b; };
  const sourceLink = (parent, label, commit) => { const a = node('a', label, parent); a.href = `https://github.com/ocfproject-org/open-consciousness-functions/tree/${commit}`; };
  const audioLabel = r => r ? `${r.tag}, ${r.locale}, voice ${r.voice}` : 'Guide only — no recording claim';
  async function start() {
    const initialHash = window.location.hash;
    let interacted = false;
    const interaction = () => { interacted = true; };
    const interactionEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    interactionEvents.forEach(event => document.addEventListener(event, interaction, {passive: true, once: true}));
    const response = await fetch(panel.dataset.learnedSrc, {credentials: 'omit'});
    if (!response.ok) throw new Error('Public learning information could not be loaded.');
    const data = await response.json();
    let storage; try { storage = window.localStorage; } catch (_) { storage = null; }
    const store = new Store(storage, data.subjects); if (!storage) store.fallback();
    panel.hidden = false;
    node('h2', 'My learned functions', panel).id = 'learned-heading';
    const controls = node('details', undefined, panel);
    node('summary', 'Mark learned and manage private records', controls);
    node('p', 'Optional personal self-report, not proof of completion. Records stay in this browser; there is no account, analytics, or upload. They may reveal private interests to anyone using this browser. Clearing site data removes them. Backups also contain this private information.', controls);
    const notice = node('p', '', panel); notice.setAttribute('role', 'status'); notice.tabIndex = -1;
    panel.insertBefore(notice, controls);
    const enable = button('Enable private learned tracking', controls, () => act(async () => store.enable()));
    const subject = panel.dataset.learnedSubject;
    let selection, externalEdition, externalDate;
    const markArea = node('div', undefined, controls);
    if (subject) {
      const label = node('label', 'What did you learn? ', markArea);
      selection = node('select', undefined, label); selection.id = 'learned-version';
      node('option', 'Choose explicitly…', selection).value = '';
      if (subject.startsWith('OCF-')) node('option', 'Current guide only — no recording claim', selection).value = 'guide';
      data.subjects[subject].recordings.forEach((r, i) => { node('option', audioLabel(r), selection).value = String(i); });
      if (subject === 'preparation:ocf') {
        node('option', 'Already learned official Human Plus preparation', selection).value = 'external';
        const external = node('div', undefined, markArea); external.hidden = true;
        const editionLabel = node('label', 'External edition (optional; otherwise unknown) ', external);
        externalEdition = node('input', undefined, editionLabel); externalEdition.maxLength = 120;
        const dateLabel = node('label', 'External learning date (optional; otherwise unknown) ', external);
        externalDate = node('input', undefined, dateLabel); externalDate.type = 'date';
        selection.addEventListener('change', () => { external.hidden = selection.value !== 'external'; });
        node('p', 'This records your own preparation history; it does not assign an OCF edition or verify equivalence.', external);
      }
      node('p', 'Choose the recording you learned explicitly. The current website guide and recording may have different source commits; this does not establish teaching differences. Changing the site edition does not change this record.', markArea);
      button('Mark learned / save another version', markArea, () => act(async () => {
        if (!selection.value) throw new Error('Choose what you learned before saving.');
        const external = selection.value === 'external';
        const record = {id: crypto.randomUUID(), subject: external ? 'preparation:human-plus' : subject, markedAt: new Date().toISOString(),
          guide: external ? null : data.subjects[subject].guide,
          recording: external || selection.value === 'guide' ? null : data.subjects[subject].recordings[Number(selection.value)],
          external: external ? {edition: externalEdition.value.trim() || null, date: externalDate.value || null} : null};
        const count = await store.merge([record]); return count ? 'Learned version saved. Earlier versions were retained.' : 'That learned version is already saved.';
      }));
    } else {
      const label = node('label', undefined, panel);
      const filter = node('input', undefined, label); filter.type = 'checkbox';
      label.append(document.createTextNode(' My learned functions only'));
      filter.addEventListener('change', () => { onlyLearned = filter.checked; changed(); });
      node('p', 'Includes any saved function version. Preparation is separate and is not counted as a function. The filter is temporary and is not included in links.', panel);
    }
    const totals = node('p', '', panel);
    const saved = node('div', undefined, controls);
    const manage = node('details', undefined, controls); node('summary', 'Back up, import or reset learned records', manage);
    button('Export learned backup', manage, () => act(async () => {
      const blob = new Blob([JSON.stringify({schema: 1, records}, null, 2)], {type: 'application/json'});
      const url = URL.createObjectURL(blob); const a = node('a'); a.href = url; a.download = 'ocf-learned-private-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      return 'Private backup downloaded. Keep it somewhere private.';
    }));
    const importLabel = node('label', 'Choose a learned JSON backup (up to 2 MiB) ', manage);
    const file = node('input', undefined, importLabel); file.type = 'file'; file.accept = '.json,application/json';
    const preview = node('div', undefined, manage); let pending = null; let importGeneration = 0;
    file.addEventListener('change', () => act(async () => {
      const turn = ++importGeneration; pending = null; preview.replaceChildren();
      const input = file.files[0]; if (!input) return;
      if (input.size > LIMIT) throw new Error('Backup exceeds the 2 MiB limit.');
      const candidate = await parseBackup(await input.text(), data.subjects);
      if (turn !== importGeneration) return;
      const known = new Set(records.map(identity)); const additions = candidate.filter(r => !known.has(identity(r)));
      node('p', `${additions.length} new records; ${candidate.length - additions.length} already saved. Existing versions will be retained. Imported records are personal claims, not verified official teaching history.`, preview);
      const list = node('ul', undefined, preview);
      additions.forEach(r => node('li', `${data.subjects[r.subject].title}: ${audioLabel(r.recording)}`, list));
      pending = candidate;
      button('Confirm import and merge', preview, () => act(async () => {
        if (!pending) return;
        const count = await store.merge(pending); pending = null; preview.replaceChildren(); file.value = '';
        return `${count} records merged. Existing versions retained.`;
      }));
      return 'Backup validated. Review the preview and confirm to import.';
    }));
    button('Reset all learned records', manage, () => act(async () => {
      if (!window.confirm('Remove all learned records from this browser and turn tracking off? Export a backup first if you want to keep them.')) return;
      store.reset(); importGeneration += 1; pending = null; preview.replaceChildren(); return 'Learned tracking reset.';
    }));
    function renderRecords() {
      saved.replaceChildren();
      const shown = subject ? records.filter(r => r.subject === subject || (subject === 'preparation:ocf' && r.subject === 'preparation:human-plus')) : records;
      totals.textContent = `${new Set(records.filter(r => r.subject.startsWith('OCF-')).map(r => r.subject)).size} learned functions; ${records.filter(r => r.subject.startsWith('preparation:')).length} separate preparation records.`;
      if (!shown.length) node('p', 'No learned versions saved here.', saved);
      for (const record of shown) {
        const detail = node('details', undefined, saved);
        node('summary', `${data.subjects[record.subject].title} — ${record.external ? 'Official Human Plus preparation; edition ' + (record.external.edition || 'unknown') : audioLabel(record.recording)}`, detail);
        node('p', 'Saved snapshots and imported records are personal claims, not independently verified learning or official teaching history.', detail);
        node('p', `Self-reported ${record.markedAt.slice(0, 10)}. ${record.external ? 'External learning date: ' + (record.external.date || 'unknown') + '.' : ''}`, detail);
        if (record.guide) {
          sourceLink(detail, `Saved website guide ${record.guide.commit.slice(0, 7)}`, record.guide.commit);
          node('p', `Tracked public-guide fingerprint: ${record.guide.fingerprint}`, detail);
        }
        if (record.recording) {
          const r = record.recording;
          if (r.source_commit) sourceLink(detail, `Recording source ${r.source_commit.slice(0, 7)}`, r.source_commit);
          node('p', `Recording master SHA-256: ${r.master_sha256 || 'not recorded'}. Frozen render snapshot: ${r.render_source?.snapshot_sha256 || 'not recorded'}.`, detail);
          if (!data.subjects[record.subject].recordings.some(v => canonical(v) === canonical(r))) node('p', 'This saved recording identity is not present in the current published catalog. It has not been replaced; teaching changes are not verified.', detail);
        }
        const state = status(record, data.subjects[record.subject]);
        if (state.newerEdition) {
          node('p', 'New audio edition available; teaching changes not verified. Your learned version is retained.', detail);
          const versions = new Set();
          for (const current of data.subjects[record.subject].recordings) {
            if (current.locale !== record.recording.locale || current.voice !== record.recording.voice || !newer(current.edition, record.recording.edition) || versions.has(current.tag)) continue;
            versions.add(current.tag);
            const link = node('a', `Published release notes for ${current.tag}`, detail);
            // Only trusted build-generated current catalog tags supply these links.
            link.href = `https://github.com/ocfproject-org/open-consciousness-functions-audio/releases/tag/${encodeURIComponent(current.tag)}`;
          }
        }
        if (state.guideChanged) {
          const diff = node('details', undefined, detail); node('summary', 'See differences in tracked public guide fields', diff);
          node('p', 'Saved and current website guide fields differ. These snapshots are incomplete and do not establish material teaching changes or differences in the recording. Imported snapshots are not independently verified.', diff);
          const current = data.subjects[record.subject].guide;
          sourceLink(diff, 'Current guide source', current.commit);
          const before = record.guide.snapshot.fields, after = current.snapshot.fields;
          for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
            if (before[key] === after[key]) continue;
            node('h3', key, diff); node('p', `Saved: ${before[key] || '(absent)'}`, diff); node('p', `Current: ${after[key] || '(absent)'}`, diff);
          }
        }
        button('Remove this learned version', detail, () => act(async () => {
          if (window.confirm('Remove this saved learned version? Other versions will be retained.')) { store.remove(record.id); return 'Learned version removed.'; }
        }));
      }
    }
    let generation = 0;
    async function refresh(message = '') {
      const turn = ++generation; const loaded = await store.read(); if (turn !== generation) return;
      records = loaded; enable.hidden = Boolean(store.config()); markArea.hidden = !store.config();
      notice.textContent = [message, store.warning, !store.config() ? 'Tracking is off. Enable it explicitly to save or import.' : store.storage ? 'Tracking is enabled in this browser.' : 'Tracking is enabled for this page only.'].filter(Boolean).join(' ');
      const focused = document.activeElement;
      renderRecords(); changed();
      if (focused && !focused.isConnected) notice.focus({preventScroll: true});
    }
    async function act(action) { try { const message = await action(); await refresh(message); } catch (error) { notice.textContent = `${error.message} ${store.warning}`; } }
    window.addEventListener('storage', event => { if (store.storage && (event.key === null || event.key.startsWith(KEY))) refresh('Learned records changed in another tab.'); });
    window.addEventListener('pageshow', () => refresh());
    await refresh();
    interactionEvents.forEach(event => document.removeEventListener(event, interaction));
    // Async optional UI above a deep link must not push its target out of view.
    // Never override user interaction or a Back/Forward scroll restoration.
    if (initialHash && initialHash === window.location.hash && !interacted && performance.getEntriesByType('navigation')[0]?.type !== 'back_forward') {
      try { document.getElementById(decodeURIComponent(initialHash.slice(1)))?.scrollIntoView(); } catch (_) { /* Ignore malformed fragments. */ }
    }
  }
  start().catch(error => { panel.hidden = false; node('p', `Learned tracking is unavailable: ${error.message}`, panel); });
})();
