'use strict';
// Thema „Geschichte“: a timeline (events of the city's history and the buildings standing by a chosen
// year) in the sidebar, and old pictures of a building in its popup. Shares the viewer's globals
// (DATA, theme, flyToBuilding). Events: Wikipedia; years: Wikidata; pictures: Wikimedia Commons.
(() => {
  const T = DATA.timeline, past = DATA.historic || {};
  if (!T) return;
  const $ = id => document.getElementById(id), body = document.body;
  const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids.filter(Boolean)); return e };
  const years = T.events.map(e => e.year).concat(T.built.map(b => b.year)), lo = 1143, hi = new Date().getFullYear();

  // ---------- timeline in the sidebar ----------
  const slider = el('input', { type: 'range', min: lo, max: hi, value: 1370, step: 1, className: 'tl-range', ariaLabel: 'Jahr wählen' });
  const year = el('output', { className: 'tl-year' });
  const events = el('ol', { className: 'tl-events' }), standing = el('div', { className: 'tl-built' });
  const jumps = el('div', { className: 'tl-jumps' }, ...[[1143, 'Gründung'], [1370, 'Hansezeit'], [1669, 'Letzter Hansetag'], [1900, 'um 1900'], [1942, 'Luftangriff'], [1987, 'Welterbe']]
    .map(([y, t]) => el('button', { textContent: t, onclick: () => set(y) })));
  const box = el('section', { className: 'side-sec sec-history', hidden: true },
    el('h2', { textContent: 'Zeitleiste' }), el('div', { className: 'tl-head' }, year, slider), jumps, events,
    el('h3', { className: 'tl-sub', textContent: 'Damals schon gebaut' }), standing,
    el('p', { className: 'tl-credit', textContent: T.credit }));
  function set(y) {
    slider.value = y; y = Number(y); year.value = y;
    const near = T.events.filter(e => e.year <= y).slice(-3);
    events.replaceChildren(...near.map(e => el('li', { className: e === near[near.length - 1] ? 'now' : '' },
      el('b', { textContent: e.until ? `${e.year}–${e.until}` : String(e.year) }), ' ', e.text, ' ', el('a', { href: e.source, target: '_blank', rel: 'noopener', textContent: 'Quelle' }))));
    if (!near.length) events.replaceChildren(el('li', { textContent: 'Vor der Gründung der Stadt.' }));
    const b = T.built.filter(x => x.year <= y);
    standing.replaceChildren(...(b.length ? b.map(x => el('button', { textContent: `${x.name} · ${x.label}`, onclick: () => flyToBuilding(x) }))
      : [el('p', { textContent: 'Von den Gebäuden mit bekanntem Baujahr stand noch keins.' })]));
  }
  slider.addEventListener('input', () => set(slider.value));
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
