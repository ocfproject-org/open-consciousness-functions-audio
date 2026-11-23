(() => {
  'use strict';
  const players = new WeakMap();
  const selector = 'audio[data-format-sources], audio[data-surprise-player]';
  const textTime = seconds => {
    const n = Math.floor(Math.max(0, Number.isFinite(seconds) ? seconds : 0));
    return [Math.floor(n / 60), String(n % 60).padStart(2, '0')].join(':');
  };
  const add = (tag, attrs = {}, text) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    if (text) el.textContent = text;
    return el;
  };
  function register(audio) {
    if (players.has(audio)) return players.get(audio);
    const ui = add('div', {class: 'ocf-recording-controls'});
    const player = add('div', {class: 'ocf-local-player', role: 'group', 'aria-label': 'Audio playback'});
    const play = add('button', {type: 'button', 'aria-label': 'Play'});
    const glyph = add('span', {'aria-hidden': 'true'}, '▶');
    const seekArea = add('div', {class: 'ocf-local-position'});
    const seek = add('input', {type: 'range', 'aria-label': 'Seek', min: '0', max: '1', step: '0.1', value: '0'});
    const time = add('output', {'aria-live': 'off'});
    const extra = add('details', {class: 'ocf-key-help'});
    const system = add('button', {type: 'button', 'aria-pressed': 'false'}, 'Use browser controls');
    const error = add('p', {role: 'status'});
    error.hidden = true;
    extra.append(add('summary', {}, 'Keyboard and playback options'), add('p', {}, 'Tab to Play/Pause and press Space or Enter. On Seek, use the arrows for 5 seconds, Page Up/Down for 30 seconds, or Home/End to jump. Browser controls are available for captions and other device options.'), system);
    seekArea.append(seek, time); play.append(glyph); player.append(play, seekArea); ui.append(player, extra, error);
    audio.before(ui);
    let fallback = false, scrubbing = false;
    const originalTab = audio.getAttribute('tabindex');
    const focus = () => (fallback ? audio : play).focus();
    players.set(audio, {focus});
    function refreshMode() {
      ui.hidden = audio.hidden;
      audio.controls = fallback;
      audio.classList.toggle('ocf-compact-audio', !fallback);
      player.hidden = fallback;
      system.setAttribute('aria-pressed', String(fallback));
      system.textContent = fallback ? 'Use compact controls' : 'Use browser controls';
      if (fallback) {
        audio.removeAttribute('aria-hidden');
        if (originalTab === null) audio.setAttribute('tabindex', '0');
        else audio.setAttribute('tabindex', originalTab);
      } else {
        audio.setAttribute('aria-hidden', 'true');
        audio.tabIndex = -1;
      }
    }
    function update() {
      const active = !audio.paused && !audio.ended;
      const label = active ? 'Pause' : 'Play';
      if (play.getAttribute('aria-label') !== label) {
        play.setAttribute('aria-label', label); glyph.textContent = active ? 'Ⅱ' : '▶';
      }
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      seek.disabled = duration <= 0;
      seek.max = duration || 1;
      if (!scrubbing) seek.value = Math.min(audio.currentTime || 0, duration);
      const pos = textTime(scrubbing ? seek.valueAsNumber : audio.currentTime), end = textTime(duration);
      const stamp = duration ? pos + ' / ' + end : pos;
      if (time.textContent !== stamp) time.textContent = stamp;
      seek.setAttribute('aria-valuetext', pos + ' of ' + end);
      player.setAttribute('aria-label', audio.getAttribute('aria-label') || 'Audio playback');
    }
    function moveTo(target) {
      if (!Number.isFinite(audio.duration)) return;
      scrubbing = false;
      try { audio.currentTime = Math.max(0, Math.min(target, audio.duration)); }
      catch { /* Before metadata, no browser seek is available. */ }
      update();
    }
    play.addEventListener('click', () => {
      error.hidden = true;
      if (!audio.paused && !audio.ended) audio.pause();
      else audio.play().catch(e => {
        if (e.name === 'AbortError') return;
        error.textContent = 'Could not play this recording. Try again or use the download link.';
        error.hidden = false;
      });
      update();
    });
    seek.addEventListener('input', () => { scrubbing = true; update(); });
    seek.addEventListener('change', () => moveTo(seek.valueAsNumber));
    seek.addEventListener('blur', () => { scrubbing = false; update(); });
    seek.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const jump = {ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 30, PageDown: -30}[event.key];
      if (jump === undefined && !['Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      moveTo(event.key === 'Home' ? 0 : event.key === 'End' ? audio.duration : audio.currentTime + jump);
    });
    system.addEventListener('click', () => { fallback = !fallback; refreshMode(); focus(); });
    for (const event of ['play', 'pause', 'ended', 'loadedmetadata', 'durationchange', 'timeupdate', 'seeking', 'emptied', 'ocf-format-switched']) audio.addEventListener(event, update);
    new MutationObserver(records => {
      if (records.some(record => record.attributeName === 'hidden')) ui.hidden = audio.hidden;
      update();
    }).observe(audio, {attributes: true, attributeFilter: ['hidden', 'aria-label']});
    refreshMode(); update();
    return players.get(audio);
  }
  window.ocfFocusPlaybackControl = audio => register(audio).focus();
  function scan(root) {
    if (root.nodeType !== 1) return;
    if (root.matches(selector)) register(root);
    root.querySelectorAll(selector).forEach(register);
  }
  scan(document.body);
  new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) scan(node);
  }).observe(document.body, {childList: true, subtree: true});
})();
