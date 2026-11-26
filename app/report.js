'use strict';
// Fehler melden: tap the spot that looks wrong, say what is wrong, and the report opens as a prefilled
// GitHub issue (no data leaves the page before the reporter presses send there). The report carries the
// nearest address and street, the building, the map point and a link (#stelle=x,y) that opens the map
// right there with a pin. Shares the viewer's globals (DATA, view, x, y, s, W, H, $).
(() => {
  const btn = $('report'), cfg = DATA.report || {};
  if (!btn || !(cfg.github || cfg.worker)) return;
  const dialog = $('report-dialog'), banner = $('report-banner'), world = $('report-world');
  let picking = false, down = null, spot = null;

  // ---------- picking a spot ----------
  function pick(on) {
    picking = on; banner.hidden = !on; document.body.classList.toggle('reporting', on);
    if (typeof closeMenus === 'function') closeMenus();
  }
  btn.onclick = () => pick(true);
  $('report-cancel-pick').onclick = () => pick(false);
  addEventListener('keydown', e => { if (picking && e.key === 'Escape') pick(false) });
  view.addEventListener('pointerdown', e => { if (picking) down = [e.clientX, e.clientY] }, true);
  view.addEventListener('pointerup', e => {
    if (!picking || !down) return;
    if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;   // that was a pan
    e.stopImmediatePropagation();                                             // no building panel underneath
    const r = view.getBoundingClientRect();
    pick(false); open((e.clientX - r.left - x) / s, (e.clientY - r.top - y) / s);
  }, true);

  // ---------- where is that? ----------
  async function describe(mx, my) {
    const here = { x: Math.round(mx), y: Math.round(my) };
    try { const b = window.pixelMapBuildingAt && await pixelMapBuildingAt(mx, my); if (b) here.building = b } catch {}
    try { here.street = window.pixelMapStreetAt && await pixelMapStreetAt(mx, my) } catch {}
    if (here.building && here.building.address) here.address = here.building.address;
    else if (window.pixelMapBuildings) {                                      // nearest address within about 60 m
      let d0 = 150;
      for (const b of pixelMapBuildings()) if (b.address && b.centre) { const d = Math.hypot(b.centre[0] - mx, b.centre[1] - my); if (d < d0) { d0 = d; here.address = b.address } }
      if (here.address) here.near = true;
    }
    return here;
  }
  const place = h => [h.address ? (h.near ? 'nahe ' : '') + h.address.replace(/, \d{5} .*$/, '') : null, h.street && !(h.address || '').startsWith(h.street) ? h.street : null].filter(Boolean).join(' · ') || `Kartenpunkt ${h.x}, ${h.y}`;
  const linkTo = h => location.href.split('#')[0] + `#stelle=${h.x},${h.y}`;

  async function open(mx, my, building) {
    spot = await describe(mx, my);
    if (building) spot.building = building;
    mark(spot);
    $('report-where').textContent = place(spot) + (spot.building && spot.building.name ? ` · ${spot.building.name}` : '');
    $('report-text').value = ''; status('');
    $('report-form').hidden = false; $('report-done').hidden = true;
    dialog.showModal(); $('report-text').focus();
    if (cfg.worker) human();
  }
  window.pixelMapReport = b => b && b.centre && open(b.centre[0], b.centre[1], b);

  // ---------- sending ----------
  // with a worker (DATA.report.worker): straight to it, guarded by Cloudflare Turnstile, no account needed;
  // without one: a prefilled GitHub issue in a new tab
  const status = t => { $('report-status').textContent = t; $('report-status').hidden = !t };
  let widget = null;
  function human() {
    if (!cfg.turnstile) return;
    const render = () => { if (widget === null) widget = turnstile.render('#report-human', { sitekey: cfg.turnstile, language: 'de', size: 'flexible' }); else turnstile.reset(widget) };
    if (window.turnstile) return render();
    const tag = document.createElement('script'); tag.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; tag.async = true; tag.onload = render;
    document.head.append(tag);
  }
  const version = () => ((DATA.tiles_base || '').match(/([0-9a-f]{12}-[0-9a-f]{6})\/?$/) || [])[1] || '';
  function tileImage(h) {                                          // the art tile one level up, about 512 map px around the spot
    const spec = DATA.viewer_tiles || {}, L = (spec.max_level || 14) - 1, T = (spec.tile_size || 256) * 2;
    return DATA.tiles_base ? `${DATA.tiles_base}${DATA.art_dir || 'map_files'}/${L}/${Math.floor(h.x / T)}_${Math.floor(h.y / T)}.${spec.format || 'webp'}` : '';
  }
  $('report-form').onsubmit = async e => {
    e.preventDefault();
    const kind = $('report-kind').value, text = $('report-text').value.trim(), h = spot;
    const where = place(h) + (h.building && h.building.name ? ` · ${h.building.name}` : '');
    if (cfg.worker) {
      const send = $('report-send'); send.disabled = true; status('Wird gesendet …');
      try {
        const token = window.turnstile && widget !== null ? turnstile.getResponse(widget) : '';
        const q = await fetch(cfg.worker, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          kind, text, where, x: h.x, y: h.y, osm: h.building ? h.building.osm : '', link: linkTo(h), image: tileImage(h), version: version(), token }) });
        const r = await q.json().catch(() => ({}));
        if (!q.ok || !r.ok) throw new Error(r.error || 'Senden fehlgeschlagen.');
        $('report-form').hidden = true; $('report-done').hidden = false;
        $('report-done-text').textContent = r.merged ? `Danke! Diese Stelle war schon gemeldet, deine Beschreibung ist dazugekommen (Meldung #${r.number}).` : `Danke! Deine Meldung #${r.number} ist angekommen.`;
        $('report-done-ok').focus();
        if (window.pixelMapCount) pixelMapCount('fehler-gemeldet', 'Fehler gemeldet');
      } catch (err) { status(err.message || 'Senden fehlgeschlagen.'); if (window.turnstile && widget !== null) turnstile.reset(widget) }
      send.disabled = false;
      return;
    }
    const title = `${kind}: ${place(h)}`.slice(0, 120);
    const body = [`**Was:** ${kind}`, `**Wo:** ${where}`, h.building ? `**Gebäude:** ${h.building.osm}` : null,
      `**Kartenpunkt:** ${h.x}, ${h.y} (Karte ${version()})`, `**Auf der Karte:** ${linkTo(h)}`, '', text || '(ohne Beschreibung)'].filter(v => v !== null).join('\n');
    window.open(`https://github.com/${cfg.github}/issues/new?` + new URLSearchParams({ title, body, ...(cfg.label ? { labels: cfg.label } : {}) }), '_blank', 'noopener');
    if (window.pixelMapCount) pixelMapCount('fehler-gemeldet', 'Fehler gemeldet');
    dialog.close();
  };
  $('report-done-ok').onclick = () => dialog.close();
  if (cfg.worker) $('report-hint').textContent = 'Die Meldung geht ohne Anmeldung an das Kartenteam. Gespeichert werden nur die Angaben oben und die Stelle.';
  $('report-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => mark(null));

  // ---------- the pin, and links that open the map at a reported spot ----------
  function mark(h) {
    world.replaceChildren();
    if (!h) return;
    const pin = document.createElement('div'); pin.className = 'report-pin';
    pin.style.left = h.x + 'px'; pin.style.top = h.y + 'px'; world.append(pin);
  }
  function fromHash() {
    const m = /#stelle=(\d+),(\d+)/.exec(location.hash); if (!m) return;
    const h = { x: +m[1], y: +m[2] }; if (h.x > W || h.y > H) return;
    if (typeof animate === 'function') animate(hero({ x: h.x, y: h.y, view_width: 520 }));
    mark(h);
  }
  addEventListener('hashchange', fromHash);
  setTimeout(fromHash, 700);                                                  // after the viewer has placed its opening view
})();
