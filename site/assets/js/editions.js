/* One explicit audio-edition preference across the public site. No audio is fetched here. */
(() => {
  'use strict';
  const key = 'ocf-audio-edition:v1';
  const normalize = (value, editions) => value === 'latest' || editions.includes(value) ? value : 'latest';
  if (typeof module !== 'undefined') module.exports = {normalize};
  if (typeof document === 'undefined') return;
  const metadata = document.getElementById('audio-editions');
  if (!metadata) return;
  const editions = JSON.parse(metadata.textContent);
  const versions = editions.map(row => row.version);
  const latest = versions[0] || '';
  const control = document.getElementById('edition-filter');
  let selection = 'latest';
  let persisted = false;
  const retained = new Set();
  const namePrefix = 'ocf-audio-edition:v1:';
  let revision = 0;
  const read = storage => {
    try { return JSON.parse(storage().getItem(key) || 'null'); } catch (_) { return null; }
  };
  const valid = record => record?.schema === 1 && typeof record.selection === 'string';
  const stored = () => {
    let tab = null;
    try { if (window.name.startsWith(namePrefix)) tab = JSON.parse(window.name.slice(namePrefix.length)); } catch (_) { /* Ignore corrupt tab fallback. */ }
    const records = [[read(() => localStorage), true], [read(() => sessionStorage), true], [tab, false]];
    return records.filter(([record]) => valid(record))
      .sort((a, b) => (Number(b[0].updatedAt) || 0) - (Number(a[0].updatedAt) || 0))[0];
  };
  const remember = () => {
    revision = Math.max(Date.now(), revision + 1);
    const data = JSON.stringify({schema: 1, selection, updatedAt: revision});
    persisted = false;
    for (const storage of [() => localStorage, () => sessionStorage]) {
      try { storage().setItem(key, data); persisted = true; } catch (_) { /* Try the other store and same-tab fallback. */ }
    }
    // Do not replace an unrelated browsing-context name. Only our small preference is retained.
    if (!persisted && (!window.name || window.name.startsWith(namePrefix))) window.name = namePrefix + data;
  };
  const resolve = () => selection === 'latest' ? latest : selection;
  const restore = () => {
    const saved = stored();
    if (saved) {
      selection = normalize(saved[0].selection, versions);
      revision = Number(saved[0].updatedAt) || 0;
      persisted = saved[1];
      if (selection !== saved[0].selection) remember();
    } else {
      const parameter = new URL(location.href).searchParams.get('edition');
      let legacy;
      try { legacy = JSON.parse(sessionStorage.getItem('ocf-library-filters:/functions/') || '{}').edition; } catch (_) { /* No legacy preference. */ }
      // The old Browse control saved its numeric default even when no version was chosen.
      const inherited = legacy === latest ? 'latest' : legacy;
      selection = normalize(parameter || inherited || 'latest', versions);
      remember();
    }
  };
  const updateLink = link => {
    if (persisted) return;
    if (!link.hasAttribute('href') || link.hasAttribute('download')) return;
    const original = link.getAttribute('href');
    if (original.startsWith('#')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !(/\/$|\.html$/.test(url.pathname))) return;
    url.searchParams.set('edition', selection);
    // Keep relative link contracts and avoid adding a second origin or changing release URLs.
    const target = new URL(original, location.href);
    const query = new URLSearchParams(target.search); query.set('edition', selection);
    link.setAttribute('href', original.split(/[?#]/)[0] + '?' + query + target.hash);
  };
  const apply = () => {
    if (control) control.value = selection;
    document.querySelectorAll('[data-edition-content]').forEach(node => {
      const matches = node.dataset.editionContent === resolve();
      const players = [...node.querySelectorAll('audio')];
      if (!matches && players.some(audio => !audio.paused && !audio.ended)) retained.add(node);
      node.hidden = !matches && !retained.has(node);
      let notice = node.querySelector(':scope > [data-retained-edition]');
      if (retained.has(node) && !matches && !notice) {
        notice = document.createElement('p'); notice.dataset.retainedEdition = '';
        notice.append(document.createTextNode('This player belongs to your previous edition. '));
        const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close previous edition player';
        close.addEventListener('click', () => { players.forEach(audio => audio.pause()); retained.delete(node); control?.focus(); apply(); });
        notice.append(close); node.prepend(notice);
      }
      if (notice) notice.hidden = matches || !retained.has(node);
    });
    document.querySelectorAll('[data-edition-session-count]').forEach(node => {
      node.textContent = String(editions.find(row => row.version === resolve())?.sessions || 0);
    });
    document.querySelectorAll('a[href]').forEach(updateLink);
    document.dispatchEvent(new CustomEvent('ocf-edition-change', {detail: {selection, edition: resolve()}}));
  };
  window.ocfEditions = {current: resolve, selection: () => selection, refresh: apply};
  restore();
  if (control) {
    control.replaceChildren();
    for (const [value, label] of [['latest', `Latest (${latest})`], ...versions.map(version => [version, `Edition ${version}`])]) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; control.append(option);
    }
    document.querySelector('[data-edition-controls]').hidden = !versions.length;
    control.addEventListener('change', () => {
      selection = normalize(control.value, versions); remember();
      const url = new URL(location.href);
      if (persisted) url.searchParams.delete('edition'); else url.searchParams.set('edition', selection);
      history.replaceState(history.state, '', url);
      apply();
    });
  }
  window.addEventListener('pageshow', () => { restore(); apply(); });
  window.addEventListener('storage', event => { if (event.key === key) { restore(); apply(); } });
  document.addEventListener('click', event => { const link = event.target.closest?.('a[href]'); if (link) updateLink(link); }, true);
  apply();
})();
