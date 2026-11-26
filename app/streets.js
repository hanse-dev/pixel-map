'use strict';
// Straßennamen: street names from OpenStreetMap written along the streets, repeated about every 600 map
// pixels and never overlapping. Text stays the same size on screen at every zoom. Also answers
// "which street is here?" for the error reporter (window.pixelMapStreetAt).
// Shares the viewer's globals (DATA, view, x, y, s, $).
(() => {
  const btn = $('streets');
  if (!btn) return;
  const RANK = { primary: 0, secondary: 1, tertiary: 2, pedestrian: 3, living_street: 3, residential: 4, unclassified: 4, service: 6, footway: 7, path: 7, cycleway: 7, steps: 8, track: 8 };
  let ways = null, labels = null, on = false, raf = 0, drawn = '';
  const canvas = document.createElement('canvas'); canvas.id = 'streets-canvas'; canvas.hidden = true;
  view.append(canvas);
  const ctx = canvas.getContext('2d');

  async function load() {
    if (ways) return ways;
    const w = await (await fetch('walkable.json')).json();
    ways = w.ways.filter(v => v.name && v.highway in RANK).map(v => ({ name: v.name, rank: RANK[v.highway], pts: v.nodes.map(i => w.nodes[i]) }));
    // label anchors: along every named way, the middle of each 600 px stretch, with the local direction
    labels = [];
    for (const v of ways) {
      const p = v.pts, cum = [0];
      for (let k = 1; k < p.length; k++) cum.push(cum[k - 1] + Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]));
      const total = cum[cum.length - 1];
      if (total < 70) continue;
      const n = Math.max(1, Math.round(total / 600));
      for (let j = 0; j < n; j++) {
        const at = total * (j + .5) / n; let k = 1; while (k < p.length - 1 && cum[k] < at) k++;
        const f = (at - cum[k - 1]) / (cum[k] - cum[k - 1] || 1), A = p[k - 1], B = p[k];
        let ang = Math.atan2(B[1] - A[1], B[0] - A[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;   // never upside down
        labels.push({ name: v.name, rank: v.rank, x: A[0] + (B[0] - A[0]) * f, y: A[1] + (B[1] - A[1]) * f, ang, room: total / n });
      }
    }
    labels.sort((a, b) => a.rank - b.rank || b.room - a.room);
    return ways;
  }

  // nearest named street to a map point (within about 60 m), for the error reporter
  window.pixelMapStreetAt = async (mx, my, max = 150) => {
    await load(); let best = null, d0 = max;
    for (const v of ways) for (let k = 1; k < v.pts.length; k++) {
      const [ax, ay] = v.pts[k - 1], [bx, by] = v.pts[k], dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((mx - ax) * dx + (my - ay) * dy) / l)), d = Math.hypot(ax + t * dx - mx, ay + t * dy - my);
      if (d < d0 || (best && d < d0 + 8 && v.rank < best.rank)) { d0 = d; best = v }
    }
    return best ? best.name : null;
  };

  function frame() {
    raf = 0;
    if (!on) return;
    const dpr = devicePixelRatio || 1, w = view.clientWidth, h = view.clientHeight;
    const hide = s < .3 || document.body.classList.contains('depth-on');
    canvas.hidden = hide;
    const key = `${x.toFixed(1)},${y.toFixed(1)},${s.toFixed(4)},${w},${h}`;
    if (!hide && labels && key !== drawn) {
      drawn = key;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr) }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const size = s >= 1 ? 13 : 12, minRank = s < .5 ? 2 : s < .8 ? 4 : 9;
      ctx.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 3.5;
      const taken = [], seen = new Map();
      for (const l of labels) {
        if (l.rank > minRank) continue;
        const sx = l.x * s + x, sy = l.y * s + y;
        if (sx < -100 || sy < -30 || sx > w + 100 || sy > h + 30) continue;
        const tw = ctx.measureText(l.name).width;
        if (tw > l.room * s * 1.3) continue;                               // the street is too short for its name here
        const c = Math.abs(Math.cos(l.ang)), si = Math.abs(Math.sin(l.ang)), bw = (tw * c + size * si) / 2 + 4, bh = (tw * si + size * c) / 2 + 4;
        if (taken.some(t => Math.abs(t[0] - sx) < t[2] + bw && Math.abs(t[1] - sy) < t[3] + bh)) continue;
        const same = seen.get(l.name) || [];                               // the same name at least 260 px apart on screen
        if (same.some(p => Math.hypot(p[0] - sx, p[1] - sy) < 260)) continue;
        taken.push([sx, sy, bw, bh]); same.push([sx, sy]); seen.set(l.name, same);
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(l.ang);
        ctx.strokeStyle = 'rgba(20,24,28,.85)'; ctx.strokeText(l.name, 0, 0);
        ctx.fillStyle = '#fbf7ee'; ctx.fillText(l.name, 0, 0);
        ctx.restore();
      }
    }
    raf = requestAnimationFrame(frame);
  }

  async function set(value) {
    on = value; btn.setAttribute('aria-pressed', String(on));
    try { localStorage.setItem('pixel-map-strassen', on ? '1' : '0') } catch {}
    if (!on) { canvas.hidden = true; drawn = ''; if (raf) cancelAnimationFrame(raf); raf = 0; return }
    await load(); drawn = ''; if (!raf) raf = requestAnimationFrame(frame);
  }
  btn.onclick = () => set(!on);
  let saved = null; try { saved = localStorage.getItem('pixel-map-strassen') } catch {}
  if (saved === '1') set(true);
  window.pixelMapStreets = set;
})();
