/* One explicit audio-edition preference across the public site. No audio is fetched here. */
(() => {
  'use strict';
  const key = 'ocf-audio-edition:v1';
  const normalizeFormat = value => value === 'flac' ? 'flac' : 'mp3';
  const normalize = (value, editions) => value === 'latest' || editions.includes(value) ? value : 'latest';
  if (typeof module !== 'undefined') module.exports = {normalize, normalizeFormat};
  if (typeof document === 'undefined') return;
  const metadata = document.getElementById('audio-editions');
  if (!metadata) return;
  const editions = JSON.parse(metadata.textContent);
  const versions = editions.map(row => row.version);
  const latest = versions[0] || '';
  const control = document.getElementById('edition-filter');
  const formatControl = document.getElementById('format-filter');
  let format = 'mp3';
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
    const data = JSON.stringify({schema: 1, selection, format, updatedAt: revision});
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
      format = normalizeFormat(saved[0].format);
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
      format = normalizeFormat(new URL(location.href).searchParams.get('format'));
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
    const query = new URLSearchParams(target.search); query.set('edition', selection); query.set('format', format);
    link.setAttribute('href', original.split(/[?#]/)[0] + '?' + query + target.hash);
  };
  const applyFormats = () => {
    if (formatControl) formatControl.value = format;
    document.querySelectorAll('[data-format-content]').forEach(node => { node.hidden = node.dataset.formatContent !== format; });
    document.querySelectorAll('[data-format-session]').forEach(node => {
      let note = node.querySelector(':scope > [data-format-unavailable]');
      const available = JSON.parse(node.dataset.formatSession).includes(format);
      if (!note) { note = document.createElement('p'); note.dataset.formatUnavailable = ''; node.append(note); }
      note.hidden = available; note.textContent = `${format.toUpperCase()} is not available for this session. Choose another format to listen or download.`;
    });
    document.querySelectorAll('audio[data-format-sources]').forEach(player => {
      const sources = JSON.parse(player.dataset.formatSources);
      const target = sources[format];
      let current = player.dataset.sessionFormat;
      let note = player.nextElementSibling;
      if (!note?.hasAttribute('data-format-player-notice')) {
        note = document.createElement('p'); note.dataset.formatPlayerNotice = ''; player.after(note);
      }
      const switchSource = (refresh = true) => {
        if (!target) return;
        player.pause();
        player.dataset.formatGeneration = String(Number(player.dataset.formatGeneration || 0) + 1);
        for (const field of ['ocfResumePosition','ocfResumeEnded','ocfResumePositionExplicit','ocfRestoredBookmarkPending','ocfRestoredBookmarkPosition','ocfRestoredBookmarkEnded','ocfApplyingResume','ocfLiveSeek']) delete player.dataset[field];
        const source = player.querySelector('source');
        if (source) { source.src = target; source.type = format === 'mp3' ? 'audio/mpeg' : 'audio/flac'; }
        else player.src = target;
        player.dataset.sessionFormat = format;
        delete player.dataset.formatUsed;
        player.load();
        player.dispatchEvent(new Event('ocf-format-switched'));
        if (refresh) applyFormats();
      };
      if (!player.dataset.formatBound) {
        player.dataset.formatBound = 'true';
        ['play', 'seeking'].forEach(event => player.addEventListener(event, () => { player.dataset.formatUsed = 'true'; }));
      }
      const used = player.dataset.formatUsed === 'true' || !player.paused || player.currentTime > 0;
      if (current !== format && target && !used) { switchSource(false); current = format; }
      player.hidden = !target && !used;
      note.replaceChildren(); note.hidden = current === format || player.hidden;
      if (!note.hidden) {
        note.append(document.createTextNode(`This player remains ${String(current).toUpperCase()}; its playback has not changed. `));
        if (target) {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = `Switch player to ${format.toUpperCase()}`;
          button.addEventListener('click', () => { switchSource(); if (window.ocfFocusPlaybackControl) window.ocfFocusPlaybackControl(player); else player.focus(); }); note.append(button);
        }
      }
    });
  };
  const apply = () => {
    applyFormats();
    if (control) control.value = selection;
    document.querySelectorAll('[data-audio-preference-summary]').forEach(node => {
      node.textContent = `${selection === 'latest' ? 'Latest' : 'Edition'} ${resolve()} · ${format.toUpperCase()}`;
    });
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
        close.addEventListener('click', () => { players.forEach(audio => audio.pause()); retained.delete(node); (control?.closest('dialog')?.open ? control : document.querySelector('[data-preferences-open]'))?.focus(); apply(); });
        notice.append(close); node.prepend(notice);
      }
      if (notice) notice.hidden = matches || !retained.has(node);
    });
    document.querySelectorAll('[data-edition-session-count]').forEach(node => {
      node.textContent = String(editions.find(row => row.version === resolve())?.sessions || 0);
    });
    document.querySelectorAll('a[href]').forEach(updateLink);
    document.dispatchEvent(new CustomEvent('ocf-edition-change', {detail: {selection, edition: resolve(), format}}));
  };
  window.ocfFormats = {current: () => format, refresh: applyFormats};
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
      if (persisted) { url.searchParams.delete('edition'); url.searchParams.delete('format'); }
      else { url.searchParams.set('edition', selection); url.searchParams.set('format', format); }
      history.replaceState(history.state, '', url);
      apply();
    });
  }
  formatControl?.addEventListener('change', () => {
    format = normalizeFormat(formatControl.value); remember();
    const url = new URL(location.href);
    if (persisted) { url.searchParams.delete('format'); url.searchParams.delete('edition'); }
    else { url.searchParams.set('format', format); url.searchParams.set('edition', selection); }
    history.replaceState(history.state, '', url); apply();
  });
  window.addEventListener('pageshow', () => { restore(); apply(); });
  window.addEventListener('storage', event => { if (event.key === key) { restore(); apply(); } });
  document.addEventListener('click', event => { const link = event.target.closest?.('a[href]'); if (link) updateLink(link); }, true);
  apply();
})();
