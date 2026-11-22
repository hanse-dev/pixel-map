'use strict';
// Seitenleiste: theme, places, walks, view settings and sources in a tabbed panel on the left instead of
// menus over the map; building details open as a popup next to the building. It reuses the viewer's
// own controls (moved, not copied), so every handler and shortcut keeps working. On phones the panel
// is a drawer.
(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('seite') !== '1') return;           // trial: ?seite=1
  const $ = id => document.getElementById(id), body = document.body;
  const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids.filter(Boolean)); return e };
  const section = (cls, title, ...kids) => el('section', { className: `side-sec ${cls}` }, title ? el('h2', { textContent: title }) : null, ...kids);
  const narrow = matchMedia('(max-width: 760px)');
  const remember = { get() { try { return localStorage.getItem('pixel-map-side-tab') } catch { return null } }, set(v) { try { localStorage.setItem('pixel-map-side-tab', v) } catch {} } };

  const side = el('aside', { id: 'side', ariaLabel: 'Karte steuern' });
  const collapse = el('button', { id: 'side-collapse', className: 'side-icon', ariaLabel: 'Leiste einklappen', title: 'Leiste einklappen', textContent: '«' });
  const head = el('header', { className: 'side-head' },
    el('a', { href: '../', className: 'side-home', title: 'Startseite', textContent: '⌂' }),
    el('div', {}, el('b', { textContent: 'Pixel Map' }), el('span', { textContent: DATA.title || '' })), collapse);
  if ((DATA.navigation || []).length < 2) $('cities').hidden = true;   // one map: nothing to switch to

  // a running walk stays on top of every tab, also while a station's details are open
  const step = (label, id) => el('button', { textContent: label, onclick: () => $(id).click() });
  const walk = el('div', { className: 'side-walk' }, $('tour-bar'), el('div', { className: 'side-steps' }, step('‹ Zurück', 'previous'), step('Weiter ›', 'next')));

  // walks: each entry also says what it is about
  for (const [i, b] of [...$('tour-list').children].entries()) {
    const t = (DATA.tours || [])[i];
    if (t && t.intro) b.append(el('span', { className: 'tour-intro', textContent: t.intro }));
  }
  const links = el('div', { className: 'side-links' },
    el('a', { href: '../', textContent: '⌂ Startseite' }), el('a', { href: 'https://hanse-dev.github.io/pixel-map-game/', textContent: '🎲 Spiele' }));
  const tabs = [
    { id: 'entdecken', label: 'Entdecken', icon: '🧭', panes: [section('sec-theme', 'Thema', $('themes')),
      section('sec-places', 'Orte', el('div', { className: 'side-steps' }, step('‹ Voriger Ort', 'previous'), step('Nächster Ort ›', 'next')), $('cities'), $('place-list'))] },
    { id: 'rundgaenge', label: 'Rundgänge', icon: '🚶', panes: [section('sec-tours', null,
      el('p', { className: 'side-hint', textContent: 'Wähle einen Rundgang. Die Karte führt dich von Station zu Station.' }), $('tour-list'))] },
    { id: 'ansicht', label: 'Ansicht', icon: '🎨', panes: [section('sec-view', null, $('view-menu'))] },
    { id: 'info', label: 'Info', icon: 'ⓘ', panes: [section('sec-more', null,
      el('div', { className: 'side-row' },
        el('button', { textContent: '? Bedienung', onclick: () => $('help-toggle').click() }),
        el('button', { textContent: 'ⓘ Quellen', onclick: () => { $('info').hidden = !$('info').hidden } })),
      $('info'), links)] },
  ];
  const bar = el('div', { className: 'side-tabs', role: 'tablist', ariaLabel: 'Bereiche' });
  const panels = el('div', { className: 'side-panels' });
  for (const t of tabs) {
    t.button = el('button', { role: 'tab', id: `tab-${t.id}`, ariaSelected: 'false', onclick: () => select(t.id) }, el('span', { textContent: t.icon, ariaHidden: 'true' }), el('b', { textContent: t.label }));
    t.button.setAttribute('aria-controls', `pane-${t.id}`);
    t.pane = el('div', { role: 'tabpanel', id: `pane-${t.id}`, hidden: true }, ...t.panes);
    t.pane.setAttribute('aria-labelledby', `tab-${t.id}`);
    bar.append(t.button); panels.append(t.pane);
  }
  function select(id, focus = false) {
    const t = tabs.find(x => x.id === id && !x.button.hidden) || tabs[0];
    for (const x of tabs) { const on = x === t; x.button.setAttribute('aria-selected', String(on)); x.button.tabIndex = on ? 0 : -1; x.pane.hidden = !on }
    if (focus) t.button.focus();
    remember.set(t.id);
  }
  bar.addEventListener('keydown', e => {                       // arrow keys move between tabs
    const visible = tabs.filter(t => !t.button.hidden), i = visible.findIndex(t => t.button.getAttribute('aria-selected') === 'true');
    const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (k) { e.preventDefault(); select(visible[(i + k + visible.length) % visible.length].id, true) }
  });
  // Gedenken shows no walks
  const walksTab = tabs[1];
  new MutationObserver(() => {
    walksTab.button.hidden = body.classList.contains('memorial');
    if (walksTab.button.hidden && walksTab.button.getAttribute('aria-selected') === 'true') select('entdecken');
  }).observe(body, { attributes: true, attributeFilter: ['class'] });

  side.append(head, walk, bar, panels);
  body.append(side);
  select(remember.get() || 'entdecken');
  $('tours-title').remove();
  for (const id of ['themes', 'view-menu', 'places']) $(id).removeAttribute('role');

  const open = el('button', { id: 'side-open', ariaLabel: 'Leiste öffnen', title: 'Leiste öffnen', textContent: '☰  Menü' });
  body.append(open);
  body.classList.add('side');

  const layout = () => { dispatchEvent(new Event('resize')); if (typeof setReveal === 'function') setReveal(reveal) };
  function show(on) { body.classList.toggle('side-closed', !on); open.setAttribute('aria-expanded', String(on)); setTimeout(layout, 220) }
  collapse.onclick = () => show(false);
  open.onclick = () => show(true);
  show(!narrow.matches);
  narrow.addEventListener('change', e => show(!e.matches));

  // building details: a popup next to the building that follows the map; a bottom sheet on phones
  const panel = $('building');
  panel.classList.add('popup');
  let raf = 0;
  function place() {
    raf = 0;
    if (panel.hidden) return;
    if (narrow.matches || !panel.dataset.box) { panel.classList.add('sheet'); panel.style.left = panel.style.top = ''; return }
    panel.classList.remove('sheet');
    const [x0, y0, x1, y1] = panel.dataset.box.split(',').map(Number), r = view.getBoundingClientRect();
    const L = r.left + x + x0 * s, R = r.left + x + x1 * s, T = r.top + y + y0 * s, B = r.top + y + y1 * s;
    const w = panel.offsetWidth, h = panel.offsetHeight, gap = 18, min = r.left + 12, max = innerWidth - w - 12;
    let left = R + gap, side = 'right';
    if (left > max) { left = L - gap - w; side = 'left' }
    if (left < min) { left = Math.min(max, Math.max(min, R + gap)); side = 'none'; makeRoom(w + gap) }
    const mid = Math.min(Math.max((T + B) / 2, r.top + 30), innerHeight - 30);
    const top = Math.min(Math.max(mid - h * .35, 12), innerHeight - h - 12);
    panel.style.left = left + 'px'; panel.style.top = top + 'px';
    panel.dataset.arrow = side; panel.style.setProperty('--arrow-y', Math.min(Math.max(mid - top, 18), h - 18) + 'px');
    raf = requestAnimationFrame(place);                 // follow panning, zooming and flights
  }
  // no room beside the building: slide the map once (after any flight) so building and popup sit side by side
  let roomFor = '';
  function makeRoom(need) {
    if (roomFor === panel.dataset.box) return;
    roomFor = panel.dataset.box;
    setTimeout(() => {
      if (panel.hidden || roomFor !== panel.dataset.box) return;
      const [x0, , x1] = panel.dataset.box.split(',').map(Number), r = view.getBoundingClientRect();
      const L = r.left + x + x0 * s, R = r.left + x + x1 * s;
      let dx = (r.right - need - 12) - R;                       // building's right edge just left of the popup
      dx = Math.max(dx, r.left + 12 - L);                       // but never push its left edge out of view
      if (Math.abs(dx) < 4) return;
      const from = x, t0 = performance.now();
      const step = now => { const k = Math.min(1, (now - t0) / 350); x = from + dx * k * k * (3 - 2 * k); draw(); if (k < 1) requestAnimationFrame(step) };
      requestAnimationFrame(step);
    }, 750);
  }
  new MutationObserver(() => { if (!panel.hidden && !raf) raf = requestAnimationFrame(place) })
    .observe(panel, { attributes: true, attributeFilter: ['hidden', 'data-box'] });

  // a running walk when the drawer is closed (phones): a small bar on the map
  const float = el('div', { id: 'walk-float', hidden: true },
    el('span', { id: 'walk-float-step' }), step('‹', 'previous'), step('›', 'next'), step('✕', 'tour-end'));
  body.append(float);
  const syncWalk = () => { float.hidden = $('tour-bar').hidden || !body.classList.contains('side-closed'); $('walk-float-step').textContent = $('tour-step').textContent };
  new MutationObserver(syncWalk).observe($('tour-bar'), { attributes: true, subtree: true, childList: true, characterData: true });
  new MutationObserver(syncWalk).observe(body, { attributes: true, attributeFilter: ['class'] });
  // on a phone the drawer gets out of the way when a list entry moves the map
  for (const id of ['place-list', 'tour-list']) $(id).addEventListener('click', () => { if (narrow.matches) show(false) });
  layout();
})();
