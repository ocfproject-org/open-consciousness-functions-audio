/* One-action preferences. Native modal focus/inertness; preserve document navigation history. */
(() => {
  'use strict';
  const dialog = document.getElementById('preferences');
  if (!dialog?.showModal) return;
  const triggers = [...document.querySelectorAll('[data-preferences-open]')];
  let opener = triggers[0];
  const show = () => { if (!dialog.open) dialog.showModal(); };
  const dismiss = () => {
    if (!dialog.open) return;
    dialog.close();
    if (opener?.isConnected && !opener.hidden) opener.focus();
  };
  const close = dismiss;
  window.ocfPreferences = {open: trigger => { opener = trigger || triggers[0]; document.querySelector('.mobile-nav')?.removeAttribute('open'); show(); }};
  triggers.forEach(button => {
    button.hidden = false;
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', 'preferences');
    button.addEventListener('click', () => {
      opener = button;
      document.querySelector('.mobile-nav')?.removeAttribute('open');
      if (dialog.open) return;
      show();
    });
  });
  dialog.querySelector('[data-preferences-close]').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  window.addEventListener('popstate', dismiss);
  window.addEventListener('pageshow', dismiss);
  window.addEventListener('pagehide', () => { if (dialog.open) dialog.close(); });
})();
