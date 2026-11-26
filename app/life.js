'use strict';
// Leben auf der Straße: pixel cars on the roads, cyclists and people on footways and squares, moving along
// the bundle's street graph (walkable.json) and hidden behind buildings in front of them (height tiles).
// Only what is in view is animated; off with reduced motion, from afar, or in the memorial theme.
// Shares the viewer's globals (DATA, view, x, y, s, W, H, reduced, TB, $).
(() => {
  const btn = $('life');
  if (!btn || !DATA.depth_tiles) return;
  const CAR = new Set(['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'service']);
  const WALK = new Set(['footway', 'pedestrian', 'path', 'steps', 'living_street', 'residential', 'service', 'cycleway']);
  const BIKE = new Set(['cycleway', 'path', 'residential', 'living_street', 'tertiary', 'unclassified', 'service']);
  // town speeds in m/s by road type; drivers keep to them and slow down for bends and junctions
  const LIMIT = { primary: 12, secondary: 11, tertiary: 9, residential: 7, unclassified: 7, living_street: 3, service: 4 };
  const PX = (DATA.camera && DATA.camera.px_per_m) || 2.45;                   // map pixels per metre
  const COLOURS = ['#a93226', '#2e6da4', '#e8e6df', '#2c3338', '#8a9297', '#c9a227', '#3d7a4f', '#6c3b73', '#b5651d', '#e8e6df', '#8a9297', '#2c3338'];   // mostly white, grey, black
  const CLOTHES = ['#34495e', '#922b21', '#1f618d', '#117864', '#7d6608', '#6c3483', '#5d6d7e', '#a04000'];
  let graph = null, on = false, raf = 0, agents = [], last = 0;
  const canvas = document.createElement('canvas'); canvas.id = 'life-canvas'; canvas.hidden = true;
  view.append(canvas);
  const ctx = canvas.getContext('2d');

  // ---------- data ----------
  async function load() {
    if (graph) return graph;
    const w = await (await fetch('walkable.json')).json();
    const n = w.nodes.length, list = () => Array.from({ length: n }, () => []);
    const car = list(), walk = list(), bike = list(), limit = new Map();
    for (const way of w.ways) for (let k = 1; k < way.nodes.length; k++) {
      const a = way.nodes[k - 1], b = way.nodes[k];
      if (CAR.has(way.highway)) { car[a].push(b); car[b].push(a); limit.set(a < b ? a * n + b : b * n + a, LIMIT[way.highway]) }
      if (WALK.has(way.highway)) { walk[a].push(b); walk[b].push(a) }
      if (BIKE.has(way.highway)) { bike[a].push(b); bike[b].push(a) }
    }
    const grid = new Map(), G = 128;                       // nodes by 128 px cell, for spawning in view
    w.nodes.forEach((p, i) => { const k = `${p[0] / G | 0},${p[1] / G | 0}`; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i) });
    return (graph = { nodes: w.nodes, car, walk, bike, limit, n, grid, G });
  }

  // ---------- heights: what stands in front ----------
  const spec = DATA.depth_tiles, L = spec.max_level, T = spec.tile_size, tiles = new Map();
  function level(px, py) {
    const c = Math.floor(px / T), r = Math.floor(py / T), key = `${c}_${r}`;
    let t = tiles.get(key);
    if (!t) {
      t = { data: null, w: 0 }; tiles.set(key, t);
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); try { t.data = g.getImageData(0, 0, cv.width, cv.height).data; t.w = cv.width } catch {} };
      img.src = `${TB}depth_files/${L}/${key}.${spec.format || 'png'}`;
      if (tiles.size > 120) tiles.delete(tiles.keys().next().value);
    }
    if (!t.data) return -1;                                  // not loaded yet
    const lx = Math.floor(px) - c * T + (c ? 1 : 0), ly = Math.floor(py) - r * T + (r ? 1 : 0);
    return t.data[(ly * t.w + lx) * 4] || 0;
  }
  // hidden when a surface 1 m or more above ground covers the agent and stands in front (its foot is lower on screen)
  const hidden = (px, py, up) => { for (let dy = 1; dy <= up; dy += 2) { const v = level(px, py - dy); if (v < 0 || (v >= 2 && py - dy + v > py + 1)) return true } return false };

  // ---------- agents ----------
  const rand = (a, b) => a + Math.random() * (b - a), pick = l => l[(Math.random() * l.length) | 0];
  const inView = (p, m = 60) => { const sx = p[0] * s + x, sy = p[1] * s + y; return sx > -m && sy > -m && sx < view.clientWidth + m && sy < view.clientHeight + m };
  const dir = (i, j) => { const A = graph.nodes[i], B = graph.nodes[j], l = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1; return [(B[0] - A[0]) / l, (B[1] - A[1]) / l, l] };
  // next node at a junction: mostly straight on, sometimes a turn, a U-turn only at a dead end
  function choose(kind, from, at) {
    const adj = graph[kind][at], options = adj.filter(n => n !== from);
    if (!options.length) return adj[0];
    const [ux, uy] = dir(from, at);
    const weights = options.map(n => { const [vx, vy] = dir(at, n); return Math.pow(Math.max(.05, (1 + ux * vx + uy * vy) / 2), kind === 'walk' ? 1 : 3) });
    let r = Math.random() * weights.reduce((p, q) => p + q, 0);
    for (let k = 0; k < options.length; k++) if ((r -= weights[k]) <= 0) return options[k];
    return options[options.length - 1];
  }
  const limitOf = a => (a.kind === 'car' ? (graph.limit.get(a.from < a.to ? a.from * graph.n + a.to : a.to * graph.n + a.from) || 7) : a.cruise) * a.temper;
  function spawn(kind) {
    const g = graph, adj = g[kind];
    const vx0 = -x / s, vy0 = -y / s, vw = view.clientWidth / s, vh = view.clientHeight / s;
    for (let tries = 0; tries < 30; tries++) {
      const cell = g.grid.get(`${(vx0 + Math.random() * vw) / g.G | 0},${(vy0 + Math.random() * vh) / g.G | 0}`);
      if (!cell) continue;
      const i = pick(cell);
      if (!adj[i].length || !inView(g.nodes[i], 0)) continue;
      const a = { kind, from: i, to: pick(adj[i]), t: Math.random(), wait: 0, fade: 0, phase: Math.random() * 10,
                  temper: rand(.85, 1.1), cruise: kind === 'bike' ? rand(3.6, 5.2) : rand(1.1, 1.5) };
      a.next = choose(kind, a.from, a.to);
      a.v = kind === 'walk' ? a.cruise : limitOf(a) * .8;
      a.colour = pick(kind === 'car' ? COLOURS : CLOTHES); a.hair = pick(['#3b2a1e', '#1f1a17', '#7a5230', '#b8925a', '#8c8c8c']);
      a.side = kind === 'car' ? 2.1 * PX : kind === 'bike' ? 3.4 * PX : rand(-2.4, 2.4) * PX;
      [a.ux, a.uy] = dir(a.from, a.to);
      if (kind === 'walk' && Math.random() < .12) a.wait = rand(2, 12);      // someone standing, looking or talking
      return a;
    }
    return null;
  }
  function advance(a, dt) {
    a.fade = Math.min(1, a.fade + dt * 1.5);
    if (a.wait > 0) { a.wait -= dt; return true }
    const [, , len] = dir(a.from, a.to);
    if (a.kind !== 'walk') {
      // slow down ahead of a bend or junction, speed up again on the straight (about 2 m/s² either way)
      const [ux, uy] = dir(a.from, a.to), [vx, vy] = dir(a.to, a.next), bend = (1 + ux * vx + uy * vy) / 2;
      const corner = (a.kind === 'car' ? 2.5 : 2) + bend * bend * limitOf(a);
      const left = (1 - a.t) * len / PX, brake = Math.sqrt(corner * corner + 2 * 2 * left);
      const want = Math.min(limitOf(a), brake);
      a.v += Math.max(-4 * dt, Math.min(2 * dt, want - a.v));
    }
    a.t += a.v * PX * dt / len;
    while (a.t >= 1) {
      const at = a.to, degree = graph[a.kind][at].length;
      a.t = (a.t - 1) * len / (dir(at, a.next)[2] || 1); a.from = at; a.to = a.next;
      if (a.to === undefined) return false;
      a.next = choose(a.kind, a.from, a.to);
      if (a.kind === 'walk' && Math.random() < (degree > 2 ? .06 : .015)) a.wait = rand(1.5, 8);
      if (a.kind === 'car' && degree > 2 && Math.random() < .12) { a.wait = rand(.6, 2.5); a.v = 0 }   // giving way
    }
    // heading turns smoothly instead of snapping at every node
    const [tx, ty] = dir(a.from, a.to), k = Math.min(1, dt * (a.kind === 'walk' ? 12 : 6));
    a.ux += (tx - a.ux) * k; a.uy += (ty - a.uy) * k; const l = Math.hypot(a.ux, a.uy) || 1; a.ux /= l; a.uy /= l;
    return true;
  }
  function target() { const area = view.clientWidth * view.clientHeight / (s * s); return { car: Math.min(70, area / 22000), bike: Math.min(40, area / 40000), walk: Math.min(150, area / 9000) } }

  // ---------- drawing: sizes follow the painted map (a painted car is about 18 × 10 px) ----------
  const shade = (hex, f) => { const v = parseInt(hex.slice(1), 16), c = i => Math.max(0, Math.min(255, Math.round(((v >> i) & 255) * f))); return `rgb(${c(16)},${c(8)},${c(0)})` };
  const shades = new Map(), tone = (hex, f) => { const k = hex + f; if (!shades.has(k)) shades.set(k, shade(hex, f)); return shades.get(k) };
  function round(x0, y0, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, y0, w, h, r) : ctx.rect(x0, y0, w, h) }
  function drawCar(a, px, py) {
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(a.uy, a.ux));
    ctx.fillStyle = 'rgba(0,0,0,.25)'; round(-8.5, -3, 18, 9.5, 3); ctx.fill();                       // shadow, falls down-right
    ctx.fillStyle = tone(a.colour, .45); round(-9.5, -5.5, 19, 10, 3); ctx.fill();                   // outline in a deeper shade
    ctx.fillStyle = a.colour; round(-8.7, -4.7, 17.4, 8.4, 2.5); ctx.fill();
    ctx.fillStyle = 'rgba(25,35,45,.85)'; round(-4.5, -4, 10, 7, 1.5); ctx.fill();                    // windows
    ctx.fillStyle = tone(a.colour, 1.12); round(-3, -3.2, 6, 5.4, 1); ctx.fill();                      // roof
    ctx.fillStyle = 'rgba(255,240,200,.8)'; ctx.fillRect(7.6, -3.8, 1, 1.6); ctx.fillRect(7.6, 1.2, 1, 1.6);
    ctx.restore();
  }
  function drawPerson(a, px, py, now, sitting) {
    const moving = !sitting && a.wait <= 0, step = moving ? Math.floor(now / 320 + a.phase) % 2 : 0;
    if (!sitting) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(px - 2, py, 5.5, 1.5) }
    ctx.fillStyle = 'rgba(28,23,20,.9)';                                                               // outline keeps them readable
    ctx.fillRect(px - 2.4, py - 8.2, 4.8, 8.2); ctx.fillRect(px - 1.9, py - 11.2, 3.8, 3.4);
    ctx.fillStyle = '#2f3a45'; ctx.fillRect(px - 1.6 + (step ? .4 : 0), py - 4, 1.3, 3.6); ctx.fillRect(px + .3 - (step ? .4 : 0), py - 4, 1.3, 3.6);
    ctx.fillStyle = a.colour; ctx.fillRect(px - 1.8, py - 7.7, 3.6, 4);
    ctx.fillStyle = tone(a.colour, 1.25); ctx.fillRect(px - 1.8, py - 7.7, 1.2, 4);                       // lit side
    ctx.fillStyle = '#e3bd98'; ctx.fillRect(px - 1.4, py - 10.7, 2.8, 2.7);
    ctx.fillStyle = a.hair; ctx.fillRect(px - 1.4, py - 10.7, 2.8, 1);
  }
  function drawBike(a, px, py, now) {
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(a.uy, a.ux));
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-4.5, 0, 10, 2.5);
    ctx.fillStyle = '#1c1714'; ctx.fillRect(-5.5, -1.2, 11, 2.4);                                      // wheels and frame
    ctx.fillStyle = '#5d6d7e'; ctx.fillRect(-2, -.5, 4, 1);
    ctx.restore();
    drawPerson(a, px, py - 3, now, true);
  }
  function frame(now) {
    raf = 0;
    if (!on) return;
    const dt = Math.min(.1, (now - last) / 1000 || 0); last = now;
    const dpr = devicePixelRatio || 1, w = view.clientWidth, h = view.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr) }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    const visible = s >= .45 && !document.body.classList.contains('memorial') && !document.body.classList.contains('depth-on');
    canvas.hidden = !visible;
    if (visible && graph) {
      agents = agents.filter(a => advance(a, dt) && inView(graph.nodes[a.from], 200));
      const want = target();
      for (const kind of ['car', 'bike', 'walk']) {
        let have = agents.filter(a => a.kind === kind).length, born = 0;
        while (have < want[kind] && born < 3) { const a = spawn(kind); if (!a) break; agents.push(a); have++; born++ }   // a few per frame, no crowd popping in
      }
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * x, dpr * y);
      const pos = a => { const A = graph.nodes[a.from], B = graph.nodes[a.to], dx = B[0] - A[0], dy = B[1] - A[1];
        return [A[0] + dx * a.t - a.uy * a.side, A[1] + dy * a.t + a.ux * a.side] };
      const list = agents.map(a => [a, pos(a)]).sort((p, q) => p[1][1] - q[1][1]);          // back to front
      for (const [a, [px, py]] of list) {
        const ux = a.ux * 8, uy = a.uy * 8;
        if (a.kind === 'car' ? hidden(px, py, 8) || hidden(px - ux, py - uy, 8) || hidden(px + ux, py + uy, 8) : hidden(px, py, a.kind === 'bike' ? 14 : 11)) continue;
        ctx.globalAlpha = a.fade;
        if (a.kind === 'car') drawCar(a, px, py); else if (a.kind === 'bike') drawBike(a, px, py, now); else drawPerson(a, px, py, now, false);
      }
      ctx.globalAlpha = 1;
    }
    raf = requestAnimationFrame(frame);
  }

  async function set(value) {
    on = value && !reduced.matches; btn.setAttribute('aria-pressed', String(on));
    try { localStorage.setItem('pixel-map-life', on ? '1' : '0') } catch {}
    if (!on) { canvas.hidden = true; agents = []; if (raf) cancelAnimationFrame(raf); raf = 0; return }
    await load(); last = performance.now(); if (!raf) raf = requestAnimationFrame(frame);
  }
  btn.onclick = () => set(!on);
  let saved = null; try { saved = localStorage.getItem('pixel-map-life') } catch {}
  if (saved === '1') set(true);
  window.pixelMapLife = set;
})();
