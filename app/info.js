'use strict';
// Click a building: read its id from the hit-map tile under the pointer, then show its name and,
// where the bundle links a Wikidata item, the cached Wikipedia summary with attribution.
// Shares the viewer's globals (view, s, x, y, W, H, DATA) from the main script.
(() => {
  if (!DATA.hitmap_tiles || !DATA.buildings_url) return;
  const panel = document.getElementById('building'), byId = new Map(), tiles = new Map();
  let info = {}, ready = false, down = null;
  Promise.all([fetch(DATA.buildings_url).then(r => r.json()), DATA.info_url ? fetch(DATA.info_url).then(r => r.ok ? r.json() : {items: {}}).catch(() => ({items: {}})) : {items: {}}])
    .then(([b, i]) => { for (const r of b.buildings) byId.set(r.id, r); info = i.items || {}; ready = true; })
    .catch(error => console.error('Building data unavailable:', error));

  const spec = DATA.hitmap_tiles, level = spec.max_level, size = spec.tile_size, pad = spec.overlap;
  function tile(col, row) {
    const key = `${col}_${row}`;
    if (!tiles.has(key)) tiles.set(key, new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => { const c = document.createElement('canvas'); c.width = image.naturalWidth; c.height = image.naturalHeight;
        const g = c.getContext('2d', {willReadFrequently: true}); g.imageSmoothingEnabled = false; g.drawImage(image, 0, 0); resolve(g); };
      image.onerror = reject;
      image.src = `hitmap_files/${level}/${key}.png`;
    }));
    return tiles.get(key);
  }
  async function idAt(mx, my) {
    if (mx < 0 || my < 0 || mx >= W || my >= H) return 0;
    const col = Math.floor(mx / size), row = Math.floor(my / size);
    const g = await tile(col, row), left = Math.max(0, col * size - pad), top = Math.max(0, row * size - pad);
    const [r, gg, b] = g.getImageData(Math.floor(mx) - left, Math.floor(my) - top, 1, 1).data;
    return r + 256 * gg + 65536 * b;
  }
  const KIND = {church: 'Kirche', cathedral: 'Kathedrale', chapel: 'Kapelle', civic: 'Öffentliches Gebäude', government: 'Verwaltung',
    public: 'Öffentliches Gebäude', school: 'Schule', university: 'Universität', museum: 'Museum', house: 'Wohnhaus', apartments: 'Wohnhaus',
    residential: 'Wohnhaus', dwelling_house: 'Wohnhaus', commercial: 'Geschäftshaus', retail: 'Geschäft', office: 'Bürogebäude', hotel: 'Hotel',
    warehouse: 'Speicher', industrial: 'Gewerbe', parking: 'Parkhaus', synagogue: 'Synagoge', temple: 'Tempel', castle: 'Burg', city_gate: 'Stadttor',
    monastery: 'Kloster', bunker: 'Bunker', ship: 'Schiff', theatre: 'Theater', hospital: 'Hospital', building: null, yes: null};
  const kindName = k => k in KIND ? KIND[k] : k;
  const el = id => document.getElementById(id);
  function text(id, value) { el(id).textContent = value || ''; el(id).hidden = !value; }
  function show(b) {
    const i = b.wikidata ? info[b.wikidata] : null;
    text('building-name', (i && (i.title || i.label)) || b.name || 'Gebäude');
    text('building-kind', [b.historic === 'city_gate' ? 'Stadttor' : kindName(b.kind), b.start_date ? `erbaut ${b.start_date}` : null].filter(Boolean).join(' · '));
    text('building-summary', i && i.summary);
    const links = el('building-links'); links.replaceChildren();
    if (i && i.url) { const a = document.createElement('a'); a.href = i.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Wikipedia'; links.append(a, ' ') }
    if (b.wikidata) { const a = document.createElement('a'); a.href = `https://www.wikidata.org/wiki/${b.wikidata}`; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Wikidata'; links.append(a, ' ') }
    const o = document.createElement('a'); o.href = `https://www.openstreetmap.org/${b.osm}`; o.target = '_blank'; o.rel = 'noopener'; o.textContent = 'OpenStreetMap'; links.append(o);
    links.hidden = false;
    text('building-credit', i && i.summary ? `Text: ${i.attribution}` : '');
    panel.hidden = false;
  }
  el('building-close').onclick = () => { panel.hidden = true };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') panel.hidden = true });
  // a click is a press and release that barely moved, so panning never opens the panel
  view.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY] });
  view.addEventListener('pointerup', async e => {
    if (!down || !ready || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const r = view.getBoundingClientRect(), mx = (e.clientX - r.left - x) / s, my = (e.clientY - r.top - y) / s;
    try {
      const id = await idAt(mx, my), b = byId.get(id);
      if (b) show(b); else panel.hidden = true;
    } catch (error) { console.error('Hit map tile unavailable:', error) }
  });
})();
