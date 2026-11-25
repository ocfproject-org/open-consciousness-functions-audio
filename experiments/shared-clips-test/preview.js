(() => {
  'use strict';
  const base = '/experiments/shared-clips-test/';
  const prefix = 'ocf.shared-clips-preview:';
  window.ocfPreviewBase = base;
  window.ocfPreviewSupports = id => id === 'OCF-FND-004' || id === 'OCF-EXP-007';
  window.ocfPreviewStorageKey = key => key?.startsWith(prefix) ? key.slice(prefix.length) : null;
  // The regular UI runs on the same origin. Keep its real data out of this preview.
  window.ocfPreviewStorage = name => {
    const storage = () => window[name];
    const keys = () => Object.keys(storage()).filter(key => key.startsWith(prefix));
    return Object.freeze({
      get length() { return keys().length; },
      key: index => window.ocfPreviewStorageKey(keys()[index]),
      getItem: key => storage().getItem(prefix + key),
      setItem: (key, value) => storage().setItem(prefix + key, value),
      removeItem: key => storage().removeItem(prefix + key),
    });
  };
  window.ocfPreviewAudio = (async () => {
    const manager = navigator.serviceWorker;
    if (!manager) return null;
    const expected = new URL(base + 'worker.mjs?v=full-options-1', location.origin).href;
    const attached = () => manager.controller?.scriptURL === expected;
    try {
      const reg = await manager.register(expected, {type: 'module', scope: base, updateViaCache: 'none'});
      if (reg.scope !== new URL(base, location.origin).href) return null;
      if (!attached()) await new Promise((resolve, reject) => {
        const onChange = () => {
          if (attached()) { clearTimeout(timer); manager.removeEventListener('controllerchange', onChange); resolve(); }
        };
        const timer = setTimeout(() => { manager.removeEventListener('controllerchange', onChange); reject(); }, 8000);
        manager.addEventListener('controllerchange', onChange);
        onChange();
      });
      return base + 'virtual/';
    } catch { return null; }
  })();
})();
