(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const audio = document.querySelector('audio');
  const source = audio.querySelector('source');
  const original = source.getAttribute('src');
  const status = byId('media-status');
  const settings = byId('settings');
  const dialog = byId('choices');
  const tuning = byId('tuning');
  const bookmarks = byId('bookmarks');
  const preferred = () => window.ocfFormats?.current() === 'flac' ? 'flac' : 'mp3';
  let edited = false;
  let edit;
  let route;
  let unavailable = false;

  function select(useEdit) {
    const format = preferred();
    const url = useEdit ? route : format === 'flac' ? original.replace('615be1781932.mp3','dcc4f79302ed.flac') : original;
    if (source.getAttribute('src') !== url) {
      audio.pause();
      source.setAttribute('src',url);
      source.type = !useEdit && format === 'flac' ? 'audio/flac' : 'audio/mpeg';
      audio.load();
    }
    edited = useEdit;
    bookmarks.hidden = !edited;
    if (!edited) bookmarks.open = false;
    status.textContent = edited ? 'Smart Play: Resonant Tuning off · MP3. Your site format preference is unchanged.'
      : 'Original recording · ' + format.toUpperCase() + '.' + (unavailable ? ' Smart Play is unavailable right now.' : '');
  }

  function fail() {
    unavailable = true;
    tuning.querySelector('[value="off"]').disabled = true;
    tuning.value = 'original';
    select(false);
  }

  settings.addEventListener('click', () => {
    tuning.value = edited ? 'off' : 'original';
    dialog.returnValue = '';
    dialog.showModal();
  });
  dialog.addEventListener('close', () => {
    if (dialog.returnValue === 'apply') select(tuning.value === 'off' && !unavailable);
    settings.focus();
  });
  const failedAudio = () => { if (edited && audio.currentSrc === route) fail(); };
  audio.addEventListener('error', failedAudio);
  source.addEventListener('error', failedAudio);
  document.addEventListener('ocf-edition-change', () => {
    if (!edited && audio.paused) select(false);
  });
  byId('before-edit').addEventListener('click', () => {
    if (!edited) return;
    audio.currentTime = Math.max(0, edit.join - 15);
  });
  select(false);
  fetch('stream.json', {cache:'no-store', credentials:'omit', redirect:'error'})
    .then(async response => {
      if (!response.ok) throw Error('Manifest unavailable');
      edit = await response.json();
      if (!/^[a-f0-9]{64}$/.test(edit.sha256) ||
          edit.file !== 'energy-ball-tuning-off-' + edit.sha256.slice(0,16) + '.mp3' ||
          !Number.isSafeInteger(edit.bytes) || edit.bytes < 75000000 || edit.bytes > 85000000 ||
          !Number.isFinite(edit.join) || Math.abs(edit.join - 467.6) > .001 || !(edit.duration > 1989 && edit.duration < 1992)) throw Error('Invalid route');
      route = new URL(edit.file, location.href).href;
      const start = edit.bytes - 1024;
      const res = await fetch(route, {headers:{Range:'bytes=' + start + '-' + (start+1)},cache:'no-store',credentials:'omit',redirect:'error'});
      if (res.status !== 206 || res.headers.get('content-range') !== 'bytes ' + start + '-' + (start+1) + '/' + edit.bytes ||
          !/^audio\/mpeg(?:;|$)/i.test(res.headers.get('content-type') || '') || (await res.arrayBuffer()).byteLength !== 2) throw Error('Range delivery unavailable');
      settings.hidden = false;
    }).catch(fail);
})();
