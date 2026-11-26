/* Private learning records and personal choices. No analytics, progress URLs, or network writes. */
(() => {
  'use strict';
  const affirmations = typeof module !== 'undefined' && module.exports ? require('./affirmations-state.js') : globalThis.ocfAffirmationsState;
  const routine = typeof module !== 'undefined' && module.exports ? require('./morning-state.js') : globalThis.ocfMorningState;
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
    if (typeof record.subject !== 'string' || !Object.hasOwn(subjects, record.subject)) fail();
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
      if (typeof recording.tag !== 'string' || typeof recording.edition !== 'string' || !/^audio-\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(recording.tag) || !/^\d+\.\d+\.\d+$/.test(recording.edition)) fail();
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
    let parsed; try { parsed = JSON.parse(text.replace(/^\uFEFF/,'')); } catch (_) { fail(); }
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
  function validateFlag(flag, subjects) {
    object(flag, ['subject', 'kind']);
    if (typeof flag.subject !== 'string' || !Object.hasOwn(subjects, flag.subject) || flag.subject === 'preparation:human-plus' || !['favorite', 'todo'].includes(flag.kind)) fail();
    return flag;
  }
  async function parsePersonalBackup(text, subjects) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > LIMIT) fail();
    let value; try { value = JSON.parse(text.replace(/^\uFEFF/,'')); } catch (_) { fail(); }
    if (value?.schema === 1) return {records: await parseBackup(text, subjects), flags: [], affirmations: null, routine: null};
    object(value, [4,5].includes(value?.schema) ? ['schema', 'records', 'flags', 'affirmations', 'routine'] : value?.schema === 3 ? ['schema', 'records', 'flags', 'affirmations'] : ['schema', 'records', 'flags']);
    if (![2,3,4,5].includes(value.schema) || !Array.isArray(value.flags) || value.flags.length > 120) fail();
    const seen = new Set();
    value.flags.forEach(flag => { validateFlag(flag, subjects); const key = `${flag.subject}:${flag.kind}`; if (seen.has(key)) fail(); seen.add(key); });
    if(value.schema===4&&value.routine?.some(row=>row?.kind==='hplus'))fail();
    const records = await parseBackup(JSON.stringify({schema: 1, records: value.records}), subjects);
    return {records, flags: value.flags, affirmations: value.schema >= 3 ? affirmations.validate(value.affirmations) : null, routine: value.schema >= 4 ? await routine.verify(value.routine,subjects,validateRecord) : null};
  }
  class Store {
    constructor(storage, subjects) { this.storage = storage; this.subjects = subjects; this.memory = new Map(); this.warning = ''; this.blocked = false; }
    fallback() { this.storage = null; this.warning = 'Changes are only in memory and will be lost when you leave this page. Browser storage is unavailable; saved data in other tabs may differ.'; }
    config(includeManual = true) {
      let raw;
      try { raw = this.storage ? this.storage.getItem(KEY) : this.memory.get(KEY); } catch (_) { this.fallback(); raw = this.memory.get(KEY); }
      if (!raw) { this.blocked = false; return null; }
      try { const value = JSON.parse(raw); const scoped=Object.hasOwn(value||{},'manualOnly'); object(value, scoped?['schema','epoch','manualOnly']:['schema','epoch']); if (value.schema !== 1 || (scoped && value.manualOnly !== true)) fail(); uuid(value.epoch); this.blocked = false; return scoped&&!includeManual?null:value; }
      catch (_) { this.blocked = true; this.warning = 'Stored learned settings are unsupported or corrupt. They have not been overwritten. Export any readable records before deliberately resetting.'; return null; }
    }
    put(key, value) {
      try { if (this.storage) this.storage.setItem(key, value); } catch (_) { this.fallback(); }
      this.memory.set(key, value);
    }
    writeConfig(expectedEpoch) {
      const current = this.config();
      if (this.blocked) throw Error('Saved local settings are unreadable. They were not overwritten.');
      if (expectedEpoch !== undefined && (current?.epoch ?? null) !== expectedEpoch)
        throw Error('Saved items changed in another tab. Review before saving.');
      return current || this.enableManual();
    }
    manualConfig() { return this.config(true); }
    affirmationConfig() { return this.manualConfig(); }
    enableAffirmations() { return this.enableManual(); }
    enableManual() {
      const current=this.affirmationConfig();
      if(this.blocked)throw Error('Saved local settings are unreadable. They were not overwritten; use Preferences to recover or deliberately reset them.');
      if(!current)this.put(KEY,JSON.stringify({schema:1,epoch:globalThis.crypto.randomUUID(),manualOnly:true}));
      return this.affirmationConfig();
    }
    chooseAffirmationFavorite(id,on) {
      const current=this.readAffirmations();
      if(!affirmations.starterIds.has(id)&&!current.custom.some(item=>item.id===id))throw Error('This affirmation is no longer saved.');
      const config=this.enableAffirmations();
      this.favoriteAffirmation(id,on,config.epoch);
    }
    async read() {
      const config = this.config(); if (!config) return [];
      const prefix = `${KEY}:record:${config.epoch}:`;
      let entries;
      try {
        entries = this.storage ? Array.from({length: this.storage.length}, (_, i) => this.storage.key(i)).filter(k => k?.startsWith(prefix)).map(k => [k, this.storage.getItem(k)]) : [...this.memory].filter(([k]) => k.startsWith(prefix));
        if (this.storage) { for (const key of this.memory.keys()) if (key.startsWith(`${KEY}:record:`)) this.memory.delete(key); this.memory.set(KEY, JSON.stringify(config)); for (const [k, v] of entries) this.memory.set(k, v); }
      } catch (_) { this.fallback(); entries = [...this.memory].filter(([k]) => k.startsWith(prefix)); }
      const records = [];
      for (const [key, value] of entries.slice(0, MAX_RECORDS)) {
        try { if (value.length > 64000) fail(); const record = await validateRecord(JSON.parse(value), this.subjects); if (!key.endsWith(`:${record.id}`)) fail(); records.push(record); }
        catch (_) { this.warning = 'Some stored records are corrupt or unsupported and were not loaded or deleted. Export readable records before resetting.'; }
      }
      if (entries.length > MAX_RECORDS) this.warning = 'Too many stored records; only the first 500 were loaded. Export before resetting.';
      return records.sort((a, b) => b.markedAt.localeCompare(a.markedAt) || a.id.localeCompare(b.id));
    }
    async merge(records, expectedEpoch) {
      const before=this.config()?.epoch ?? null;
      for (const record of records) await validateRecord(record, this.subjects);
      const config=this.writeConfig(expectedEpoch===undefined?before:expectedEpoch);
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
      // Re-check after asynchronous validation: another tab may have cleared the library.
      if (this.config()?.epoch !== config.epoch) throw new Error('Saved items changed in another tab. Review its current state before saving.');
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
    readFlags() {
      const config = this.config(); if (!config) return [];
      const prefix = `${KEY}:flag:${config.epoch}:`;
      let entries;
      try {
        entries = this.storage ? Array.from({length: this.storage.length}, (_, i) => this.storage.key(i)).filter(k => k?.startsWith(prefix)).map(k => [k, this.storage.getItem(k)]) : [...this.memory].filter(([k]) => k.startsWith(prefix));
        if (this.storage) { for (const key of this.memory.keys()) if (key.startsWith(`${KEY}:flag:`)) this.memory.delete(key); for (const [k,v] of entries) this.memory.set(k,v); }
      } catch (_) { this.fallback(); entries = [...this.memory].filter(([k]) => k.startsWith(prefix)); }
      const flags = [];
      for (const [key, raw] of entries.slice(0, 120)) {
        try { if (raw.length > 300) fail(); const flag = validateFlag(JSON.parse(raw), this.subjects); if (key !== prefix + flag.subject + ':' + flag.kind) fail(); flags.push(flag); }
        catch (_) { this.warning = 'Some personal flags are corrupt or unsupported and were not loaded or deleted.'; }
      }
      return flags;
    }
    setFlag(subject, kind, on, expectedEpoch) {
      validateFlag({subject, kind}, this.subjects);
      const config = this.writeConfig(expectedEpoch);
      const key = `${KEY}:flag:${config.epoch}:${subject}:${kind}`;
      if (on) this.put(key, JSON.stringify({subject, kind}));
      else { try { this.storage?.removeItem(key); } catch (_) { this.fallback(); this.warning += ' The saved browser copy could not be removed.'; } this.memory.delete(key); }
    }
    async mergePersonal(value, expectedEpoch) {
      const before=this.config()?.epoch ?? null;
      if(expectedEpoch!==undefined&&before!==expectedEpoch)throw Error('Saved items changed. Preview the backup again before importing.');
      const includesAffirmations=value.affirmations !== null && value.affirmations !== undefined;
      const includesRoutine=value.routine !== null && value.routine !== undefined;
      const envelope=includesRoutine ? {schema:routine.backupSchema(value.routine),records:value.records,flags:value.flags,affirmations:value.affirmations,routine:value.routine} : includesAffirmations ? {schema:3,records:value.records,flags:value.flags,affirmations:value.affirmations} : {schema:2,records:value.records,flags:value.flags};
      const validated = await parsePersonalBackup(JSON.stringify(envelope), this.subjects);
      const config=this.writeConfig(before);
      const assertEpoch=()=>{if(this.config()?.epoch!==config.epoch)throw new Error('Saved items changed in another tab. Review before importing.');};
      assertEpoch();
      let initialRoutine=null, mergedRoutine=null;
      if(includesRoutine){
        initialRoutine=this.readRoutine();this.routineContext(config.epoch);
        mergedRoutine=await routine.merge(initialRoutine.rows,validated.routine,this.subjects,digest,canonical);
        assertEpoch();this.routineContext(config.epoch);
        if(canonical(this.readRoutine())!==canonical(initialRoutine))throw Error('Morning routine changed. Preview the backup again.');
      }
      let initialAffirmations=null, mergedAffirmations=null;
      // Legacy scopes must not inspect, hash, block on or write affirmation data.
      if(includesAffirmations) {
        initialAffirmations=this.readAffirmations();this.affirmationContext(config.epoch);
        mergedAffirmations=await affirmations.merge(initialAffirmations,validated.affirmations,digest);
        assertEpoch();this.affirmationContext(config.epoch);
        if(canonical(this.readAffirmations())!==canonical(initialAffirmations))throw new Error('Affirmations changed in another tab. Preview this backup again.');
        this.affirmationContext(config.epoch);
      }
      const result={learned:0,flags:0,custom:0,favorites:0,routine:0,memoryOnly:!this.storage};
      this.lastImportResult=null;
      this.readFlags(); // Cache readable existing marks before a possible storage-quota fallback.
      try {
        assertEpoch();result.learned=await this.merge(validated.records,config.epoch);
        assertEpoch();
        const flags=new Set(this.readFlags().map(flag=>`${flag.subject}:${flag.kind}`));
        for(const flag of validated.flags) {
          if(flags.has(`${flag.subject}:${flag.kind}`))continue;
          assertEpoch();this.setFlag(flag.subject,flag.kind,true,config.epoch);result.flags++;
        }
        if(includesAffirmations) {
          assertEpoch();
          if(canonical(this.readAffirmations())!==canonical(initialAffirmations))throw new Error('Affirmations changed in another tab. Preview this backup again.');
          this.affirmationContext(config.epoch);
          this.saveAffirmationsMerge(mergedAffirmations,config.epoch,initialAffirmations,result);
        }
        if(includesRoutine){
          await this.saveRoutine(mergedRoutine,initialRoutine,config.epoch);
          result.routine=mergedRoutine.length-initialRoutine.rows.length;
        }
        result.memoryOnly=!this.storage;this.lastImportResult=result;return result.learned;
      } catch(error) {
        result.memoryOnly=!this.storage;this.lastImportResult=result;
        if(result.learned||result.flags||result.custom||result.favorites||result.routine) {
          const interruption=new Error(`Import interrupted after adding ${result.learned} learned versions, ${result.flags} personal marks, ${result.custom} custom lines and ${result.favorites} My Morning favorites and ${result.routine} routine cues. These are additions already made, not a complete import. ${result.memoryOnly?'Some changes are only in memory; export before leaving. ':''}Existing unrelated records were not deleted. Review current data before retrying. ${error.message}`);
          interruption.importResult={...result};throw interruption;
        }
        throw error;
      }
    }
    readRoutine() {
      this.routineBlocked=false;
      const config=this.manualConfig();if(!config)return {revision:null,rows:[]};
      const key=`${KEY}:routine:${config.epoch}`;let raw;
      try{raw=this.storage?this.storage.getItem(key):this.memory.get(key);if(this.storage){this.memory.set(KEY,JSON.stringify(config));if(raw)this.memory.set(key,raw);else this.memory.delete(key);}}
      catch(_){this.fallback();raw=this.memory.get(key);}
      if(!raw)return {revision:null,rows:[]};
      try{if(raw.length>LIMIT)throw Error();const value=JSON.parse(raw);object(value,['revision','rows']);uuid(value.revision);routine.validate(value.rows,this.subjects);return value;}
      catch(_){this.routineBlocked=true;this.warning='Saved morning routine is corrupt or unsupported. It has not been overwritten. Export other readable data before deliberately resetting.';return {revision:null,rows:[]};}
    }
    routineContext(epoch){
      if(this.routineBlocked)throw Error('Saved morning routine is unreadable; it has not been overwritten.');
      if(!epoch||this.manualConfig()?.epoch!==epoch)throw Error('Saved local data changed. Reopen the routine or preview the backup again.');
      return `${KEY}:routine:${epoch}`;
    }
    async saveRoutineIntent(rows,previous,expectedEpoch){
      await routine.verify(rows,this.subjects,validateRecord);
      if((this.manualConfig()?.epoch??null)!==expectedEpoch)throw Error('Saved local data changed. Reopen the routine before saving.');
      if(!expectedEpoch&&!rows.length)return false;
      const epoch=expectedEpoch||this.enableManual().epoch;
      await this.saveRoutine(rows,previous,epoch);return true;
    }
    async saveRoutine(rows,previous,epoch){
      await routine.verify(rows,this.subjects,validateRecord);
      const write=()=>{
      const current=this.readRoutine(),key=this.routineContext(epoch);
      if(canonical(current)!==canonical(previous))throw Error('Morning routine changed in another tab. Reopen it before saving.');
      // One atomic storage value: order and rows cannot be partially written.
      const value=JSON.stringify({revision:crypto.randomUUID(),rows});if(new TextEncoder().encode(value).length>LIMIT)throw Error('Morning routine exceeds 2 MiB.');
      this.put(key,value);
      };
      if(globalThis.navigator?.locks)return navigator.locks.request('ocf-private-routine',write);
      return write();
    }
    readAffirmations() {
      this.affirmationsBlocked=false;
      const config = this.affirmationConfig(); if (!config) return affirmations.empty();
      const prefix = `${KEY}:affirmation:${config.epoch}:`;
      let entries;
      try {
        entries = this.storage ? Array.from({length: this.storage.length}, (_, i) => this.storage.key(i)).filter(k => k?.startsWith(prefix)).map(k => [k,this.storage.getItem(k)]) : [...this.memory].filter(([k]) => k.startsWith(prefix));
        if (this.storage) { this.memory.set(KEY, JSON.stringify(config)); for (const k of this.memory.keys()) if(k.startsWith(`${KEY}:affirmation:`)) this.memory.delete(k); for(const [k,v] of entries) this.memory.set(k,v); }
      } catch (_) { this.fallback(); entries = [...this.memory].filter(([k]) => k.startsWith(prefix)); }
      const result = affirmations.empty(), favorites = [];
      for(const [key,raw] of entries.slice(0,affirmations.MAX_STORED)) {
        try {
          if(raw.length > 4000) throw Error();
          const value=JSON.parse(raw), suffix=key.slice(prefix.length);
          if(suffix.startsWith('line:')) { affirmations.line(value); if(suffix !== 'line:'+value.id) throw Error(); result.custom.push(value); }
          else { if(value !== true || !suffix.startsWith('favorite:')) throw Error(); favorites.push(suffix.slice(9)); }
        } catch (_) { this.affirmationsBlocked=true; this.warning='Some stored affirmation data is corrupt or unsupported; it was not deleted. Export readable data before resetting.'; }
      }
      const ids=new Set(result.custom.map(item=>item.id));
      result.favorites=favorites.filter(id=>affirmations.starterIds.has(id)||ids.has(id));
      if(result.custom.length>affirmations.MAX_CUSTOM || entries.length>affirmations.MAX_STORED) { this.affirmationsBlocked=true; this.warning='Too many custom lines; extra stored data has not been deleted.'; result.custom=result.custom.slice(0,affirmations.MAX_CUSTOM); result.favorites=result.favorites.filter(id=>affirmations.starterIds.has(id)||result.custom.some(item=>item.id===id)); }
      result.custom.sort((a,b)=>a.id.localeCompare(b.id));result.favorites.sort();
      return result;
    }
    affirmationContext(epoch) {
      const config=this.affirmationConfig();
      if(this.affirmationsBlocked) throw Error('Some saved affirmation data is unreadable. Export readable data and deliberately reset before saving; nothing unreadable has been overwritten.');
      if(!config || config.epoch!==epoch) throw Error('Saved local data changed in another tab. Review before saving.');
      return `${KEY}:affirmation:${epoch}:`;
    }
    removeKey(key) {
      try { this.storage?.removeItem(key); } catch (_) { this.fallback(); this.warning += ' The saved browser copy could not be removed.'; }
      this.memory.delete(key);
    }
    saveCustom(line, original, epoch) {
      affirmations.line(line);
      const current=this.readAffirmations(); const prefix=this.affirmationContext(epoch);
      const found=current.custom.find(item=>item.id===line.id);
      if(original ? !found || !affirmations.same(found, original) : found) throw Error('This line changed in another tab. Cancel and reopen it before editing.');
      if(!found && current.custom.length>=affirmations.MAX_CUSTOM) throw Error(`The ${affirmations.MAX_CUSTOM} custom-line limit is reached. Back up and remove a line first.`);
      this.put(prefix+'line:'+line.id, JSON.stringify(line));
    }
    favoriteAffirmation(id, on, epoch) {
      const current=this.readAffirmations(); const prefix=this.affirmationContext(epoch);
      if(!affirmations.starterIds.has(id)&&!current.custom.some(item=>item.id===id)) throw Error('This affirmation is no longer saved.');
      const key=prefix+'favorite:'+id;
      if(on)this.put(key,'true'); else this.removeKey(key);
    }
    removeCustom(original, epoch) {
      const current=this.readAffirmations(); const prefix=this.affirmationContext(epoch);
      if(!current.custom.some(item=>item.id===original.id&&affirmations.same(item,original))) throw Error('This line changed in another tab. Review it before removing.');
      this.removeKey(prefix+'favorite:'+original.id); this.removeKey(prefix+'line:'+original.id);
    }
    saveAffirmationsMerge(value, epoch, previous, result) {
      affirmations.validate(value); const prefix=this.affirmationContext(epoch);
      // Write additions only: an older backup never rewrites existing affirmation keys.
      const known=new Set(previous.custom.map(item=>item.id));
      value.custom.filter(item=>!known.has(item.id)).forEach(item=>{this.affirmationContext(epoch);this.put(prefix+'line:'+item.id,JSON.stringify(item));result.custom++;});
      value.favorites.filter(id=>!previous.favorites.includes(id)).forEach(id=>{this.affirmationContext(epoch);this.put(prefix+'favorite:'+id,'true');result.favorites++;});
    }
    reset() {
      // Disable first; an interrupted cleanup cannot reactivate old epochs.
      try {
        if (this.storage) {
          this.storage.removeItem(KEY);
          const keys = Array.from({length: this.storage.length}, (_, i) => this.storage.key(i));
          keys.filter(k => (k?.startsWith(`${KEY}:record:`) || k?.startsWith(`${KEY}:flag:`) || k?.startsWith(`${KEY}:affirmation:`) || k?.startsWith(`${KEY}:routine:`))).forEach(k => this.storage.removeItem(k));
        }
        this.memory.clear(); this.blocked = false;
        // A deliberate clear invalidates pending saves in other tabs even if
        // there was no data. No epoch is written by a passive read or visit.
        this.put(KEY, JSON.stringify({schema:1,epoch:globalThis.crypto.randomUUID(),manualOnly:true}));
        this.warning = this.storage ? '' : 'Memory records cleared. Storage is unavailable; browser copies, if any, could not be checked or cleared.';
      } catch (_) { this.fallback(); this.memory.clear(); this.blocked = false; this.warning += ' Browser copies could not be fully cleared. Use browser site-data settings to remove them.'; }
    }
  }
  // A playhead near the end is not a completed listen. Allow only tiny decoder gaps.
  function listenedToEnd(played, duration) {
    if (!Number.isFinite(duration) || duration <= 0 || !played?.length) return false;
    const allowance = Math.min(0.5, duration / 100);
    let since = 0, gaps = 0;
    for (let i = 0; i < played.length; i++) {
      const start = played.start(i), end = played.end(i);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < since || end < start) return false;
      gaps += start - since;
      if (gaps > allowance) return false;
      since = end;
    }
    return since <= duration + allowance && gaps + Math.max(0, duration - since) <= allowance;
  }
  function mergePlayed(prior, played, duration) {
    if (!Number.isFinite(duration) || duration <= 0) return [];
    const ranges = [...prior];
    for (let i = 0; i < (played?.length || 0); i++) ranges.push([played.start(i), played.end(i)]);
    const valid = ranges.filter(r => Array.isArray(r) && r.length === 2 && r.every(Number.isFinite)
      && r[0] >= 0 && r[0] < r[1] && r[1] <= duration + 0.25);
    const merged = [];
    for (const [start, end] of valid.sort((a, b) => a[0] - b[0])) {
      const tail = merged.at(-1);
      if (tail && start <= tail[1]) tail[1] = Math.max(tail[1], end);
      else merged.push([start, end]);
    }
    return merged;
  }
  function asTimeRanges(ranges) {
    return {length:ranges.length, start:i=>ranges[i][0], end:i=>ranges[i][1]};
  }
  function recordingByKey(subjects, key) {
    if (!Array.isArray(key) || key.length !== 5 || key.some(v => typeof v !== 'string' || !v)) return null;
    const [subject, tag, edition, locale, voice] = key;
    if (!Object.hasOwn(subjects, subject)) return null;
    const current = subjects[subject];
    const matches = current.recordings.filter(r => r.tag === tag && r.edition === edition && r.locale === locale && r.voice === voice);
    return matches.length === 1 ? {subject, guide:current.guide, recording:matches[0]} : null;
  }
  const API = {validateFlag, parsePersonalBackup, canonical, digest, validateRecord, parseBackup, status, Store, identity, KEY, LIMIT, listenedToEnd, mergePlayed, asTimeRanges, recordingByKey};
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  const panel = document.querySelector('[data-learned-src]'); if (!panel) return;
  const completed = new Map();
  let saveCompleted;
  // A browser tab can resume a timeline, but neither a playhead nor a saved
  // seek is evidence of listening. Keep only bounded native played intervals.
  const progressKey = 'ocf-listening-progress:v1';
  const touched = new WeakMap(), lastWrite = new WeakMap();
  const hasProgress = audio => audio instanceof HTMLAudioElement && audio.dataset.learnedRecording;
  function sourceFor(audio) {
    if (audio.src) return audio.src;
    const sources = [...audio.querySelectorAll(':scope > source[src]')];
    return sources.find(source=>source.src===audio.currentSrc)?.src || sources[0]?.src || '';
  }
  const timeline = audio => {
    const source = sourceFor(audio);
    return source ? JSON.stringify([audio.dataset.learnedRecording,source]) : '';
  };
  const readProgress = () => {
    try {
      const rows = JSON.parse(sessionStorage.getItem(progressKey) || '[]');
      return Array.isArray(rows) ? rows.filter(row=>row && typeof row.key === 'string' &&
        typeof row.at === 'number' && Date.now()-row.at <= 12*60*60*1000 &&
        Array.isArray(row.ranges) && row.ranges.length <= 64).slice(0,8) : [];
    } catch (_) { return []; }
  };
  const writeProgress = entries => {
    try {
      if(entries.length) sessionStorage.setItem(progressKey,JSON.stringify(entries.slice(0,8)));
      else sessionStorage.removeItem(progressKey);
    } catch (_) { /* Session storage is optional. Live completion still works. */ }
  };
  const priorFor = (entries,key,duration) => entries.find(row=>row.key===key && Math.abs(row.duration-duration)<0.01);
  function capture(audio, finishing = false) {
    if(!hasProgress(audio) || (!finishing && audio.ended) ||
      audio.currentSrc !== sourceFor(audio) || !Number.isFinite(audio.duration) || audio.duration <= 0) return [];
    const key = timeline(audio);
    const entries = readProgress();
    const previous = priorFor(entries,key,audio.duration);
    const ranges = mergePlayed(previous?.ranges || [],audio.played,audio.duration);
    if (!ranges.length || !audio.played.length) return ranges;
    if (finishing && listenedToEnd(asTimeRanges(ranges),audio.duration)) {
      writeProgress(entries.filter(row=>row.key!==key));
    } else if (ranges.length<=64) {
      const current = audio.currentTime;
      const actual = Number.isFinite(current) && ranges.some(([from,to])=>current>=from && current<=to+.05);
      const position = actual ? current : previous?.position;
      writeProgress([{key,duration:audio.duration,ranges,position,at:Date.now()},...entries.filter(row=>row.key!==key)]);
    }
    return ranges;
  }
  document.addEventListener('seeking',event=>{
    if(event.isTrusted && hasProgress(event.target)) touched.set(event.target,timeline(event.target));
  },true);
  document.addEventListener('play',event=>{
    const audio=event.target;
    if(!event.isTrusted || !hasProgress(audio)) return;
    const key=timeline(audio);
    if(!key || touched.get(audio)===key) return;
    touched.set(audio,key);
    const restore=()=>{
      if(timeline(audio)!==key || audio.currentSrc!==sourceFor(audio) || audio.currentTime>0.25 ||
        audio.seeking || Number(audio.dataset.ocfResumePosition)>0 ||
        audio.dataset.ocfResumePositionExplicit==='true' || audio.dataset.ocfResumeEnded==='true') return;
      const saved=priorFor(readProgress(),key,audio.duration);
      if(Number.isFinite(saved?.position) && saved.position>0.25 && saved.position<audio.duration-.25)
        audio.currentTime=saved.position;
    };
    if(audio.readyState>0) restore();
    else audio.addEventListener('loadedmetadata',restore,{once:true});
  },true);
  for(const type of ['timeupdate','pause','seeked']) document.addEventListener(type,event=>{
    const audio=event.target;
    if(!event.isTrusted || !hasProgress(audio)) return;
    if(type==='timeupdate' && Date.now()-(lastWrite.get(audio)||0)<5000) return;
    lastWrite.set(audio,Date.now());
    capture(audio);
  },true);
  window.addEventListener('pagehide',()=>{
    document.querySelectorAll('audio[data-learned-recording]').forEach(audio=>capture(audio));
  });
  document.addEventListener('ended', event => {
    const audio = event.target;
    if (!event.isTrusted || !hasProgress(audio) || !audio.ended ||
        !listenedToEnd(asTimeRanges(capture(audio,true)),audio.duration)) return;
    try {
      const key = JSON.parse(audio.dataset.learnedRecording);
      if (Array.isArray(key) && key.length === 5) {
        completed.set(audio.dataset.learnedRecording, key);
        saveCompleted?.();
      }
    } catch (_) { /* Only use a well-formed published recording identity. */ }
  }, true);
  let records = [], flags = [], filterValue = 'all', sortValue = 'default', decorate = () => {};
  const has = (id, kind) => kind === 'learned'
    ? records.some(r => r.subject === id || (id === 'preparation:ocf' && r.subject === 'preparation:human-plus'))
    : flags.some(f => f.subject === id && f.kind === kind);
  const normalized = id => id === 'preparation-learning' ? 'preparation:ocf' : id;
  const originalOrder = new WeakMap(); let ordinal = 0;
  const order = (elements, idFor, priority = () => 0) => {
    const groups = new Map();
    elements.forEach(element => { if (!originalOrder.has(element)) originalOrder.set(element, ordinal++); const parent = element.parentElement; if (!groups.has(parent)) groups.set(parent, []); groups.get(parent).push(element); });
    for (const [parent, items] of groups) {
      const prepLast = item => Number(sortValue === 'default' && has('preparation:ocf', 'learned') &&
          normalized(idFor(item)) === 'preparation:ocf');
      const ordered = [...items].sort((a,b) => priority(a) - priority(b) || (sortValue === 'default' ? 0 : Number(has(normalized(idFor(b)), sortValue)) - Number(has(normalized(idFor(a)), sortValue))) || prepLast(a) - prepLast(b) || originalOrder.get(a) - originalOrder.get(b));
      if (ordered.some((item,i) => [...parent.children].filter(child => items.includes(child))[i] !== item)) {
        if (!parent.moveBefore && items.some(item => item.contains(document.activeElement) || [...item.querySelectorAll('audio')].some(audio => !audio.paused && !audio.ended))) continue;
        ordered.forEach(item => parent.moveBefore ? parent.moveBefore(item, null) : parent.append(item));
      }
    }
  };
  window.ocfLearned = {
    matches: id => filterValue === 'all' || (filterValue === 'unlearned' ? !has(normalized(id), 'learned') : has(normalized(id), filterValue)),
    order, decorate: () => decorate(),
  };
  const changed = () => document.dispatchEvent(new CustomEvent('ocf-learned-filter-change'));
  const node = (tag, text, parent) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; parent?.append(n); return n; };
  const button = (text, parent, action) => { const b = node('button', text, parent); b.type = 'button'; b.addEventListener('click', action); return b; };
  const sourceLink = (parent, label, commit) => { const a = node('a', label, parent); a.href = `https://github.com/ocfproject-org/open-consciousness-functions/tree/${commit}`; };
  const audioLabel = r => r ? `${r.tag}${r.tag === `audio-${r.edition}` || r.tag.startsWith(`audio-${r.edition}-`) ? '' : ` (recording edition ${r.edition})`}, ${r.locale}, voice ${r.voice}` : 'Guide only — no recording claim';
  async function start() {
    const initialHash = location.hash; let interacted = false;
    const interaction = () => { interacted = true; };
    const interactionEvents = ['pointerdown','keydown','wheel','touchstart'];
    interactionEvents.forEach(event => document.addEventListener(event, interaction, {passive: true, once: true}));
    const response = await fetch(panel.dataset.learnedSrc, {credentials: 'omit'});
    if (!response.ok) throw new Error('Public learning information could not be loaded.');
    const data = await response.json();
    const preferences = document.getElementById('preferences');
    if (!preferences?.showModal) throw new Error('This browser needs native dialog support for saved items.');
    let storage; try { storage = localStorage; } catch (_) { storage = null; }
    const store = new Store(storage, data.subjects); if (!storage) store.fallback();
    const pageSubject = panel.dataset.learnedSubject;
    const view = panel.dataset.learnedView;
    if (view !== 'settings') panel.hidden = false;
    const notice = node('p', '', panel); notice.className = 'personal-notice'; notice.setAttribute('role','status'); notice.tabIndex = -1;
    const settings = node('section', undefined, preferences); settings.className = 'personal-settings';
    node('h2', 'Saved items', settings);
    node('p', 'Favorites, To Do, and Learned are saved in this browser. Finishing a recording in the site player marks that edition learned. To resume a listen after reloading, this tab keeps played ranges temporarily. Use the backup controls below to move your saved items to another browser.', settings);
    const settingsNotice = node('p', '', settings); settingsNotice.setAttribute('role','status');
    const counts = node('p', '', settings);
    const recordsDisclosure = node('details', undefined, settings); node('summary', 'Review saved learned versions', recordsDisclosure);
    const settingsRecords = node('div', undefined, recordsDisclosure);
    const modal = node('dialog', undefined, document.body); modal.className = 'personal-dialog'; modal.id = 'mark-learned-dialog'; modal.setAttribute('aria-labelledby','mark-learned-heading');
    const heading = node('h2', 'Mark learned', modal); heading.id = 'mark-learned-heading';
    const modalNotice = node('p','',modal); modalNotice.setAttribute('role','status');
    const target = node('div','',modal); target.className = 'personal-target';
    const choiceLabel = node('label','Learning target ',modal);
    const selection = node('select',undefined,choiceLabel); selection.id = 'learned-version'; selection.setAttribute('aria-label','Learning target');
    const external = node('details',undefined,modal); node('summary','Optional external preparation details',external);
    const editionLabel = node('label','External edition (otherwise unknown) ',external);
    const externalEdition = node('input',undefined,editionLabel); externalEdition.maxLength = 120;
    const dateLabel = node('label','External learning date (otherwise unknown) ',external);
    const externalDate = node('input',undefined,dateLabel); externalDate.type='date';
    node('p','Self-report only. Guide and recording sources are separate; teaching changes are not verified. Your global audio edition stays unchanged.',modal);
    const actions = node('div',undefined,modal); actions.className='personal-dialog-actions';
    let activeSubject = '', opener = null, pendingEpoch = null, explicitChoice = false, previewChoice = false;
    const close = () => { if (modal.open) modal.close(); if (opener?.isConnected && !opener.closest('[hidden]')) opener.focus(); };
    button('Cancel',actions,close);
    const save = button('Save learned version',actions,()=>act(async()=>{
      if ((store.config()?.epoch ?? null) !== pendingEpoch) throw Error('Saved items changed. Review this choice before saving.');
      if (selection.value === '') throw Error('Choose a learning target before saving.');
      const current = data.subjects[activeSubject]; const isExternal = selection.value === 'external';
      const record = {id:crypto.randomUUID(),subject:isExternal?'preparation:human-plus':activeSubject,markedAt:new Date().toISOString(),guide:isExternal?null:current.guide,recording:isExternal||selection.value==='guide'?null:current.recordings[Number(selection.value)],external:isExternal?{edition:externalEdition.value.trim()||null,date:externalDate.value||null}:null};
      const added=await store.merge([record],pendingEpoch); close(); return added?'Learned version saved; previous versions retained.':'That learned version is already saved.';
    }));
    const versions = node('details',undefined,modal); node('summary','Saved versions and changes',versions);
    const saved = node('div',undefined,versions);
    modal.addEventListener('cancel',event=>{event.preventDefault();close();});
    window.addEventListener('popstate',close);
    window.addEventListener('pagehide',()=>{if(modal.open)modal.close();});
    function updateTarget() {
      const current=data.subjects[activeSubject]; if(!current)return;
      external.hidden=selection.value!=='external';
      save.disabled=store.blocked||selection.value==='';
      if(selection.value===''){
        target.replaceChildren();
        node('span','Choose a published recording or official Human Plus preparation.',target);
        return;
      }
      const recording=selection.value==='guide'||selection.value==='external'?null:current.recordings[Number(selection.value)];
      target.replaceChildren();
      if(selection.value==='external') node('span','Official Human Plus preparation; external edition/date unknown unless supplied. No OCF recording claim.',target);
      else {
        node('span',audioLabel(recording)+'. ',target);
        if(current.guide) sourceLink(target,`Website guide ${current.guide.commit.slice(0,7)} (${current.guide.locale})`,current.guide.commit);
        if(recording?.source_commit) {node('span',' · ',target);sourceLink(target,`Recording source ${recording.source_commit.slice(0,7)}`,recording.source_commit);}
        if(recording?.render_source?.snapshot_sha256) {const identity=node('details',undefined,target);node('summary','Recording identity',identity);node('small',`Frozen recording snapshot ${recording.render_source.snapshot_sha256}`,identity);}
      }
    }
    selection.addEventListener('change',()=>{explicitChoice=true;updateTarget();});
    function defaultChoice(edition) {
      const current=data.subjects[activeSubject];
      if(previewChoice){selection.value=activeSubject.startsWith('OCF-')?'guide':'';return;}
      const preferred=edition||window.ocfEditions?.current();
      const index=current.recordings.findIndex(r=>r.edition===preferred);
      selection.value=index>=0?String(index):current.recordings.length?'0':'guide';
    }
    const savePrompt=()=>previewChoice?'Preview recordings aren’t listed here.':'Nothing changes until you save.';
    function openLearned(id, trigger, edition='', externalChoice=false) {
      if(!Object.hasOwn(data.subjects,id))return;
      activeSubject=id;opener=trigger;explicitChoice=Boolean(edition)||externalChoice;pendingEpoch=store.config()?.epoch||null;
      selection.replaceChildren(); const current=data.subjects[id];
      previewChoice=!edition&&!externalChoice&&Boolean(document.querySelector('[data-local-release-review][data-review-track]'));
      if(previewChoice&&!id.startsWith('OCF-')){
        const placeholder=node('option','Choose a learning target',selection);
        placeholder.value='';placeholder.disabled=true;
      }
      current.recordings.forEach((r,i)=>{node('option',(previewChoice?'Published recording: ':'')+audioLabel(r),selection).value=String(i);});
      if(id.startsWith('OCF-'))node('option','Website guide only — no recording claim',selection).value='guide';
      if(id==='preparation:ocf')node('option','Already learned official Human Plus preparation',selection).value='external';
      defaultChoice(edition);if(externalChoice)selection.value='external';externalEdition.value='';externalDate.value='';external.open=false;versions.open=false;
      heading.textContent=`Mark learned: ${current.title}`;updateTarget();renderRecords(saved,records.filter(r=>r.subject===id||(id==='preparation:ocf'&&r.subject==='preparation:human-plus')));
      modalNotice.textContent=savePrompt();
      if(!modal.open)modal.showModal();selection.focus();
    }
    document.querySelectorAll('[data-preparation-mark]').forEach(trigger=>{
      const prep = data.subjects['preparation:ocf'];
      if (!prep || (trigger.dataset.preparationMark === 'ocf' && !prep.recordings.length)) return;
      trigger.addEventListener('click',()=>openLearned('preparation:ocf',trigger,'',trigger.dataset.preparationMark==='external'));
      trigger.hidden=false;
    });
    document.addEventListener('ocf-edition-change',()=>{if(modal.open&&!explicitChoice){defaultChoice();updateTarget();}});
    function openSettings(trigger) {
      opener=trigger;
      // Delegate to the shared controller so Escape/Back and focus restoration stay consistent.
      window.ocfPreferences?.open(trigger); settingsNotice.focus();
    }
    const icons={favorite:'♡',learned:'✓',todo:'☐'};
    const labels={favorite:'Favorite',learned:'Learned',todo:'To Do'};
    function addButtons(parent,id,edition='') {
      if(parent.querySelector(':scope > .personal-actions')||!Object.hasOwn(data.subjects,id))return;
      const bar=node('div',undefined,parent);bar.className='personal-actions';bar.setAttribute('role','group');bar.setAttribute('aria-label',`Saved items: ${data.subjects[id].title}`);
      for(const kind of ['favorite','learned','todo']) {
        const control=button('',bar,()=>{
          if(kind==='learned'){openLearned(id,control,edition);return;}
          act(async()=>{store.readFlags();const on=!store.readFlags().some(f=>f.subject===id&&f.kind===kind);store.setFlag(id,kind,on);return `${labels[kind]} ${on?'added':'removed'} for ${data.subjects[id].title}.`;});
        });
        control.dataset.personalSubject=id;control.dataset.personalKind=kind;
        control.setAttribute('aria-label',`${labels[kind]}: ${data.subjects[id].title}`);control.dataset.help=labels[kind];control.title=kind==='learned'?'Choose a learned version or review/remove saved versions':`${labels[kind]} — saved in this browser`;
        node('span',icons[kind],control).setAttribute('aria-hidden','true');node('span',labels[kind],control).className='personal-action-label';
        if(kind==='learned'){control.setAttribute('aria-haspopup','dialog');control.setAttribute('aria-controls',modal.id);}
      }
    }
    decorate=()=>{
      if(pageSubject)addButtons(panel,pageSubject);
      document.querySelectorAll('.session-card[data-function-id]').forEach(card=>addButtons(card,normalized(card.dataset.functionId),card.dataset.edition||''));
      document.querySelectorAll('[data-reference-row]').forEach(row=>addButtons(row.querySelector('th'),row.dataset.learnedId));
      document.querySelectorAll('[data-function-card]').forEach(card=>addButtons(card,card.dataset.learnedId));
      document.querySelectorAll('[data-personal-kind]').forEach(control=>{
        const on=has(control.dataset.personalSubject,control.dataset.personalKind);
        control.setAttribute('aria-pressed',String(on));control.dataset.selected=String(on);
        control.querySelector('[aria-hidden]').textContent=control.dataset.personalKind==='favorite'?(on?'♥':'♡'):control.dataset.personalKind==='todo'?(on?'☑':'☐'):(on?'✓':'○');
      });
    };
    if(['browse','reference'].includes(view)) {
      const filters=node('div',undefined,panel);filters.className='personal-filters';
      const label=node('label','My library ',filters);const filter=node('select',undefined,label);filter.setAttribute('aria-label','My library');
      [['all','All items'],['favorite','Favorites'],['learned','Learned'],['todo','To Do'],['unlearned','Not learned']].forEach(([v,text])=>{node('option',text,filter).value=v;});
      filter.addEventListener('change',()=>{filterValue=filter.value;changed();});
      const sortLabel=node('label','Sort personal states ',filters);const sort=node('select',undefined,sortLabel);sort.setAttribute('aria-label','Sort personal states');
      [['default','Original order'],['favorite','Favorites first'],['learned','Learned first'],['todo','To Do first']].forEach(([v,text])=>{node('option',text,sort).value=v;});
      sort.addEventListener('change',()=>{sortValue=sort.value;changed();});
    }
    const manage=node('details',undefined,settings);node('summary','Backup and reset',manage);
    button('Export private backup',manage,()=>act(async()=>{
      const epoch=store.affirmationConfig()?.epoch??null;
      // Mixed Human Plus routines require schema 5; older readers reject before writes.
      const payload=JSON.stringify({schema:routine.backupSchema(store.readRoutine().rows),records:await store.read(),flags:store.readFlags(),affirmations:store.readAffirmations(),routine:store.readRoutine().rows},null,2);
      const blob=new Blob([payload],{type:'application/json'});
      if(blob.size>LIMIT)throw new Error('Private backup exceeds the 2 MiB import limit. Nothing was downloaded or changed. Your data remains in this browser; a smaller scoped export is required, which this build does not provide.');
      // Offer only a file accepted by this same importer, including every scope.
      await parsePersonalBackup(payload,data.subjects);
      if(epoch!==(store.affirmationConfig()?.epoch??null))throw new Error('Saved local data changed while preparing the backup. Nothing was downloaded; review and export again.');
      const url=URL.createObjectURL(blob);const a=node('a');a.href=url;a.download='ocf-private-library-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return 'Private backup downloaded.';
    }));
    node('p',`Up to ${affirmations.MAX_CUSTOM} custom lines with existing category IDs. The complete backup file must be at most 2 MiB to import; long text and other private records also use that space.`,manage);
    const importLabel=node('label','Import backup (schema 1–5, up to 2 MiB) ',manage);const file=node('input',undefined,importLabel);file.type='file';file.accept='.json,application/json';
    const preview=node('div',undefined,manage);let importGeneration=0,importSelection=null;
    function invalidateImport(clearFile=true) {
      importGeneration++;importSelection=null;preview.replaceChildren();
      if(clearFile)file.value='';
    }
    function invalidateChangedImportEpoch() {
      if(importSelection && importSelection.epoch !== (store.config()?.epoch ?? null)) invalidateImport();
    }
    file.addEventListener('change',async()=>{
      const input=file.files[0];invalidateImport(false);if(!input)return;
      // Bind the entire asynchronous selection to the epoch at selection time.
      const selection={generation:importGeneration,epoch:store.config()?.epoch ?? null};importSelection=selection;
      const current=()=>importSelection===selection && selection.generation===importGeneration && selection.epoch===(store.config()?.epoch ?? null);
      try {
        if(input.size>LIMIT)throw new Error('Backup exceeds 2 MiB.');
        const candidate=await parsePersonalBackup(await input.text(),data.subjects);if(!current())return;
        const incomingAffirmations=candidate.affirmations || affirmations.empty();
        if(candidate.affirmations!==null) {const local=store.readAffirmations();if(selection.epoch!==null)store.affirmationContext(selection.epoch);await affirmations.merge(local,candidate.affirmations,digest);}
        if(candidate.routine!==null){const local=store.readRoutine();if(selection.epoch!==null)store.routineContext(selection.epoch);await routine.merge(local.rows,candidate.routine,data.subjects,digest,canonical);}
        // Web Crypto can yield after validation: do not show even a partial stale preview.
        if(!current())return;
        const known=new Set(records.map(identity));const additions=candidate.records.filter(r=>!known.has(identity(r)));
        node('p',`${additions.length} new learned versions; ${candidate.records.length-additions.length} already saved; ${candidate.flags.length} Favorite/To Do marks to merge. Existing states and versions are retained. Imported snapshots are unverified personal claims.`,preview);
        node('p',`${incomingAffirmations.custom.length} custom affirmations and ${incomingAffirmations.favorites.length} My Morning favorites to merge. Conflicting custom lines are kept as separate copies; no existing lines are replaced. Older backups leave affirmations unchanged.`,preview);
        const lines=node('details',undefined,preview);node('summary','Preview personal affirmation text',lines);
        let shown=0;const previewList=node('div',undefined,lines);
        const more=button('Show more preview lines',lines,()=>{const before=shown;showPreview();const next=previewList.children[before];if(next){next.tabIndex=-1;next.focus({preventScroll:true});}});
        function showPreview(){const end=Math.min(shown+50,incomingAffirmations.custom.length);for(;shown<end;shown++)node('p',incomingAffirmations.custom[shown].text,previewList);more.hidden=shown>=incomingAffirmations.custom.length;}
        showPreview();
        node('p',`${candidate.routine?.length||0} routine cues to merge. Existing order is kept; new cues are appended in backup order. Older backups leave the routine unchanged. Imported guide text is not independently verified.`,preview);
        const cues=node('details',undefined,preview);node('summary','Preview personal routine text',cues);(candidate.routine||[]).forEach(row=>node('p',routine.eligible(row,data.subjects)?routine.cue(row):'Unavailable command (retained without displaying its cue)',cues));
        const cancel=button('Cancel import',preview,()=>{if(current())invalidateImport();});
        const confirm=button('Confirm import and merge',preview,()=>act(async()=>{
          if(!current())throw new Error('Saved items or file selection changed. Preview the backup again before importing.');
          confirm.disabled=true;cancel.disabled=true;file.disabled=true;
          try {
            // Use this closure's immutable candidate/epoch, never a later selection.
            const count=await store.mergePersonal(candidate,selection.epoch);
            if(importSelection===selection)invalidateImport();
            return `${count} learned versions imported; personal marks merged. ${store.lastImportResult.custom} custom lines and ${store.lastImportResult.favorites} My Morning favorites and ${store.lastImportResult.routine} routine cues added.${store.lastImportResult.memoryOnly?' Changes are only in memory; export before leaving.':''}`;
          } finally {file.disabled=false;confirm.disabled=false;cancel.disabled=false;}
        }));
        await refresh('Backup validated. Review and confirm before import.');
      } catch(error) {if(current())showError(error);}
    });
    button('Clear saved items',manage,()=>act(async()=>{
      if(!window.confirm('Remove all learned versions, favorites, to-do marks, custom affirmations, My Morning favorites and routine cues from this browser? Export a backup first to keep them.'))return;
      store.reset();writeProgress([]);invalidateImport();if(modal.open)close();return 'Saved items cleared.';
    }));
    function renderRecords(saved,shown) {
      saved.replaceChildren();if(!shown.length)node('p','No learned versions saved here.',saved);
      for (const record of shown) {
        const detail = node('details', undefined, saved);
        node('summary', `${data.subjects[record.subject].title} — ${record.external ? 'Official Human Plus preparation; edition ' + (record.external.edition || 'unknown') : audioLabel(record.recording)}`, detail);
        node('p', 'Saved snapshots and imported records are personal claims, not independently verified learning or official teaching history.', detail);
        node('p', `Saved ${record.markedAt.slice(0, 10)}. ${record.external ? 'External learning date: ' + (record.external.date || 'unknown') + '.' : ''}`, detail);
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
    }    let generation=0;
    async function refresh(message='') {
      invalidateChangedImportEpoch();
      const turn=++generation;const loaded=await store.read();if(turn!==generation)return;
      records=loaded;flags=store.readFlags();save.disabled=store.blocked||selection.value==='';
      document.documentElement.toggleAttribute('data-ocf-preparation-learned', has('preparation:ocf', 'learned'));
      const text=[message,store.warning].filter(Boolean).join(' ');
      notice.textContent=text;notice.hidden=!text;
      settingsNotice.textContent=text;
      if(modal.open)modalNotice.textContent=text||savePrompt();
      counts.textContent=`${new Set(records.filter(r=>r.subject.startsWith('OCF-')).map(r=>r.subject)).size} learned functions · ${flags.filter(f=>f.kind==='favorite').length} favorites · ${flags.filter(f=>f.kind==='todo').length} to do · ${store.readAffirmations().custom.length} custom affirmations · ${store.readAffirmations().favorites.length} My Morning favorites`;
      const focused=document.activeElement;
      renderRecords(settingsRecords,records);
      renderRecords(saved,records.filter(r=>r.subject===activeSubject||(activeSubject==='preparation:ocf'&&r.subject==='preparation:human-plus')));
      decorate();changed();
      document.dispatchEvent(new Event('ocf-private-library-change'));
      if(focused&&!focused.isConnected)(modal.open?modalNotice:settingsNotice).focus({preventScroll:true});
    }
    let savingCompletion = false;
    saveCompleted = async () => {
      if (savingCompletion) return;
      savingCompletion = true;
      try {
        while (completed.size) {
          const keys = [...completed.values()];
          completed.clear();
          const entries = keys.map(key => recordingByKey(data.subjects, key)).filter(Boolean);
          if (!entries.length) continue;
          const before = store.config()?.epoch ?? null;
          const exactRecording = ({subject, recording}) => canonical({subject, recording});
          const saved = new Set((await store.read()).map(exactRecording));
          const when = new Date().toISOString();
          const newEntries = entries.filter(entry => !saved.has(exactRecording(entry))).map(entry => ({
            ...entry, id: crypto.randomUUID(), markedAt: when, external: null,
          }));
          if (!newEntries.length) continue;
          const wrote = await store.merge(newEntries, before);
          if (wrote) await refresh('Finished listening. Marked learned in this browser.');
        }
      } catch (error) { showError(error); }
      finally { savingCompletion = false; }
    };
    function showError(error){notice.hidden=false;notice.textContent=error.message+' '+store.warning;settingsNotice.textContent=notice.textContent;modalNotice.textContent=notice.textContent;}
    async function act(action){try{const message=await action();await refresh(message);}catch(error){showError(error);}}
    [modalNotice,settingsNotice].forEach(n=>n.tabIndex=-1);
    window.addEventListener('storage',event=>{if(store.storage&&(event.key===null||event.key.startsWith(KEY))) {invalidateChangedImportEpoch();if(modal.open&&(store.config()?.epoch??null)!==pendingEpoch){pendingEpoch=null;close();}refresh('Private records changed in another tab.');}});
    window.addEventListener('pageshow',()=>{if(modal.open)close();refresh();});
    window.ocfPrivateLibrary={store,refresh,openSettings};
    document.dispatchEvent(new Event('ocf-private-library-ready'));
    await refresh();
    saveCompleted();
    interactionEvents.forEach(event=>document.removeEventListener(event,interaction));
    if(initialHash&&initialHash===location.hash&&!interacted&&performance.getEntriesByType('navigation')[0]?.type!=='back_forward'){
      try{document.getElementById(decodeURIComponent(initialHash.slice(1)))?.scrollIntoView();}catch(_){}
    }
  }
  start().catch(error=>{panel.hidden=false;node('p',`Saved items unavailable: ${error.message}`,panel);});
})();
