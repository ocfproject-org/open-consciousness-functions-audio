/* Directory-only enhancement: original chain text and deep links stay available. */
(() => {
  'use strict';
  const root = document.querySelector('.chain-directory');
  if (!root) return;
  const goal = root.querySelector('#chain-goal');
  const search = root.querySelector('#chain-search');
  const cards = [...root.querySelectorAll('[data-chain-card]')];
  const normalize = value => value.normalize('NFKC').toLowerCase().replace(/[‐‑‒–—-]/g, ' ').replace(/\s+/g, ' ').trim();
  const render = () => {
    const query = normalize(search.value);
    let count = 0;
    cards.forEach(card => {
      card.hidden = Boolean(goal.value && card.dataset.chainGoal !== goal.value) || !normalize(card.dataset.chainSearch).includes(query);
      if (!card.hidden) count++;
    });
    root.querySelectorAll('[data-chain-group]').forEach(group => { group.hidden = !group.querySelector('[data-chain-card]:not([hidden])'); });
    root.querySelector('#chain-count').textContent = `${count} of ${cards.length} chains${count ? '' : ' — No matching chains. Clear the filters to explore all chains.'}`;
  };
  goal.addEventListener('change', render);
  search.addEventListener('input', render);
  root.querySelector('#chain-clear').addEventListener('click', () => { goal.value = ''; search.value = ''; render(); search.focus(); });
  root.querySelector('.chain-directory-tools').hidden = false;
  window.addEventListener('pageshow', render);
  render();
})();
