/* Compatibility entry point only; keep incoming query and section unchanged. */
(() => {
  'use strict';
  const target = new URL('../function-chains/', location.href);
  target.search = location.search;
  target.hash = location.hash;
  const link = document.getElementById('chains-new-link');
  if (link) link.href = target.href;
  location.replace(target.href);
})();
