/* Bounded private data only; imported strings never become HTML or URLs. */
((root) => {
  'use strict';
  const data = typeof module !== 'undefined' && module.exports ? require('./affirmations-data.js') : root.ocfAffirmationsData;
  const MAX_CUSTOM = 200, MAX_TEXT = 500;
  const starterIds = new Set(data.lines.map(line => line.id));
  const customId = id => typeof id === 'string' && /^custom:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
  const fail = () => { throw Error('Unsupported or corrupt affirmation data. Existing lines have not been replaced.'); };
  function exact(value, keys) { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) fail(); }
  function line(value) {
    exact(value, ['id', 'text', 'category']);
    if (!customId(value.id) || typeof value.text !== 'string' || !value.text.trim() || value.text.length > MAX_TEXT || /[\u0000-\u001f\u007f]/u.test(value.text) || !Object.hasOwn(data.categories, value.category)) fail();
    return value;
  }
  function validate(value) {
    exact(value, ['custom', 'favorites']);
    if (!Array.isArray(value.custom) || value.custom.length > MAX_CUSTOM || !Array.isArray(value.favorites) || value.favorites.length > MAX_CUSTOM + starterIds.size) fail();
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
  const api = {data, MAX_CUSTOM, MAX_TEXT, starterIds, customId, line, validate, empty, same, merge};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ocfAffirmationsState = api;
})(globalThis);
