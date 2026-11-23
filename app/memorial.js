'use strict';
// Gedenken: one quiet brass marker per address with Stolpersteine. A click lists the people who lived
// there, with birth year and the year the stone was laid, and links each biography of the initiative.
// No hover glow, no photos of today, nothing playful. Shares the viewer's globals (view, $, DATA, s, x, y).
(() => {
  const stones = DATA.stones || [];
  if (!stones.length) return;
  const layer = document.getElementById('memorial-world'), panel = document.getElementById('building');
  let built = false;
  function build() {
    if (built) return; built = true;
    for (const place of stones) {
      const m = document.createElement('button');
      m.className = 'stone'; m.style.left = place.x + 'px'; m.style.top = place.y + 'px';
      m.setAttribute('aria-label', `Stolpersteine: ${place.address}, ${place.people.length} ${place.people.length === 1 ? 'Person' : 'Personen'}`);
      m.onclick = e => { e.stopPropagation(); show(place) };
      m.onpointerdown = e => e.stopPropagation();       // a marker click never pans the map or picks a building
      layer.append(m);
    }
  }
  const el = id => document.getElementById(id);
  function show(place) {
    if (window.pixelMapShowBuilding) window.pixelMapShowBuilding(null);
    el('building-figure').hidden = true;
    el('building-name').textContent = 'Hier wohnte' + (place.people.length > 1 ? 'n' : '');
    el('building-address').textContent = '📍 ' + place.address; el('building-address').hidden = false;
    el('building-kind').hidden = true; el('building-facts').hidden = true; el('building-more').hidden = true;
    const summary = el('building-summary'); summary.replaceChildren(); summary.classList.remove('clamped'); summary.hidden = false;
    const list = document.createElement('ul'); list.id = 'memorial-list';
    for (const p of place.people) {
      const li = document.createElement('li'), b = document.createElement('b');
      b.textContent = `${p.given} ${p.surname}`; li.append(b);
      li.append(document.createTextNode(`geboren ${p.born}` + (p.laid ? ` · Stein verlegt ${p.laid}` : '')));
      const a = document.createElement('a'); a.href = p.biography; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = 'Biografie bei „Stolpersteine für Lübeck“'; li.append(document.createElement('br'), a);
      list.append(li);
    }
    summary.append(list);
    const links = el('building-links'); links.replaceChildren(); links.hidden = true;
    const credit = el('building-credit'); credit.replaceChildren('Daten: ');
    const src = document.createElement('a'); src.href = DATA.stones_source; src.target = '_blank'; src.rel = 'noopener';
    src.textContent = 'Wikipedia-Liste der Stolpersteine in Lübeck'; credit.append(src, ' (CC BY-SA 4.0), nach Angaben der Initiative „Stolpersteine für Lübeck“.');
    credit.hidden = false;
    panel.dataset.box = [place.x - 4, place.y - 4, place.x + 4, place.y + 4].join(',');
    panel.hidden = false;
  }
  // the list in the sidebar: every address with its names, by street; a name search; a click goes there
  const mk = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e };
  const street = a => a.replace(/\s+\d.*$/, '');
  const search = mk('input', { type: 'search', className: 'mem-search', placeholder: 'Name oder Straße suchen …', ariaLabel: 'Stolpersteine nach Name oder Straße suchen' });
  const list = mk('div', { className: 'mem-list' });
  const count = stones.reduce((n, p) => n + p.people.length, 0);
  const box = mk('section', { className: 'side-sec sec-memorial', hidden: true },
    mk('h2', { textContent: 'Stolpersteine' }),
    mk('p', { className: 'mem-intro', textContent: `${count} Steine an ${stones.length} Adressen erinnern an Menschen, die hier wohnten und im Nationalsozialismus verfolgt, deportiert und ermordet wurden.` }),
    search, list,
    mk('p', { className: 'mem-credit', textContent: 'Daten: Wikipedia-Liste der Stolpersteine in Lübeck (CC BY-SA 4.0), nach Angaben der Initiative „Stolpersteine für Lübeck“.' }));
  function go(place) { build(); stop(); fitted = false; animate(hero({ x: place.x, y: place.y, view_width: 520 })); setTimeout(() => show(place), reduced.matches ? 0 : 650) }
  function fill() {
    const q = search.value.trim().toLowerCase();
    const groups = new Map();
    for (const place of stones) {
      const names = place.people.map(p => `${p.given} ${p.surname}`);
      if (q && !place.address.toLowerCase().includes(q) && !names.some(n => n.toLowerCase().includes(q))) continue;
      const k = street(place.address); if (!groups.has(k)) groups.set(k, []); groups.get(k).push([place, names]);
    }
    list.replaceChildren(...[...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'de')).map(([k, places]) =>
      mk('details', { open: !!q }, mk('summary', { textContent: `${k} ` }, mk('small', { textContent: String(places.reduce((n, [p]) => n + p.people.length, 0)) })),
        ...places.map(([place, names]) => mk('button', { onclick: () => go(place) }, mk('b', { textContent: place.address.replace(/,.*$/, '') }), mk('span', { textContent: names.join(', ') }))))));
    if (!groups.size) list.replaceChildren(mk('p', { textContent: 'Nichts gefunden.' }));
  }
  search.addEventListener('input', fill); fill();
  setTimeout(() => (document.querySelector('#pane-entdecken .sec-places') || document.getElementById('places')).before(box));   // after the sidebar is built
  window.pixelMapTheme = t => { box.hidden = t !== 'memorial'; if (t === 'memorial') build(); else panel.hidden = true };
})();
