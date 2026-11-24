'use strict';
// Wo bin ich? The device position as a dot on the map, projected like the map itself: WGS84 -> UTM 32N
// (EPSG:25832) -> camera pixel matrix at the measured ground height (ground.json). Nothing leaves the
// browser. Shares the viewer's globals (DATA, view, x, y, s, W, H, $, animate, hero).
(() => {
  const btn = $('locate');
  if (!btn || !navigator.geolocation || !DATA.camera || !DATA.camera.pixel_matrix) return;
  const layer = document.createElement('div'); layer.id = 'me'; layer.hidden = true;
  layer.innerHTML = '<i></i>'; view.append(layer);
  let ground = null, watch = null, first = true, last = null;

  function utm32(lat, lon) {                        // Krüger series, zone 32 (central meridian 9° E), ETRS89 ≈ WGS84
    const a = 6378137, f = 1 / 298.257222101, k0 = .9996, n = f / (2 - f), A = a / (1 + n) * (1 + n * n / 4 + n ** 4 / 64);
    const al = [n / 2 - 2 * n * n / 3 + 5 * n ** 3 / 16, 13 * n * n / 48 - 3 * n ** 3 / 5, 61 * n ** 3 / 240];
    const phi = lat * Math.PI / 180, dl = (lon - 9) * Math.PI / 180, e = Math.sqrt(f * (2 - f));
    const t = Math.sinh(Math.atanh(Math.sin(phi)) - e * Math.atanh(e * Math.sin(phi)));
    const xi = Math.atan2(t, Math.cos(dl)), eta = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t));
    let E = eta, N = xi;
    for (let j = 1; j <= 3; j++) { E += al[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta); N += al[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta) }
    return [500000 + k0 * A * E, k0 * A * N];
  }
  function toMap(lat, lon) {
    const [e, n] = utm32(lat, lon), g = ground, M = DATA.camera.pixel_matrix;
    let z = 10;
    if (g) { const c = Math.round((e - g.west) / g.step_m), r = Math.round((g.north - n) / g.step_m); if (r >= 0 && c >= 0 && r < g.rows && c < g.columns) z = g.heights_dm[r * g.columns + c] / 10 }
    return [M[0][0] * e + M[0][1] * n + M[0][2] * z + M[0][3], M[1][0] * e + M[1][1] * n + M[1][2] * z + M[1][3]];
  }
  function place() { if (!last) return; layer.style.transform = `translate(${x + last[0] * s}px, ${y + last[1] * s}px)` }
  (function follow() { if (!layer.hidden) place(); requestAnimationFrame(follow) })();
  async function start() {
    if (!ground) try { ground = await (await fetch('ground.json')).json() } catch {}
    btn.setAttribute('aria-pressed', 'true'); first = true;
    watch = navigator.geolocation.watchPosition(p => {
      const [px, py] = toMap(p.coords.latitude, p.coords.longitude);
      const inside = px >= 0 && py >= 0 && px < W && py < H;
      if (!inside) { stop(); $('pill').textContent = 'Du bist außerhalb der Karte.'; $('pill').classList.add('visible'); setTimeout(() => $('pill').classList.remove('visible'), 2500); return }
      last = [px, py]; layer.hidden = false;
      layer.style.setProperty('--acc', Math.min(80, p.coords.accuracy * DATA.camera.px_per_m * s) + 'px');
      if (first) { first = false; animate(hero({ x: px, y: py, view_width: 700 })) }
    }, err => { stop(); $('pill').textContent = err.code === 1 ? 'Standort nicht freigegeben.' : 'Standort nicht verfügbar.'; $('pill').classList.add('visible'); setTimeout(() => $('pill').classList.remove('visible'), 2500) },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  }
  function stop() { if (watch !== null) navigator.geolocation.clearWatch(watch); watch = null; layer.hidden = true; btn.setAttribute('aria-pressed', 'false') }
  btn.onclick = () => watch === null ? start() : stop();
})();
