'use strict';
// Seitenleiste: theme, walks, places, view settings, building details and sources in one panel on the
// left instead of menus over the map. It reuses the viewer's own controls (moved, not copied), so every
// handler and shortcut keeps working. On narrow screens the panel is a drawer.
(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('seite') !== '1') return;           // trial: ?seite=1
  const $ = id => document.getElementById(id), body = document.body;
  const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids.filter(Boolean)); return e };
  const section = (cls, title, ...kids) => el('section', { className: `side-sec ${cls}` }, el('h2', { textContent: title }), ...kids);
  const narrow = matchMedia('(max-width: 760px)');

  const side = el('aside', { id: 'side', ariaLabel: 'Karte steuern' });
  const collapse = el('button', { id: 'side-collapse', className: 'side-icon', ariaLabel: 'Leiste einklappen', title: 'Leiste einklappen', textContent: '«' });
  const head = el('header', { className: 'side-head' },
    el('a', { href: '../', className: 'side-home', title: 'Startseite', textContent: '⌂' }),
    el('div', {}, el('b', { textContent: 'Pixel Map' }), el('span', { textContent: DATA.title || '' })), collapse);

  // building details replace the lists while open
  const back = $('building-close'); back.textContent = '← Zurück'; back.classList.add('side-back');
  const detail = el('div', { className: 'side-detail' }, $('building'));

  if ((DATA.navigation || []).length < 2) $('cities').hidden = true;   // one map: nothing to switch to

  // a running walk stays on top, also while a station's details are open
  const step = (label, id) => el('button', { textContent: label, onclick: () => $(id).click() });
  const walk = el('div', { className: 'side-walk' }, $('tour-bar'), el('div', { className: 'side-steps' }, step('‹ Zurück', 'previous'), step('Weiter ›', 'next')));
  const tours = section('sec-tours', 'Rundgänge', $('tour-list'));
  const places = section('sec-places', 'Orte', el('div', { className: 'side-steps' }, step('‹ Voriger Ort', 'previous'), step('Nächster Ort ›', 'next')), $('cities'), $('place-list'));
  const view = section('sec-view', 'Ansicht', $('view-menu'));
  const more = section('sec-more', 'Hilfe und Quellen',
    el('div', { className: 'side-row' },
      el('button', { textContent: '? Bedienung', onclick: () => $('help-toggle').click() }),
      el('button', { textContent: 'ⓘ Quellen', onclick: () => { $('info').hidden = !$('info').hidden } })),
    $('info'));
  const lists = el('div', { className: 'side-lists' }, section('sec-theme', 'Thema', $('themes')), tours, places, view, more);
  side.append(head, walk, detail, lists);
  body.append(side);
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

  // a selected building opens the panel on its details; closing returns to the lists
  new MutationObserver(() => {
    const shown = !$('building').hidden;
    side.classList.toggle('detail', shown);
    if (shown) { side.scrollTop = 0; if (body.classList.contains('side-closed')) show(true) }
  }).observe($('building'), { attributes: true, attributeFilter: ['hidden'] });
  // on a phone the drawer gets out of the way when a list entry moves the map
  for (const id of ['place-list', 'tour-list']) $(id).addEventListener('click', () => { if (narrow.matches && $('building').hidden) show(false) });
  layout();
})();
