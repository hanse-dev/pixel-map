// Bugmelder: a report from the map (spot, what is wrong, description) becomes a GitHub issue. A report
// at a spot that already has an open issue (same building, or within 60 map px ≈ 25 m) is added there
// as a comment, so one fault stays one issue. Each issue is labelled with its painting area (the 800 px
// grid the GPU repaints in one window), so faults can be fixed area by area.
// Secrets (wrangler secret): GITHUB_TOKEN (fine-grained, Issues read/write), GITHUB_REPO, TURNSTILE_SECRET.
const LABEL = 'Kartenfehler', NEAR = 60, STRIDE = 800;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').includes(origin);
    const cors = { 'Access-Control-Allow-Origin': allowed ? origin : 'null', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST' || !allowed) return reply(405, { error: 'nur Meldungen von der Karte' });

    const ip = request.headers.get('CF-Connecting-IP') || '';
    if (env.LIMIT && !(await env.LIMIT.limit({ key: ip })).success) return reply(429, { error: 'Zu viele Meldungen auf einmal. Bitte kurz warten.' });

    let r;
    try { r = await request.json() } catch { return reply(400, { error: 'unlesbar' }) }
    const x = Math.round(+r.x), y = Math.round(+r.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 100000 || y > 100000) return reply(400, { error: 'Stelle fehlt' });

    // Turnstile: is a person behind this?
    const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST',
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: String(r.token || ''), remoteip: ip }) }).then(q => q.json()).catch(() => ({}));
    if (!check.success) return reply(403, { error: 'Prüfung fehlgeschlagen. Bitte noch einmal versuchen.' });

    // plain text only: no mentions, no hidden markers, bounded length
    const clean = (v, n) => String(v || '').replace(/<!--|-->/g, '').replace(/@/g, '@​').replace(/\r/g, '').slice(0, n).trim();
    const kind = clean(r.kind, 60) || 'Meldung', where = clean(r.where, 200), text = clean(r.text, 2000);
    const osm = /^(way|relation|node)\/\d+$/.test(r.osm || '') ? r.osm : '';
    const http = v => /^https:\/\/[^\s<>"]+$/.test(v || '') ? v : '';
    const link = http(r.link), image = http(r.image), version = clean(r.version, 40), area = `Bereich ${Math.floor(x / STRIDE)}_${Math.floor(y / STRIDE)}`;

    const gh = (path, init = {}) => fetch(`https://api.github.com/repos/${env.GITHUB_REPO}${path}`, { ...init,
      headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'pixel-map-meldung', 'X-GitHub-Api-Version': '2022-11-28', ...(init.body ? { 'Content-Type': 'application/json' } : {}) } });

    const entry = [
      `**Was:** ${kind}`, `**Wo:** ${where || `Kartenpunkt ${x}, ${y}`}`,
      osm ? `**Gebäude:** https://www.openstreetmap.org/${osm}` : null,
      `**Kartenpunkt:** ${x}, ${y} · ${area}${version ? ` · Karte ${version}` : ''}`,
      link ? `**Auf der Karte:** ${link}` : null, image ? `**Bild der Stelle:** ${image}` : null,
      '', text || '_(ohne Beschreibung)_'
    ].filter(v => v !== null).join('\n');

    // an open issue for the same building or a spot close by?
    let same = null;
    const open = await gh(`/issues?state=open&labels=${encodeURIComponent(LABEL)}&per_page=100`).then(q => q.ok ? q.json() : []).catch(() => []);
    for (const issue of open) {
      const m = /<!-- stelle:(\d+),(\d+) osm:(\S*) -->/.exec(issue.body || ''); if (!m) continue;
      if ((osm && m[3] === osm) || Math.hypot(+m[1] - x, +m[2] - y) <= NEAR) { same = issue; break }
    }
    if (same) {
      const q = await gh(`/issues/${same.number}/comments`, { method: 'POST', body: JSON.stringify({ body: `### Weitere Meldung\n${entry}` }) });
      if (!q.ok) return reply(502, { error: 'Meldung konnte nicht gespeichert werden.' });
      return reply(200, { ok: true, number: same.number, merged: true });
    }
    const title = `${kind}: ${where || `Kartenpunkt ${x}, ${y}`}`.slice(0, 120);
    const q = await gh('/issues', { method: 'POST', body: JSON.stringify({ title, labels: [LABEL, area], body: `${entry}\n\n<!-- stelle:${x},${y} osm:${osm} -->` }) });
    if (!q.ok) return reply(502, { error: 'Meldung konnte nicht gespeichert werden.' });
    return reply(200, { ok: true, number: (await q.json()).number, merged: false });
  }
};
