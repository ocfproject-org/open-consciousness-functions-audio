"use strict";
for (const directory of document.querySelectorAll("[data-learn-directory]")) {
  const controls = directory.querySelector("[data-learn-controls]");
  const query = controls.querySelector("[data-learn-query]");
  const category = controls.querySelector("[data-learn-category]");
  const type = controls.querySelector("[data-learn-type]");
  const count = directory.querySelector("[data-learn-status]");
  const empty = directory.querySelector("[data-learn-empty]");
  const normalize = value => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  const rows = Array.from(directory.querySelectorAll(".learn-row"), node => ({
    node, text: normalize(node.dataset.search + " " + node.textContent)
  }));
  function render() {
    const words = normalize(query.value).trim().split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const { node, text } of rows) {
      node.hidden = !((!category.value || category.value === node.dataset.category)
        && (!type.value || type.value === node.dataset.type)
        && words.every(word => text.includes(word)));
      if (!node.hidden) visible++;
    }
    count.textContent = visible + (visible === 1 ? " entry" : " entries");
    empty.hidden = visible !== 0;
  }
  function reveal() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const element = document.getElementById(id);
    const node = element?.closest(".learn-row");
    if (!node || !directory.contains(node)) return;
    if (node.hidden) {
      query.value = "";
      category.value = "";
      type.value = "";
      render();
    }
    node.querySelector("[data-learn-entry]").open = true;
    requestAnimationFrame(() => node.scrollIntoView({ block: "start" }));
  }
  controls.addEventListener("submit", event => { event.preventDefault(); render(); });
  controls.addEventListener("input", render);
  controls.addEventListener("change", render);
  controls.addEventListener("reset", () => requestAnimationFrame(render));
  directory.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (link && link.hash && link.pathname === location.pathname && link.hash === location.hash) reveal();
  });
  window.addEventListener("hashchange", reveal);
  controls.hidden = false;
  render();
  reveal();
}
