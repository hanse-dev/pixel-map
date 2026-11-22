'use strict';
// Rundgänge: the walk as a line along the streets with numbered stations, an overview before the start,
// progress kept in the browser, and a closing card with the next suggestion. Shares the viewer's
// globals (DATA, W, H, route, current, tourActive, startTour, endTour, visit, animate, hero).
(() => {
  const tours = DATA.tours || [];
  if (!tours.length) return;
  const $ = id => document.getElementById(id), NS = 'http://www.w3.org/2000/svg', layer = $('route-world');
  const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids.filter(Boolean)); return e };
  const km = m => (m / 1000).toFixed(1).replace('.', ',');
  const progress = {
    all() { try { return JSON.parse(localStorage.getItem('pixel-map-walks') || '{}') } catch { return {} } },
    get(id) { return this.all()[id] },
    set(id, v) { const a = this.all(); if (v == null) delete a[id]; else a[id] = v; try { localStorage.setItem('pixel-map-walks', JSON.stringify(a)) } catch {} },
  };

  // ---------- the line on the map ----------
  let shown = null, shownStep = null;
  function render(t, step) {                         // step: current station, or -1 for a preview
    layer.replaceChildren(); shown = t; shownStep = step;
    if (!t) return;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.classList.add('route');
    t.stations.forEach((st, k) => {
      if (!st.leg) return;
      const state = step < 0 ? 'next' : k === step ? 'now' : k < step ? 'done' : 'next';
      for (const [visible, pts] of st.leg.path) {          // stretches behind buildings are drawn faintly
        const p = document.createElementNS(NS, 'polyline');
        p.setAttribute('points', pts.map(q => q.join(',')).join(' '));
        p.setAttribute('class', state + (visible ? '' : ' hidden'));
        svg.append(p);
      }
    });
    layer.append(svg);
    t.stations.forEach((st, k) => layer.append(el('div', { className: 'stop' + (k === step ? ' now' : step >= 0 && k < step ? ' done' : ''), textContent: k + 1, style: `left:${st.x}px;top:${st.y}px` })));
  }
  (function watch() {                                // follow the running walk
    if (tourActive) {
      if (shown !== tourActive || shownStep !== current) { render(tourActive, current); progress.set(tourActive.id, current) }
    } else if (shown && shownStep !== -1) render(null);
    requestAnimationFrame(watch);
  })();

  // ---------- overview before the start ----------
  const list = $('tour-list');
  let open = null;
  function showRoute(t) {
    const pts = st => st.leg ? st.leg.path.flatMap(r => r[1]) : [];
    const xs = t.stations.flatMap(s => [s.x, ...pts(s).map(p => p[0])]), ys = t.stations.flatMap(s => [s.y, ...pts(s).map(p => p[1])]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    render(t, -1);
    const zoom = Math.min(1, vw / ((x1 - x0) * 1.25 + 80), vh / ((y1 - y0) * 1.25 + 80));   // the whole walk in view
    animate(hero({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, zoom }));
  }
  function begin(t, at = 0) {
    if (open) open.remove(); open = null;
    startTour(t);
    if (at > 0) setTimeout(() => visit(at), 50);
  }
  function overview(t, button) {
    const again = open && open.previousSibling === button;
    if (open) open.remove(); open = null;
    if (again) { if (!tourActive) render(null); return }
    const at = progress.get(t.id);
    const steps = el('ol', { className: 'tour-steps' }, ...t.stations.map((s, k) =>
      el('li', {}, el('b', { textContent: s.name }), s.leg ? el('small', { textContent: ` · ${s.leg.minutes} Min. zu Fuß` }) : el('small', { textContent: ' · Start' }))));
    const buttons = el('div', { className: 'tour-go' },
      at > 0 && at < t.stations.length - 1 ? el('button', { className: 'primary', textContent: `▶ Weiter bei Station ${at + 1}`, onclick: () => begin(t, at) }) : null,
      el('button', { className: at > 0 && at < t.stations.length - 1 ? '' : 'primary', textContent: at > 0 && at < t.stations.length - 1 ? 'Von vorn' : '▶ Rundgang starten', onclick: () => begin(t) }));
    open = el('div', { className: 'tour-detail' },
      el('p', { className: 'tour-meta', textContent: `${t.stations.length} Stationen · ${km(t.length_m)} km · ca. ${t.minutes} Min. reine Gehzeit` }), steps, buttons);
    button.after(open);
    showRoute(t);
  }
  [...list.children].forEach((b, i) => { if (tours[i]) b.onclick = () => overview(tours[i], b) });

  // ---------- the end of a walk ----------
  const done = el('section', { id: 'walk-done', hidden: true, role: 'dialog', ariaLabel: 'Rundgang beendet' });
  document.body.append(done);
  function finish() {
    if (window.pixelMapShowBuilding) window.pixelMapShowBuilding(null);
    const t = tourActive, i = tours.indexOf(t), next = tours[(i + 1) % tours.length];
    progress.set(t.id, null);
    done.replaceChildren(
      el('h2', { textContent: 'Rundgang geschafft!' }),
      el('p', { textContent: `${t.title}: ${t.stations.length} Stationen, ${km(t.length_m)} km.` }),
      next !== t ? el('p', { className: 'small', textContent: `Wie wäre es mit „${next.title}“? ${next.intro || ''}` }) : null,
      el('div', { className: 'tour-go' },
        next !== t ? el('button', { className: 'primary', textContent: `▶ ${next.title}`, onclick: () => { done.hidden = true; endTour(); begin(next) } }) : null,
        el('button', { textContent: 'Schließen', onclick: () => { done.hidden = true; endTour() } })));
    done.hidden = false;
  }
  const next = $('next'), step = next.onclick;
  next.onclick = e => { if (tourActive && current === route.length - 1) return finish(); return step && step.call(next, e) };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') done.hidden = true });
})();
