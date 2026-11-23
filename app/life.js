'use strict';
// Leben auf der Straße: small pixel cars on the roads and people on footways and squares, moving along
// the bundle's street graph (walkable.json) and hidden behind buildings in front of them (height tiles).
// Only what is in view is animated; off with reduced motion, from afar, or in the memorial theme.
// Shares the viewer's globals (DATA, view, x, y, s, W, H, reduced, TB, $).
(() => {
  const btn = $('life');
  if (!btn || !DATA.depth_tiles) return;
  const CAR = new Set(['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'service']);
  const WALK = new Set(['footway', 'pedestrian', 'path', 'steps', 'living_street', 'residential', 'service', 'cycleway']);
  const PX = (DATA.camera && DATA.camera.px_per_m) || 2.45;                   // map pixels per metre
  const COLOURS = ['#c0392b', '#2e86c1', '#f4f6f7', '#1c2833', '#7f8c8d', '#d4ac0d', '#27ae60', '#8e44ad', '#e67e22'];
  const CLOTHES = ['#34495e', '#922b21', '#1f618d', '#117864', '#7d6608', '#6c3483', '#5d6d7e', '#a04000'];
  let graph = null, on = false, raf = 0, agents = [], last = 0;
  const canvas = document.createElement('canvas'); canvas.id = 'life-canvas'; canvas.hidden = true;
  view.append(canvas);
  const ctx = canvas.getContext('2d');

  // ---------- data ----------
  async function load() {
    if (graph) return graph;
    const w = await (await fetch('walkable.json')).json();
    const n = w.nodes.length, car = Array.from({ length: n }, () => []), walk = Array.from({ length: n }, () => []);
    for (const way of w.ways) for (let k = 1; k < way.nodes.length; k++) {
      const a = way.nodes[k - 1], b = way.nodes[k];
      if (CAR.has(way.highway)) { car[a].push(b); car[b].push(a) }
      if (WALK.has(way.highway)) { walk[a].push(b); walk[b].push(a) }
    }
    const grid = new Map(), G = 128;                       // nodes by 128 px cell, for spawning in view
    w.nodes.forEach((p, i) => { const k = `${p[0] / G | 0},${p[1] / G | 0}`; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i) });
    return (graph = { nodes: w.nodes, car, walk, grid, G });
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
  const inView = (p, m = 60) => { const sx = p[0] * s + x, sy = p[1] * s + y; return sx > -m && sy > -m && sx < view.clientWidth + m && sy < view.clientHeight + m };
  function spawn(kind) {
    const g = graph, adj = g[kind];
    const vx0 = -x / s, vy0 = -y / s, vw = view.clientWidth / s, vh = view.clientHeight / s;
    for (let tries = 0; tries < 30; tries++) {
      const cell = g.grid.get(`${(vx0 + Math.random() * vw) / g.G | 0},${(vy0 + Math.random() * vh) / g.G | 0}`);
      if (!cell) continue;
      const i = cell[(Math.random() * cell.length) | 0];
      if (!adj[i].length || !inView(g.nodes[i], 0)) continue;
      const next = adj[i][(Math.random() * adj[i].length) | 0];
      return { kind, from: i, to: next, t: Math.random(), speed: kind === 'car' ? (7 + Math.random() * 5) * PX : (1.1 + Math.random() * .5) * PX,
               colour: (kind === 'car' ? COLOURS : CLOTHES)[(Math.random() * 8) | 0], side: kind === 'walk' ? (Math.random() - .5) * 4 : 1.6 * PX };
    }
    return null;
  }
  function advance(a, dt) {
    const g = graph, A = g.nodes[a.from], B = g.nodes[a.to], len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
    a.t += a.speed * dt / len;
    while (a.t >= 1) {
      const adj = g[a.kind][a.to], options = adj.filter(n => n !== a.from);
      const next = (options.length ? options : adj)[(Math.random() * (options.length || adj.length)) | 0];
      a.t -= 1; a.from = a.to; a.to = next;
      if (next === undefined) return false;
    }
    return true;
  }
  function target() { const area = view.clientWidth * view.clientHeight / (s * s); return { car: Math.min(160, area / 9000), walk: Math.min(260, area / 5000) } }

  // ---------- drawing ----------
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
      for (const kind of ['car', 'walk']) { let have = agents.filter(a => a.kind === kind).length; while (have < want[kind]) { const a = spawn(kind); if (!a) break; agents.push(a); have++ } }
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * x, dpr * y);
      const pos = a => { const A = graph.nodes[a.from], B = graph.nodes[a.to], dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1;
        return [A[0] + dx * a.t - dy / l * a.side, A[1] + dy * a.t + dx / l * a.side, dx / l, dy / l] };
      const list = agents.map(a => [a, pos(a)]).sort((p, q) => p[1][1] - q[1][1]);          // back to front
      for (const [a, [px, py, ux, uy]] of list) {
        if (a.kind === 'car') {
          if (hidden(px, py, 5) || hidden(px - 4 * ux, py - 4 * uy, 5) || hidden(px + 4 * ux, py + 4 * uy, 5)) continue;
          ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(uy, ux));
          ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(-5, -1.5, 11, 5);
          ctx.fillStyle = a.colour; ctx.fillRect(-5.5, -3, 11, 5);
          ctx.fillStyle = 'rgba(20,30,40,.75)'; ctx.fillRect(-1.5, -2.5, 4, 4);
          ctx.restore();
        } else {
          if (hidden(px, py, 7)) continue;
          ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(px - 1.5, py, 4, 1.2);
          ctx.fillStyle = '#1c1714'; ctx.fillRect(px - 1.7, py - 7.7, 3.4, 7.4);          // outline keeps them readable
          ctx.fillStyle = a.colour; ctx.fillRect(px - 1.2, py - 5, 2.4, 3.5);
          ctx.fillStyle = '#e8c39e'; ctx.fillRect(px - 1.2, py - 7.2, 2.4, 2.2);
          const step = (now / 220 | 0) % 2;
          ctx.fillStyle = '#2b2522'; ctx.fillRect(px - 1.2 + step, py - 1.5, 1, 1.5); ctx.fillRect(px + .2 - step, py - 1.5, 1, 1.5);
        }
      }
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
