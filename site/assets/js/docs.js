/* Progressive enhancement for generated OCF documentation pages. */
(() => {
  'use strict';
  const normalize = value => String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const matches = (node, query, category = '', audio = '', language = '', voice = '') => {
    const terms = normalize(query);
    const categoryMatches = !category || (node.dataset.category || '').split(/\s+/).includes(category);
    const audioMatches = !audio || node.dataset.audio === audio;
    const languageMatches = !language || (node.dataset.language || '').split('|').includes(language);
    const voiceMatches = !voice || (node.dataset.voice || '').split('|').includes(voice);
    return categoryMatches && audioMatches && languageMatches && voiceMatches && (!terms || normalize(node.dataset.search).includes(terms));
  };
  // Downloads only: retain all direct matches, then offer bounded typo fallback.
  const normalizeCue = value => normalize(value).replace(/^plus\s+/, '');
  const editDistance = (left, right) => {
    const rows = Array.from({length: left.length + 1}, (_, i) => [i]);
    for (let j = 1; j <= right.length; j++) rows[0][j] = j;
    for (let i = 1; i <= left.length; i++) for (let j = 1; j <= right.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
    return rows[left.length][right.length];
  };
  const rankDownloads = (cards, query) => {
    const term = normalize(query), cueTerm = normalizeCue(query);
    if (!term) return {matches: [...cards], fuzzy: false};
    const rows = cards.map((card, index) => {
      const title = normalize(card.dataset.downloadTitle);
      const cues = JSON.parse(card.dataset.downloadCues || '[]').map(normalizeCue);
      let rank = Infinity;
      if (title === term || (cueTerm && cues.includes(cueTerm))) rank = 0;
      else if (title.startsWith(term) || (cueTerm && cues.some(cue => cue.startsWith(cueTerm)))) rank = 1;
      else if (title.includes(term) || (cueTerm && cues.some(cue => cue.includes(cueTerm)))) rank = 2;
      else if (normalize(card.dataset.downloadSearch).includes(term)) rank = 3;
      return {card, index, rank, primary: [title, ...cues]};
    });
    const direct = rows.filter(row => Number.isFinite(row.rank));
    if (direct.length) return {matches: direct.sort((a, b) => a.rank - b.rank || a.index - b.index).map(row => row.card), fuzzy: false};
    if (cueTerm.length < 4 || cueTerm.length > 64) return {matches: [], fuzzy: false};
    const threshold = cueTerm.length >= 8 ? 2 : 1;
    const close = rows.map(row => ({...row, distance: Math.min(...row.primary.filter(value => Math.abs(value.length - cueTerm.length) <= threshold).map(value => editDistance(value, cueTerm)))}))
      .filter(row => row.distance <= threshold).sort((a, b) => a.distance - b.distance || a.index - b.index);
    return {matches: close.map(row => row.card), fuzzy: close.length > 0};
  };
  const safeTranscript = (value, currentURL) => {
    try {
      const url = new URL(value, currentURL);
      return url.origin === new URL(currentURL).origin && url.pathname.includes('/transcripts/') ? url.href : null;
    } catch (_) { return null; }
  };
  const highlight = (pre, text, query) => {
    pre.replaceChildren();
    if (!query) { pre.textContent = text; return; }
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(escaped, 'giu');
    let cursor = 0;
    for (const match of text.matchAll(expression)) {
      const index = match.index ?? cursor;
      if (index > cursor) pre.append(document.createTextNode(text.slice(cursor, index)));
      const mark = document.createElement('mark'); mark.textContent = match[0]; pre.append(mark);
      cursor = index + match[0].length;
    }
    if (cursor < text.length) pre.append(document.createTextNode(text.slice(cursor)));
  };
  if (typeof module !== 'undefined') module.exports = {normalize, matches, safeTranscript, highlight, normalizeCue, rankDownloads};
  if (typeof document === 'undefined') return;

  document.querySelectorAll('[data-no-script-note]').forEach(note => { note.hidden = true; });

  // Construct the address only on request; the readable fallback remains usable without JS.
  const feedbackButton = document.querySelector('[data-feedback-reveal]');
  if (feedbackButton) feedbackButton.addEventListener('click', () => {
    const address = ['feedback', ['ocfproject', 'org'].join('.')].join('@');
    const link = document.createElement('a');
    link.href = 'mailto:' + address;
    link.textContent = address;
    document.querySelector('[data-feedback-result]').replaceChildren(link);
    feedbackButton.hidden = true;
    link.focus();
  });

  // Local, short stereo signal only: no recording, remote request or device detection.
  const stereoTest = document.querySelector('.stereo-test');
  if (stereoTest) {
    const channelButtons = [...stereoTest.querySelectorAll('[data-test-channel]')];
    const stopButton = stereoTest.querySelector('[data-test-stop]');
    const status = stereoTest.querySelector('[data-test-status]');
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    let context = null;
    let source = null;
    let generation = 0;
    const stop = (message = 'Test stopped.') => {
      generation += 1;
      if (source) {
        source.onended = null;
        try { source.stop(); } catch (_) { /* Already ended. */ }
        source.disconnect();
        source = null;
      }
      stopButton.disabled = true;
      channelButtons.forEach(button => button.setAttribute('aria-pressed', 'false'));
      status.textContent = message;
    };
    if (!AudioContextClass) {
      channelButtons.forEach(button => { button.disabled = true; });
      status.textContent = 'This browser does not support the interactive audio test. Use the device setup guides below.';
    } else channelButtons.forEach(button => {
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', async () => {
        stop('Preparing test…');
        const ticket = generation;
        stopButton.disabled = false; // Stop also cancels a pending resume request.
        const channel = Number(button.dataset.testChannel);
        try {
          if (!context) context = new AudioContextClass();
          await context.resume();
          if (ticket !== generation || document.hidden) return;
          document.querySelectorAll('audio').forEach(audio => audio.pause());
          const length = Math.floor(context.sampleRate * 0.8);
          const buffer = context.createBuffer(2, length, context.sampleRate);
          const samples = buffer.getChannelData(channel);
          const fade = Math.floor(context.sampleRate * 0.04);
          for (let i = 0; i < length; i += 1) {
            const envelope = Math.min(1, i / fade, (length - 1 - i) / fade);
            samples[i] = 0.04 * envelope * Math.sin(2 * Math.PI * 440 * i / context.sampleRate);
          }
          source = context.createBufferSource();
          source.buffer = buffer; // The opposite channel remains exactly zero.
          source.connect(context.destination);
          source.onended = () => { if (ticket === generation) stop('Test finished. Choose a channel to play again.'); };
          source.start();
          button.setAttribute('aria-pressed', 'true');
          status.textContent = `Playing ${channel === 0 ? 'left' : 'right'} channel only.`;
        } catch (_) {
          if (ticket === generation) stop('The audio test could not start. Check your browser audio permissions and try again.');
        }
      });
    });
    stopButton.addEventListener('click', () => stop());
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    window.addEventListener('pagehide', () => {
      stop();
      if (context) { context.close().catch(() => {}); context = null; }
    });
    // Starting another audio player always stops this test first.
    document.addEventListener('play', event => { if (event.target.tagName === 'AUDIO') stop(); }, true);
  }

  const legacyParams = new URLSearchParams(location.search);
  const legacyFunction = legacyParams.get('function');
  const legacyCategory = legacyParams.get('category');
  const pathParts = location.pathname.replace(/index\.html$/, '').split('/').filter(Boolean);
  const atSiteRoot = pathParts.length <= 1 && !/(?:^|\/)(?:functions|start|listening|quick-reference|historical-names|relationships|downloads|about|preparation-learning|how-it-works|get-involved|function-chains|practice-chains)(?:\/|$)/.test(location.pathname);
  if (atSiteRoot && ((legacyFunction && /^OCF-[A-Z]{3}-\d{3}$/.test(legacyFunction)) || (legacyCategory && /^[a-z][a-z-]*$/.test(legacyCategory)))) {
    const destination = new URL('functions/', location.href);
    if (legacyFunction) destination.searchParams.set('function', legacyFunction);
    if (legacyCategory) destination.searchParams.set('category', legacyCategory);
    destination.hash = location.hash;
    location.replace(destination.href);
    return;
  }

  const managedPlayers = new Set();
  const startedPlayers = new WeakSet();
  const failedPlayers = new WeakSet();
  const playbackTimers = new WeakMap();
  const playbackTime = seconds => {
    const value = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  };
  const updatePlaybackStatus = audio => {
    const status = audio.closest('.edition-card, .session-card')?.querySelector('[data-playback-status]');
    if (!status) return;
    const title = audio.dataset.sessionTitle || audio.getAttribute('aria-label') || 'This session';
    const edition = audio.dataset.sessionEdition ? `, edition ${audio.dataset.sessionEdition}` : '';
    const filtered = audio.closest('.session-card')?.dataset.filteredOut === 'true';
    const filteredNote = filtered ? ' This edition does not match the current filters; its controls remain available.' : '';
    let message = '';
    if (audio.error || failedPlayers.has(audio)) {
      message = audio.dataset.surprisePlayer === 'true'
        ? 'Audio could not be played. Check your connection and try again, or choose another session.'
        : `Audio could not be played. Check your connection or use the direct download link below.${filteredNote}`;
    } else if (audio.ended || audio.dataset.ocfResumeEnded === 'true') {
      message = `Playback ended for ${title}${edition}. Use the player controls to replay.${filteredNote}`;
    } else if (!audio.paused && audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
      message = `Loading audio for ${title}${edition}.${filteredNote}`;
    } else if (!audio.paused) {
      message = `Playing ${title}${edition}.${filteredNote}`;
    } else if (startedPlayers.has(audio) || Number(audio.dataset.ocfResumePosition) > 0 || audio.dataset.ocfResumePositionExplicit === 'true') {
      const position = Number(audio.dataset.ocfResumePosition) > 0 ? Number(audio.dataset.ocfResumePosition) : audio.currentTime;
      message = `Paused at ${playbackTime(position)}. Use the player controls to resume.${filteredNote}`;
    } else if (filtered && audio.closest('.session-card')?.contains(document.activeElement)) {
      message = `This edition does not match the current filters; its player remains available while focused.`;
    }
    status.textContent = message;
    status.hidden = !message;
  };
  const registerMediaPlayer = audio => {
    if (managedPlayers.has(audio)) return;
    const status = audio.closest('.edition-card, .session-card')?.querySelector('[data-playback-status]');
    if (!status) return;
    managedPlayers.add(audio);
    const cancelPlaybackTimer = () => {
      const timer = playbackTimers.get(audio);
      if (timer) window.clearTimeout(timer);
      playbackTimers.delete(audio);
    };
    const monitorPlaybackStart = () => {
      if (playbackTimers.has(audio)) return;
      playbackTimers.set(audio, window.setTimeout(() => {
        playbackTimers.delete(audio);
        const noSource = audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE;
        const stalledDuringPlayback = startedPlayers.has(audio) && !audio.paused && audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA;
        if (noSource || stalledDuringPlayback) {
          failedPlayers.add(audio);
          updatePlaybackStatus(audio);
        }
      }, 8000));
    };
    audio.querySelectorAll('source').forEach(source => source.addEventListener('error', () => {
      failedPlayers.add(audio);
      cancelPlaybackTimer();
      updatePlaybackStatus(audio);
    }));
    audio.addEventListener('play', () => {
      startedPlayers.add(audio);
      const clearRestoredBookmark = () => {
        delete audio.dataset.ocfRestoredBookmarkPending;
        delete audio.dataset.ocfRestoredBookmarkPosition;
        delete audio.dataset.ocfRestoredBookmarkEnded;
      };
      if (audio.dataset.ocfResumeEnded === 'true') {
        delete audio.dataset.ocfResumeEnded;
        clearRestoredBookmark();
      }
      if (audio.dataset.ocfResumePositionExplicit === 'true') {
        delete audio.dataset.ocfResumePositionExplicit;
        clearRestoredBookmark();
      }
      const resumePosition = Number(audio.dataset.ocfResumePosition);
      if (Number.isFinite(resumePosition) && resumePosition > 0) {
        const resumeGeneration = audio.dataset.formatGeneration;
        const restorePosition = () => {
          if (audio.dataset.formatGeneration !== resumeGeneration) return;
          try {
            audio.dataset.ocfApplyingResume = 'true';
            const finishRestore = () => {
              if (audio.dataset.formatGeneration !== resumeGeneration) return;
              if (Math.abs(audio.currentTime - resumePosition) < 0.25) {
                delete audio.dataset.ocfResumePosition;
                delete audio.dataset.ocfApplyingResume;
                clearRestoredBookmark();
              }
            };
            audio.addEventListener('seeked', finishRestore, {once: true});
            audio.currentTime = resumePosition;
            if (!audio.seeking && Math.abs(audio.currentTime - resumePosition) < 0.25) {
              audio.removeEventListener('seeked', finishRestore);
              delete audio.dataset.ocfResumePosition;
              delete audio.dataset.ocfApplyingResume;
              clearRestoredBookmark();
            }
          } catch (_) {
            delete audio.dataset.ocfApplyingResume;
            /* Leave native controls available if this browser cannot restore a seek yet. */
          }
        };
        if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) restorePosition();
        else audio.addEventListener('loadedmetadata', restorePosition, {once: true});
      }
      for (const other of managedPlayers) if (other !== audio && !other.paused) other.pause();
      monitorPlaybackStart();
      updatePlaybackStatus(audio);
    });
    audio.addEventListener('emptied', () => {
      cancelPlaybackTimer();
      startedPlayers.delete(audio);
      failedPlayers.delete(audio);
      updatePlaybackStatus(audio);
    });
    audio.addEventListener('loadstart', monitorPlaybackStart);
    audio.addEventListener('waiting', monitorPlaybackStart);
    ['pause', 'ended', 'seeked', 'error'].forEach(event => audio.addEventListener(event, () => {
      cancelPlaybackTimer();
      if (event === 'error') failedPlayers.add(audio);
      updatePlaybackStatus(audio);
    }));
    ['loadedmetadata', 'canplay', 'playing'].forEach(event => audio.addEventListener(event, () => {
      cancelPlaybackTimer();
      failedPlayers.delete(audio);
      updatePlaybackStatus(audio);
    }));
    updatePlaybackStatus(audio);
  };
  window.ocfRegisterMediaPlayer = registerMediaPlayer;
  window.ocfUpdateMediaPlayerStatus = updatePlaybackStatus;
  document.querySelectorAll('audio').forEach(registerMediaPlayer);

  const themeButton = document.querySelector('[data-theme-toggle]');
  if (themeButton) {
    const themes = ['system', 'light', 'dark', 'black'];
    const setThemePreference = preference => {
      if (preference === 'system') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.dataset.theme = preference;
      const label = preference[0].toUpperCase() + preference.slice(1);
      themeButton.textContent = `Theme: ${label}`;
      themeButton.setAttribute('aria-label', `Color theme: ${label}. Activate to change.`);
      themeButton.dataset.themePreference = preference;
      const themeColor = document.querySelector('meta[name="theme-color"]');
      if (themeColor) themeColor.content = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
    };
    let preference = 'system';
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setThemePreference(preference));
    try {
      const saved = localStorage.getItem('ocf-theme');
      if (themes.includes(saved)) preference = saved;
      setThemePreference(preference);
      themeButton.addEventListener('click', () => {
        preference = themes[(themes.indexOf(preference) + 1) % themes.length];
        setThemePreference(preference);
        try { localStorage.setItem('ocf-theme', preference); } catch (_) { /* Keep the theme control usable without storage. */ }
      });
    } catch (_) {
      setThemePreference(preference);
      themeButton.addEventListener('click', () => {
        preference = themes[(themes.indexOf(preference) + 1) % themes.length];
        setThemePreference(preference);
      });
    }
  }

  // Static downloads remain complete without JS. Enhancement narrows only visibility.
  const downloadSearch = document.getElementById('download-search');
  if (downloadSearch) {
    const cards = [...document.querySelectorAll('[data-download-card]')];
    const more = document.getElementById('downloads-more');
    const count = document.getElementById('download-count');
    const clear = document.getElementById('download-clear');
    const directory = document.getElementById('download-results');
    const intro = document.querySelector('[data-download-intro]');
    const storageKey = 'ocf-downloads-view:v1';
    let limit = 12;
    let identity = '';
    const restore = () => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(storageKey) || '{}');
        if (typeof saved.query === 'string') downloadSearch.value = saved.query;
        if (Number.isInteger(saved.limit) && saved.limit >= 12) limit = Math.min(saved.limit, cards.length || 12);
        if (typeof saved.identity === 'string') identity = saved.identity;
      } catch (_) { /* Search remains usable without storage. */ }
    };
    const render = () => {
      const edition = window.ocfEditions?.current() || '';
      const format = window.ocfFormats?.current() || 'mp3';
      const nextIdentity = edition + ':' + format;
      if (identity && identity !== nextIdentity) limit = 12;
      identity = nextIdentity;
      const query = normalize(downloadSearch.value);
      const ranked = rankDownloads(cards.filter(card => card.dataset.edition === edition && JSON.parse(card.dataset.formatSession).includes(format)), downloadSearch.value);
      const matches = ranked.matches;
      const matched = new Set(matches);
      const order = [...matches, ...cards.filter(card => !matched.has(card))];
      const focused = document.activeElement;
      order.forEach((card, index) => { if (directory.children[index] !== card) directory.insertBefore(card, directory.children[index] || null); });
      const visible = new Set(matches.slice(0, limit));
      cards.forEach(card => { card.hidden = !visible.has(card); });
      if (focused && focused !== document.body && focused.isConnected && !focused.closest('[hidden]') && document.activeElement !== focused) focused.focus({preventScroll: true});
      intro.hidden = Boolean(query);
      clear.disabled = !downloadSearch.value;
      more.hidden = matches.length <= limit;
      count.textContent = `${visible.size} of ${matches.length} sessions · ${format.toUpperCase()} · Edition ${edition}${matches.length ? (ranked.fuzzy ? ' — No direct matches; showing close title or cue matches.' : '') : ' — No matching downloads.'}`;
      try { sessionStorage.setItem(storageKey, JSON.stringify({query: downloadSearch.value, limit, identity})); } catch (_) { /* No storage required to search. */ }
      return matches;
    };
    restore();
    document.querySelector('.download-tools').hidden = false;
    downloadSearch.addEventListener('input', () => { limit = 12; render(); });
    clear.addEventListener('click', () => { downloadSearch.value = ''; limit = 12; render(); downloadSearch.focus({preventScroll: true}); });
    more.addEventListener('click', () => { const firstNew = limit; limit += 12; const matches = render(); matches[firstNew]?.querySelector('h2 a')?.focus(); });
    document.addEventListener('ocf-edition-change', render);
    window.addEventListener('pageshow', () => { restore(); render(); });
    render();
  }

  const filterState = (scope, controls) => {
    const key = `ocf-filters:${location.pathname}:${scope}`;
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || '{}');
      for (const control of controls) {
        if (control && typeof saved[control.id] === 'string') control.value = saved[control.id];
      }
    } catch (_) { /* Filtering remains usable if session storage is unavailable. */ }
    return () => {
      try {
        sessionStorage.setItem(key, JSON.stringify(Object.fromEntries(
          controls.filter(Boolean).map(control => [control.id, control.value]),
        )));
      } catch (_) { /* Do not block filtering when storage is unavailable. */ }
    };
  };
  if ('scrollRestoration' in history) history.scrollRestoration = 'auto';

  const directorySearch = document.querySelector('[data-function-search]');
  const categoryFilter = document.querySelector('[data-category-filter]');
  const audioFilter = document.querySelector('[data-audio-filter]');
  const languageFilter = document.querySelector('[data-directory-language]');
  const voiceFilter = document.querySelector('[data-directory-voice]');
  const directoryCount = document.querySelector('[data-directory-count]');
  const directoryClear = document.querySelector('[data-function-clear]');
  const directoryNoResults = document.querySelector('[data-function-no-results]');
  const functionCards = [...document.querySelectorAll('[data-function-card]')];
  const domainGroups = [...document.querySelectorAll('[data-domain-group]')];
  const directoryControls = [directorySearch, categoryFilter, audioFilter, languageFilter, voiceFilter].filter(Boolean);
  const saveDirectoryFilters = filterState('directory', directoryControls);
  const updateDirectory = () => {
    if (!directorySearch) return;
    let shown = 0;
    for (const card of functionCards) {
      const visible = matches(card, directorySearch.value, categoryFilter?.value || '', audioFilter?.value || '', languageFilter?.value || '', voiceFilter?.value || '') && (window.ocfLearned?.matches(card.dataset.learnedId) ?? true);
      card.hidden = !visible;
      if (visible) shown += 1;
    }
    window.ocfLearned?.order(functionCards, card => card.dataset.learnedId);
    for (const group of domainGroups) {
      group.hidden = !group.querySelector('[data-function-card]:not([hidden])');
    }
    if (directoryCount) directoryCount.textContent = `${shown} ${shown === 1 ? 'function' : 'functions'}`;
    if (directoryNoResults) directoryNoResults.hidden = shown > 0;
    if (directoryClear) directoryClear.hidden = !directoryControls.some(control => control.value);
  };
  directoryControls.forEach(control => {
    control.addEventListener('input', () => { saveDirectoryFilters(); updateDirectory(); });
    control.addEventListener('change', () => { saveDirectoryFilters(); updateDirectory(); });
  });
  directoryClear?.addEventListener('click', () => {
    directoryControls.forEach(control => { control.value = ''; });
    saveDirectoryFilters(); updateDirectory(); directorySearch?.focus();
  });
  updateDirectory();

  const referenceSearch = document.querySelector('[data-reference-search]');
  const referenceCategory = document.querySelector('[data-reference-category]');
  const referenceCount = document.querySelector('[data-reference-count]');
  const referenceClear = document.querySelector('[data-reference-clear]');
  const referenceNoResults = document.querySelector('[data-reference-no-results]');
  const referenceRows = [...document.querySelectorAll('[data-reference-row]')];
  const referenceControls = [referenceSearch, referenceCategory].filter(Boolean);
  const saveReferenceFilters = filterState('quick-reference', referenceControls);
  const updateReference = () => {
    if (!referenceSearch) return;
    let shown = 0;
    for (const row of referenceRows) {
      const visible = matches(row, referenceSearch.value, referenceCategory?.value || '') && (window.ocfLearned?.matches(row.dataset.learnedId) ?? true);
      row.hidden = !visible;
      if (visible) shown += 1;
    }
    window.ocfLearned?.decorate();
    window.ocfLearned?.order(referenceRows, row => row.dataset.learnedId);
    if (referenceCount) referenceCount.textContent = `${shown} ${shown === 1 ? 'function' : 'functions'}`;
    if (referenceNoResults) referenceNoResults.hidden = shown > 0;
    if (referenceClear) referenceClear.hidden = !referenceControls.some(control => control.value);
  };
  referenceControls.forEach(control => {
    control.addEventListener('input', () => { saveReferenceFilters(); updateReference(); });
    control.addEventListener('change', () => { saveReferenceFilters(); updateReference(); });
  });
  referenceClear?.addEventListener('click', () => {
    referenceControls.forEach(control => { control.value = ''; });
    saveReferenceFilters(); updateReference(); referenceSearch?.focus();
  });
  updateReference();
  document.addEventListener('ocf-learned-filter-change', () => { updateDirectory(); updateReference(); });

  for (const details of document.querySelectorAll('details[data-transcript]')) {
    let loaded = false;
    let loading = false;
    let transcriptText = '';
    const pre = details.querySelector('[data-transcript-src]');
    const search = details.querySelector('[data-transcript-search]');
    const status = details.querySelector('[data-transcript-status]');
    const retry = details.querySelector('[data-transcript-retry]');
    const navigation = details.querySelector('[data-transcript-navigation]');
    const previous = details.querySelector('[data-transcript-previous]');
    const next = details.querySelector('[data-transcript-next]');
    const matchStatus = details.querySelector('[data-transcript-matches]');
    let matches = [];
    let currentMatch = -1;
    const showMatch = (scroll = false) => {
      matches.forEach((mark, index) => {
        mark.classList.toggle('current-match', index === currentMatch);
        if (index === currentMatch) mark.setAttribute('aria-current', 'true');
        else mark.removeAttribute('aria-current');
      });
      if (matchStatus) matchStatus.textContent = matches.length ? `Match ${currentMatch + 1} of ${matches.length}` : (search?.value ? 'No matches' : '');
      if (previous) previous.disabled = matches.length === 0;
      if (next) next.disabled = matches.length === 0;
      if (navigation) navigation.hidden = !loaded || !search?.value;
      if (scroll && currentMatch >= 0) matches[currentMatch].scrollIntoView({block: 'center', behavior: 'instant'});
    };
    const updateMatches = () => {
      highlight(pre, transcriptText, search?.value || '');
      matches = [...pre.querySelectorAll('mark')];
      currentMatch = matches.length ? 0 : -1;
      showMatch();
    };
    const moveMatch = direction => {
      if (!matches.length) return;
      currentMatch = (currentMatch + direction + matches.length) % matches.length;
      showMatch(true);
    };
    search?.addEventListener('input', updateMatches);
    search?.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); moveMatch(event.shiftKey ? -1 : 1); }
    });
    previous?.addEventListener('click', () => moveMatch(-1));
    next?.addEventListener('click', () => moveMatch(1));
    const loadTranscript = async () => {
      if (!details.open || loaded || loading) return;
      const path = safeTranscript(pre?.dataset.transcriptSrc, location.href);
      if (!pre || !path) {
        if (pre) pre.textContent = 'This transcript path is not available.';
        if (status) {
          status.hidden = false;
          status.textContent = 'This transcript link is not available. Use the exact-edition download below.';
        }
        loaded = true;
        return;
      }
      loading = true;
      if (status) {
        status.hidden = false;
        status.textContent = 'Loading the published transcript for this edition…';
      }
      if (retry) retry.hidden = true;
      if (search) search.disabled = true;
      pre.textContent = 'Loading edition-matched transcript…';
      try {
        const response = await fetch(path, {credentials: 'omit'});
        if (!response.ok) throw new Error('Transcript unavailable');
        transcriptText = await response.text();
        if (search) search.disabled = false;
        loaded = true;
        updateMatches();
        if (status) status.textContent = 'Published transcript loaded.';
      } catch (_) {
        pre.textContent = 'The published transcript could not be loaded.';
        if (status) status.textContent = 'Transcript unavailable. Retry, or use the exact-edition text and timed-subtitle links below.';
        if (retry) retry.hidden = false;
      } finally {
        loading = false;
      }
    };
    details.addEventListener('toggle', () => { if (details.open) loadTranscript(); });
    retry?.addEventListener('click', loadTranscript);
  }

  for (const button of document.querySelectorAll('[data-copy]')) {
    button.addEventListener('click', async () => {
      const value = button.dataset.copy || '';
      try {
        await navigator.clipboard.writeText(value);
        button.textContent = 'Copied';
      } catch (_) {
        button.textContent = value;
      }
      window.setTimeout(() => { button.textContent = 'Copy'; }, 1200);
    });
  }

  const nav = document.querySelector('.mobile-nav');
  if (nav) {
    const summary = nav.querySelector('summary');
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { nav.open = false; }));
    document.addEventListener('pointerdown', event => {
      if (nav.open && !nav.contains(event.target)) nav.open = false;
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && nav.open) {
        nav.open = false;
        summary.focus();
      }
    });
  }

  const tocLinks = [...document.querySelectorAll('.desktop-toc a, .mobile-toc a')];
  const sections = tocLinks.map(link => document.getElementById(decodeURIComponent(link.hash.slice(1)))).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      for (const link of tocLinks) {
        if (link.hash === `#${visible.target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }, {rootMargin: '-12% 0px -70% 0px', threshold: [0, 0.25, 0.5]});
    sections.forEach(section => observer.observe(section));
  }
})();
