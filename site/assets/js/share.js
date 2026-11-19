/* Sharing uses only the generated canonical URL, never browser or private state. */
(function () {
  'use strict';
  function publicURL(value) {
    try {
      const url = new URL(value);
      if (url.origin !== 'https://ocfproject.org' || url.username || url.password) return null;
      url.search = ''; url.hash = '';
      return url.href;
    } catch (_) { return null; }
  }
  if (typeof module !== 'undefined') module.exports = {publicURL};
  if (typeof document === 'undefined') return;
  const panel = document.querySelector('[data-page-share]');
  const canonical = document.querySelector('link[rel="canonical"]');
  const url = canonical && publicURL(canonical.getAttribute('href'));
  if (!panel || !url) return;
  const copy = panel.querySelector('[data-share-copy]');
  const native = panel.querySelector('[data-share-native]');
  const status = panel.querySelector('[data-share-status]');
  const manual = panel.querySelector('[data-share-manual]');
  const input = panel.querySelector('[data-share-url]');
  let busy = false;
  panel.hidden = false;
  native.hidden = typeof navigator.share !== 'function';
  function fallback() {
    manual.hidden = false; input.value = url; input.focus(); input.select();
    status.textContent = 'Automatic copying is unavailable. Copy the page link below.';
  }
  async function action(kind) {
    if (busy) return;
    busy = true; copy.disabled = true; native.disabled = true;
    status.textContent = ''; manual.hidden = true;
    try {
      if (kind === 'native') {
        await navigator.share({url});
        status.textContent = 'Share dialog closed.';
      } else {
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') { fallback(); return; }
        await navigator.clipboard.writeText(url);
        status.textContent = 'Link copied.';
      }
    } catch (error) {
      if (kind === 'native') status.textContent = error && error.name === 'AbortError' ? 'Sharing cancelled.' : 'Sharing is unavailable. Use Copy link instead.';
      else fallback();
    } finally { busy = false; copy.disabled = false; native.disabled = false; }
  }
  copy.addEventListener('click', () => action('copy'));
  native.addEventListener('click', () => action('native'));
})();
