/* Bounded private data only; imported strings never become HTML or URLs. */
((root) => {
  'use strict';
  const data = typeof module !== 'undefined' && module.exports ? require('./affirmations-data.js') : root.ocfAffirmationsData;
  const MAX_CUSTOM = 1500, MAX_TEXT = 500;
  // Public records are trusted only after bounded validation; archived IDs stay resolvable.
  function validatePublic(catalog) {
    if (!catalog || !catalog.categories || !Array.isArray(catalog.lines) || catalog.lines.length > 2000) throw Error('Invalid public affirmation catalog.');
    const ids=new Set(), currentText=new Set();
    for (const item of catalog.lines) {
      if (!item || typeof item.id!=='string' || !/^(starter:[a-z-]+:[1-9][0-9]*|public:[a-z0-9][a-z0-9-]{0,79})$/.test(item.id) || ids.has(item.id) || typeof item.category!=='string' || !Object.hasOwn(catalog.categories,item.category) || typeof item.text!=='string' || !item.text.trim() || item.text.length>1000 || /[\u0000-\u001f\u007f]/u.test(item.text) || (item.archived!==undefined && typeof item.archived!=='boolean') || (item.subtopic!==undefined && (typeof item.subtopic!=='string' || !item.subtopic.trim() || item.subtopic.length>80)) || Object.keys(item).some(key=>!['id','category','text','archived','subtopic'].includes(key))) throw Error('Invalid public affirmation record.');
      ids.add(item.id);
      if (!item.archived) { if(currentText.has(item.text))throw Error('Duplicate current public affirmation.');currentText.add(item.text); }
    }
    return catalog;
  }
  validatePublic(data);
  const starterIds = new Set(data.lines.map(line => line.id));
  const MAX_STORED = MAX_CUSTOM * 2 + starterIds.size;
  const customId = id => typeof id === 'string' && /^custom:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
  const fail = () => { throw Error('Unsupported or corrupt affirmation data. Existing lines have not been replaced.'); };
  function exact(value, keys) { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) fail(); }
  function line(value) {
    exact(value, ['id', 'text', 'category']);
    if (!customId(value.id) || typeof value.text !== 'string' || !value.text.trim() || value.text.length > MAX_TEXT || /[\u0000-\u001f\u007f]/u.test(value.text) || typeof value.category !== 'string' || !Object.hasOwn(data.categories, value.category)) fail();
    return value;
  }
  function validate(value) {
    exact(value, ['custom', 'favorites']);
    if (!Array.isArray(value.custom) || !Array.isArray(value.favorites)) fail();
    if(value.custom.length>MAX_CUSTOM || value.favorites.length>MAX_CUSTOM+starterIds.size) throw Error(`The ${MAX_CUSTOM}-line collection capacity would be exceeded. Existing lines have not been replaced; split the collection or remove lines before importing.`);
    const ids = new Set();
    value.custom.forEach(item => { line(item); if (ids.has(item.id)) fail(); ids.add(item.id); });
    const favorites = new Set();
    value.favorites.forEach(id => { if ((!starterIds.has(id) && !ids.has(id)) || favorites.has(id)) fail(); favorites.add(id); });
    return value;
  }
  const empty = () => ({custom: [], favorites: []});
  const same = (a,b) => a.text === b.text && a.category === b.category;
  async function merge(existing, incoming, digest) {
    validate(existing); validate(incoming);
    const custom = new Map(existing.custom.map(item => [item.id, item]));
    const remap = new Map();
    for (const item of incoming.custom) {
      let id = item.id;
      if (custom.has(id) && !same(custom.get(id), item)) {
        // Stable conflict copy: repeated imports do not multiply the same alternative.
        const hash = await digest([item.id, item.text, item.category]);
        id = `custom:${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
        if (custom.has(id) && !same(custom.get(id), item)) throw Error('Conflicting affirmation copy could not be merged safely.');
      }
      remap.set(item.id,id); custom.set(id, {...item,id});
    }
    const result = {custom: [...custom.values()], favorites: [...new Set([...existing.favorites, ...incoming.favorites.map(id => remap.get(id) || id)])]};
    validate(result); return result;
  }
  const api = {data, validatePublic, MAX_CUSTOM, MAX_STORED, MAX_TEXT, starterIds, customId, line, validate, empty, same, merge};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ocfAffirmationsState = api;
})(globalThis);
