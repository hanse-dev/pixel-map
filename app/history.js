'use strict';
// Thema „Geschichte“: a timeline (events of the city's history and the buildings standing by a chosen
// year) in the sidebar, and old pictures of a building in its popup. Shares the viewer's globals
// (DATA, theme, flyToBuilding). Events: Wikipedia; years: Wikidata; pictures: Wikimedia Commons.
(() => {
  const T = DATA.timeline, past = DATA.historic || {};
  if (!T) return;
  const $ = id => document.getElementById(id), body = document.body;
  const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids.filter(Boolean)); return e };
  // the slider stops only at years with an event or a building date
  const years = [...new Set(T.events.map(e => e.year).concat(T.built.map(b => b.year)))].sort((a, b) => a - b);
  const at = y => years.reduce((best, v, i) => Math.abs(v - y) < Math.abs(years[best] - y) ? i : best, 0);

  // ---------- timeline in the sidebar ----------
  const slider = el('input', { type: 'range', min: 0, max: years.length - 1, value: at(1370), step: 1, className: 'tl-range', ariaLabel: 'Jahr wählen' });
  const ticks = el('div', { className: 'tl-ticks', ariaHidden: 'true' }, ...years.map(() => el('i')));
  const year = el('output', { className: 'tl-year' });
  const events = el('ol', { className: 'tl-events' }), standing = el('div', { className: 'tl-built' });
  const jumps = el('div', { className: 'tl-jumps' }, ...[[1143, 'Gründung'], [1370, 'Hansezeit'], [1669, 'Letzter Hansetag'], [1900, 'um 1900'], [1942, 'Luftangriff'], [1987, 'Welterbe']]
    .map(([y, t]) => el('button', { textContent: t, onclick: () => set(y) })));
  const box = el('section', { className: 'side-sec sec-history', hidden: true },
    el('h2', { textContent: 'Zeitleiste' }), el('div', { className: 'tl-head' }, year, el('div', { className: 'tl-track' }, slider, ticks)), jumps, events,
    el('h3', { className: 'tl-sub', textContent: 'Damals schon gebaut' }), standing,
    el('p', { className: 'tl-credit', textContent: T.credit }));
  function set(y) {
    y = years[at(Number(y))]; slider.value = years.indexOf(y); year.value = y;
    slider.setAttribute('aria-valuetext', String(y));
    // city events and buildings in one list: the latest three up to the chosen year
    const items = T.events.map(e => ({ year: e.year, label: e.until ? `${e.year}–${e.until}` : String(e.year), text: e.text, source: e.source }))
      .concat(T.built.filter(b => b.text).map(b => ({ year: b.year, label: b.label, title: b.name, text: b.text, source: b.source, go: b })))
      .sort((a, b) => a.year - b.year);
    const near = items.filter(e => e.year <= y).slice(-3);
    events.replaceChildren(...near.map(e => el('li', { className: (e === near[near.length - 1] ? 'now' : '') + (e.go ? ' built' : '') },
      el('b', { textContent: e.label }), ' ',
      e.go ? el('button', { className: 'tl-link', textContent: e.title, onclick: () => flyToBuilding(e.go) }) : null, e.go ? ': ' : '',
      e.text, ' ', el('a', { href: e.source, target: '_blank', rel: 'noopener', textContent: 'Quelle' }))));
    if (!near.length) events.replaceChildren(el('li', { textContent: 'Vor der Gründung der Stadt.' }));
    const b = T.built.filter(x => x.year <= y);
    standing.replaceChildren(...(b.length ? b.map(x => el('button', { textContent: `${x.name} · ${x.label}`, onclick: () => flyToBuilding(x) }))
      : [el('p', { textContent: 'Von den Gebäuden mit bekanntem Baujahr stand noch keins.' })]));
  }
  slider.addEventListener('input', () => set(years[slider.value]));
  set(1370);
  const anchor = document.querySelector('#pane-entdecken .sec-places') || $('places');
  anchor.before(box);

  // ---------- old pictures in the popup ----------
  const gallery = $('building-past');
  function show(q) {
    const list = past[q];
    gallery.replaceChildren(); gallery.hidden = !(list && body.classList.contains('history'));
    if (gallery.hidden) return;
    gallery.append(el('h3', { textContent: 'Früher' }),
      el('div', { className: 'past-strip' }, ...list.map(p => el('figure', {},
        el('a', { href: p.page, target: '_blank', rel: 'noopener' }, el('img', { src: p.thumb, alt: `${p.caption || 'Historische Ansicht'} (${p.year})`, loading: 'lazy' })),
        el('figcaption', {}, el('b', { textContent: String(p.year) }), ` · ${p.author.replace(/\s*\(.*$/, '')} · ${p.licence}`)))));
  }
  new MutationObserver(() => {                    // the popup was filled: which building is it?
    if ($('building').hidden) return;
    const link = [...$('building-links').querySelectorAll('a')].find(a => a.href.includes('wikidata.org/wiki/Q'));
    show(link ? link.href.split('/').pop() : null);
  }).observe($('building-name'), { childList: true, characterData: true, subtree: true });

  // ---------- the theme ----------
  const before = window.pixelMapTheme;
  window.pixelMapTheme = t => {
    if (before) before(t);
    const on = t === 'history';
    body.classList.toggle('history', on); box.hidden = !on;
    if (on) { const tab = $('tab-entdecken'); if (tab) tab.click() }
  };
})();
