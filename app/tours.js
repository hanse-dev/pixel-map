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

  // ---------- reading aloud ----------
  // Each station has a spoken introduction (scripts/narrate.py). While "Vorlesen" is on, arriving at a
  // station plays it; when it ends and "Automatisch weiter" is on, the walk moves on after a short pause.
  const audio = new Audio(); audio.preload = 'auto'; window.pixelMapAudio = audio;   // for tests and the console
  const pref = (k, d) => { try { const v = localStorage.getItem('pixel-map-' + k); return v === null ? d : v === '1' } catch { return d } };
  const keep = (k, v) => { try { localStorage.setItem('pixel-map-' + k, v ? '1' : '0') } catch {} };
  let speak = pref('vorlesen', true), auto = pref('weiter', true), wait = null, playingFor = null;
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const play = el('button', { className: 'au-play', ariaLabel: 'Vorlesen abspielen', textContent: '▶' });
  const time = el('span', { className: 'au-time', textContent: '0:00 / 0:00' });
  const bar = el('input', { type: 'range', min: 0, max: 1000, value: 0, className: 'au-bar', ariaLabel: 'Position im Text' });
  const speakBox = el('input', { type: 'checkbox', checked: speak }), autoBox = el('input', { type: 'checkbox', checked: auto });
  const player = el('div', { className: 'au', hidden: true },
    el('div', { className: 'au-row' },
      el('button', { className: 'au-step', ariaLabel: 'Vorige Station', textContent: '⏮', onclick: () => step(-1) }), play,
      el('button', { className: 'au-step', ariaLabel: 'Nächste Station', textContent: '⏭', onclick: () => step(1) }), time),
    bar,
    el('div', { className: 'au-opts' }, el('label', {}, speakBox, ' Vorlesen'), el('label', {}, autoBox, ' Automatisch weiter')),
    el('div', { className: 'au-next', hidden: true }),
    el('div', { className: 'au-credit', textContent: 'Gelesen von Piper, Stimme „Thorsten“ (CC0) · Text: Wikipedia (CC BY-SA 4.0)' }));
  (document.querySelector('.side-walk') || $('tour-bar')).append(player);
  const countdown = player.querySelector('.au-next');
  function step(d) { cancel(); if (d > 0) $('next').click(); else $('previous').click() }
  function cancel() { clearInterval(wait); wait = null; countdown.hidden = true }
  function load(st) {
    cancel(); playingFor = st;
    if (!st || !st.audio) { audio.removeAttribute('src'); player.classList.add('silent'); return }
    player.classList.remove('silent');
    audio.src = st.audio.url; time.textContent = `0:00 / ${fmt(st.audio.seconds)}`; bar.value = 0;
    if (speak) setTimeout(() => { if (playingFor === st) audio.play().catch(() => sync()) }, reduced.matches ? 0 : 800);
  }
  function sync() { play.textContent = audio.paused ? '▶' : '⏸'; play.setAttribute('aria-label', audio.paused ? 'Abspielen' : 'Pause') }
  play.onclick = () => {
    if (wait) { cancel(); return }                         // pause also stops the countdown
    if (!audio.src) return;
    audio.paused ? audio.play() : audio.pause();
  };
  audio.addEventListener('play', sync); audio.addEventListener('pause', sync);
  audio.addEventListener('timeupdate', () => {
    const d = audio.duration || (playingFor && playingFor.audio && playingFor.audio.seconds) || 0;
    time.textContent = `${fmt(audio.currentTime)} / ${fmt(d)}`; if (d) bar.value = Math.round(audio.currentTime / d * 1000);
  });
  bar.addEventListener('input', () => { if (audio.duration) audio.currentTime = bar.value / 1000 * audio.duration });
  audio.addEventListener('ended', () => {
    sync();
    if (!auto || !tourActive) return;
    let n = 4;
    const tick = () => { countdown.textContent = current === route.length - 1 ? `Rundgang endet in ${n} s · Pause zum Bleiben` : `Weiter in ${n} s · Pause zum Bleiben`; countdown.hidden = false; if (n-- <= 0) { cancel(); $('next').click() } };
    tick(); wait = setInterval(tick, 1000);
  });
  speakBox.onchange = () => { speak = speakBox.checked; keep('vorlesen', speak); if (!speak) audio.pause() };
  autoBox.onchange = () => { auto = autoBox.checked; keep('weiter', auto); if (!auto) cancel() };
  addEventListener('keydown', e => { if (tourActive && e.key === 'k' && !e.target.closest('input,textarea')) play.click() });
  (function follow() {                                   // a new station (or the end of the walk) changes what is read
    const st = tourActive ? route[current] : null;
    player.hidden = !tourActive;
    if (st !== playingFor) { audio.pause(); load(st) }
    requestAnimationFrame(follow);
  })();

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
  const next = $('next'), advanceStep = next.onclick;
  next.onclick = e => { if (tourActive && current === route.length - 1) return finish(); return advanceStep && advanceStep.call(next, e) };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') done.hidden = true });
})();
