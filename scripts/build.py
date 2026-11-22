#!/usr/bin/env python3
"""Build the static site into _site/ from the map bundles in cities/ and the app in app/.

  python3 scripts/build.py            # then: python3 -m http.server -d _site 8000

Each city needs cities/<name>/ (a map bundle from isometric-cities `atlas.py bundle`) and
config/<name>.json (title, landmark Wikidata ids, opening landmark). info/<name>.<lang>.json is
optional; without it buildings still open with name and links, just without Wikipedia text.

Tiles can live outside Git (Cloudflare R2). Make them once per map version, upload, then build
pages that point to them; the bundle's large images then need not be in the repository:

  python3 scripts/build.py --tiles-out tiles --tiles-base https://pub-….r2.dev/   # writes tiles/<city>/<version>/
  python3 scripts/upload_r2.py tiles                                              # and config/<city>.tiles.json
  python3 scripts/build.py                     # pages only; tiles come from the URL in config/<city>.tiles.json
"""
import base64, html, io, json, re, shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / '_site'
TEMPLATE = (ROOT / 'app/viewer.template.html').read_text()


def script_json(value):
    return json.dumps(value, ensure_ascii=True).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')


def preview(path):
    with Image.open(path) as image:
        image = image.convert('RGB'); image.thumbnail((1600, 1600), Image.Resampling.BOX)
        stream = io.BytesIO(); image.save(stream, 'WEBP', quality=82)
    return 'data:image/webp;base64,' + base64.b64encode(stream.getvalue()).decode('ascii')


TILE, QUALITY = 512, 88
DEFAULT_GRADE = (.5, 1.1, 1.04)   # saturate, contrast, brightness of the "Gedeckt" level
PALETTES = [{'name': 'Gedeckt', 'dir': 'map_files', 'f': ''}, {'name': 'Wie gemalt', 'dir': 'raw_files', 'f': ''},
            {'name': 'Ruhig', 'dir': 'raw_files', 'f': 'saturate(.7) contrast(1.05) brightness(1.02)'},
            {'name': 'Papierkarte', 'dir': 'raw_files', 'f': 'saturate(.3) contrast(1.12) brightness(1.06)'}]


def grade(image, saturate, contrast, brightness):
    """CSS filter saturate() contrast() brightness() in that order, on sRGB values."""
    import numpy as np
    a = np.asarray(image.convert('RGB'), np.float32) / 255
    s = saturate
    m = np.array([[.213 + .787 * s, .715 - .715 * s, .072 - .072 * s],
                  [.213 - .213 * s, .715 + .285 * s, .072 - .072 * s],
                  [.213 - .213 * s, .715 - .715 * s, .072 + .928 * s]], np.float32)
    a = np.clip(a @ m.T, 0, 1)
    a = np.clip((a - .5) * contrast + .5, 0, 1)
    a = np.clip(a * brightness, 0, 1)
    return Image.fromarray((a * 255 + .5).astype('uint8'))


def pyramid(image, folder, *, fmt='webp', resample=Image.Resampling.BOX):
    """Deep Zoom levels of TILE px with 1 px overlap; WebP for art, PNG where values must stay exact."""
    import math
    maximum = math.ceil(math.log2(max(image.size)))
    levels = {}
    for level in range(maximum, -1, -1):
        d = 2 ** (maximum - level)
        size = (math.ceil(image.width / d), math.ceil(image.height / d))
        reduced = image if d == 1 else image.resize(size, resample)
        (folder / str(level)).mkdir(parents=True, exist_ok=True)
        cols, rows = math.ceil(size[0] / TILE), math.ceil(size[1] / TILE)
        levels[str(level)] = {'width': size[0], 'height': size[1], 'columns': cols, 'rows': rows}
        for r in range(rows):
            for c in range(cols):
                t = reduced.crop((max(0, c * TILE - 1), max(0, r * TILE - 1), min(size[0], (c + 1) * TILE + 1), min(size[1], (r + 1) * TILE + 1)))
                if fmt == 'webp':
                    t.save(folder / str(level) / f'{c}_{r}.webp', 'WEBP', quality=QUALITY, method=6)
                else:
                    t.save(folder / str(level) / f'{c}_{r}.png', optimize=True)
    return {'tile_size': TILE, 'overlap': 1, 'format': fmt, 'max_level': maximum, 'levels': levels}


def groups_of(name, root, configs):
    """[[lead id, [member ids]]]: landmarks that OSM splits into several buildings (config "groups")."""
    by_osm = {b['osm']: b['id'] for b in json.loads((root / 'buildings.json').read_text())['buildings']}
    out = []
    for g in configs[name].get('groups', []):
        ids = [by_osm[o] for o in g['osm'] if o in by_osm]
        if ids: out.append([ids[0], ids])
    return out


CATEGORY_RULES = [   # (category, words in the name, OSM building kinds); first match wins
    ('kirchen', ('kirche', 'kapelle', 'kloster', 'konvent', 'synagoge', 'st. ', 'st.-'), ('church', 'chapel', 'cathedral', 'synagogue')),
    ('kultur', ('theater', 'kongress', 'logenhaus', 'rio', 'halle', 'buniamshof', 'stadion'), ('grandstand', 'sports_centre', 'temple')),
    ('hanse', ('speicher', 'schuppen', 'handel', 'zoll', 'bank', 'backhaus', 'kaufmann', 'kanzlei', 'rathaus'), ('warehouse', 'industrial')),
    ('tore', ('tor', 'brücke', 'wasser', 'bunker', 'schifffahrt'), ('bunker', 'bridge')),
    ('oeffentlich', ('schule', 'seminar', 'gymnasium', 'landesamt', 'polizei', 'feuerwache', 'parkhaus', 'amt'), ('school', 'office', 'government', 'public', 'parking', 'retail', 'commercial')),
]


def category_of(name, kind):
    low = name.lower()
    for cat, words, kinds in CATEGORY_RULES:
        if any(w in low for w in words) or kind in kinds:
            return cat
    return 'museen'                                   # houses, villas and the rest


def extra_places(config, bundle, info, groups):
    """Every other building with a Wikipedia entry, sorted into the place categories."""
    names = {c['id']: c['name'] for c in config.get('categories', [])}
    curated = {l['wikidata'] for l in config['landmarks']}
    members = {m for _, ms in groups for m in ms[1:]}
    best = {}
    for b in json.loads((bundle / 'buildings.json').read_text())['buildings']:
        q = b.get('wikidata')
        if q in info and q not in curated and 'centre' in b and b['id'] not in members and b['visible_px'] > best.get(q, {}).get('visible_px', 0):
            best[q] = b
    out = []
    for q, b in best.items():
        name = (info[q].get('title') or info[q].get('label') or b.get('name') or q).replace(' (Lübeck)', '')
        cat = config.get('category_overrides', {}).get(q) or category_of(name, b.get('kind'))
        out.append({'name': name, 'category': names.get(cat, cat), 'building': b['id'], 'x': b['centre'][0], 'y': b['centre'][1], 'view_width': 900})
    return sorted(out, key=lambda p: p['name'])


def hit_ids(bundle):
    """Building id per map pixel from the bundle's hit map, or None when only the small files are here (CI)."""
    if not (bundle / 'hitmap.png').exists(): return None
    import numpy as np
    Image.MAX_IMAGE_PIXELS = None
    a = np.asarray(Image.open(bundle / 'hitmap.png').convert('RGB')).astype(np.uint32)
    return a[..., 0] | (a[..., 1] << 8) | (a[..., 2] << 16)


def first_sentence(text):
    """The opening sentence of a Wikipedia introduction (abbreviations like St. and dates stay intact)."""
    text = re.sub(r'\s+', ' ', text).strip()
    m = re.search(r'(?<!St)(?<!\d)(?<![A-Z])[.!?](?=\s+[A-ZÄÖÜ„])', text)
    return text[:m.end()] if m else text[:240]


class Walk:
    """Footpaths of the bundle's street graph, measured on the ground (metres) and drawn in map pixels.
    Streets are preferred over alleys, yards and paths; with the hit map, stretches hidden behind
    buildings in the oblique view are marked so the viewer can draw them faintly."""
    COST = {'footway': 1.8, 'path': 1.8, 'steps': 2.0, 'service': 1.4, 'track': 1.6, 'cycleway': 1.5}

    def __init__(self, bundle, hitmap=None):
        import numpy as np
        from scipy.spatial import cKDTree
        camera = json.loads((bundle / 'camera.json').read_text()); M = np.array(camera['pixel_matrix'])
        w = json.loads((bundle / 'walkable.json').read_text())
        self.P = np.array(w['nodes'], float)
        z = camera.get('z0_m', 15.0)
        G = (np.linalg.inv(M[:, :2]) @ (self.P.T - M[:, 3:4] - M[:, 2:3] * z)).T
        self.nb = [[] for _ in self.P]; street = np.zeros(len(self.P), bool)
        for way in w['ways']:
            k = self.COST.get(way['highway'], 1.0)
            for a, b in zip(way['nodes'], way['nodes'][1:]):
                d = float(np.hypot(*(G[a] - G[b]))); self.nb[a].append((b, d, k)); self.nb[b].append((a, d, k))
            if k == 1.0: street[way['nodes']] = True
        self.street = street
        self.ok = np.nonzero([len(n) for n in self.nb])[0]; self.tree = cKDTree(self.P[self.ok])
        self.ids = hitmap

    def doors(self, b, pad=24):
        """Street nodes right around a building (its box widened by pad px); alleys only if no street."""
        import numpy as np
        x0, y0, x1, y1 = b['box']
        P = self.P[self.ok]
        inside = self.ok[np.nonzero((P[:, 0] >= x0 - pad) & (P[:, 0] <= x1 + pad) & (P[:, 1] >= y0 - pad) & (P[:, 1] <= y1 + pad))[0]]
        streets = [int(n) for n in inside if self.street[n]]
        return streets or [int(n) for n in inside] or [int(self.ok[self.tree.query([(x0 + x1) / 2, y1])[1]])]

    def route(self, a, b, start=None):
        """Walk from where the last leg ended (start) or any door of a to the nearest door of b.
        Returns metres and [[visible, points], ...] runs."""
        import heapq
        starts, goals = [start] if start is not None else self.doors(a), set(self.doors(b))
        cost, prev, metres = {n: 0.0 for n in starts}, {}, {n: 0.0 for n in starts}
        q = [(0.0, n) for n in starts]; heapq.heapify(q); t = None
        while q:
            c, n = heapq.heappop(q)
            if c > cost[n]: continue
            if n in goals: t = n; break
            for m, d, k in self.nb[n]:
                if c + d * k < cost.get(m, 1e18): cost[m] = c + d * k; metres[m] = metres[n] + d; prev[m] = n; heapq.heappush(q, (c + d * k, m))
        if t is None: return 0.0, []
        path, n = [t], t
        while n in prev: n = prev[n]; path.append(n)
        self.end = t
        pts = [[round(float(self.P[i][0]), 1), round(float(self.P[i][1]), 1)] for i in reversed(path)]
        return metres[t], self.runs(pts, {a['id'], b['id']})

    def runs(self, pts, own):
        """Split a path into stretches seen in the map and stretches hidden behind other buildings."""
        if self.ids is None or len(pts) < 2: return [[1, simplify(pts, 1.5)]]
        import numpy as np
        dense = []
        for p, q in zip(pts[:-1], pts[1:]):
            n = max(1, int(np.hypot(q[0] - p[0], q[1] - p[1]) / 2))
            dense += [[p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n] for k in range(n)]
        dense.append(pts[-1])
        H, W = self.ids.shape
        vis = []
        for x, y in dense:
            i = int(self.ids[min(max(int(y), 0), H - 1), min(max(int(x), 0), W - 1)])
            vis.append(i == 0 or i in own)
        vis = np.array(vis)
        for k in range(len(vis)):                       # ignore flicker shorter than 4 samples (8 px)
            if 0 < k < len(vis) - 1 and vis[k] != vis[k - 1]:
                j = k
                while j < len(vis) and vis[j] == vis[k] and j - k < 4: j += 1
                if j - k < 4 and j < len(vis): vis[k:j] = vis[k - 1]
        out, start = [], 0
        for k in range(1, len(dense) + 1):
            if k == len(dense) or vis[k] != vis[start]:
                out.append([int(vis[start]), simplify([[round(a, 1), round(b, 1)] for a, b in dense[start:k + 1]], 1.5)]); start = k
        return out


def simplify(pts, tol):
    """Ramer-Douglas-Peucker in map pixels."""
    if len(pts) < 3: return pts
    (x0, y0), (x1, y1) = pts[0], pts[-1]; L = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** .5 or 1
    d = [abs((x1 - x0) * (y0 - y) - (x0 - x) * (y1 - y0)) / L for x, y in pts[1:-1]]
    k = max(range(len(d)), key=d.__getitem__)
    if d[k] <= tol: return [pts[0], pts[-1]]
    return simplify(pts[:k + 2], tol)[:-1] + simplify(pts[k + 1:], tol)


def outline_tiles(bundle, out, wanted, groups=()):
    """Gold outlines of the buildings that open an info panel, as an RGBA Deep Zoom pyramid."""
    import numpy as np
    from scipy import ndimage as ndi
    rgb = np.asarray(Image.open(bundle / 'hitmap.png').convert('RGB')).astype(np.uint32)
    ids = rgb[..., 0] | (rgb[..., 1] << 8) | (rgb[..., 2] << 16)
    for lead, members in groups:                      # one outline around all parts of a landmark
        ids[np.isin(ids, members)] = lead
    inside = np.isin(ids, sorted(wanted))
    edge = np.zeros_like(inside)                      # a pixel of a wanted building next to anything else
    for axis in (0, 1):
        for shift in (1, -1):
            edge |= inside & (np.roll(ids, shift, axis) != ids)
    ring = ndi.binary_dilation(edge, iterations=1)
    rgba = np.zeros((*ids.shape, 4), np.uint8)
    rgba[ring & ~edge] = (40, 28, 10, 150)            # dark halo keeps the line visible on light roofs
    rgba[edge] = (255, 214, 90, 235)
    image = Image.fromarray(rgba, 'RGBA')
    fill = np.zeros_like(rgba)                         # "Eingefärbt": the whole building tinted, edge kept
    fill[inside] = (255, 196, 60, 120)
    fill[ring & ~edge] = (40, 28, 10, 150)
    fill[edge] = (255, 230, 120, 255)
    return pyramid(image, out / 'outline_files', fmt='png'), pyramid(Image.fromarray(fill, 'RGBA'), out / 'fill_files', fmt='png')
    import math
    maximum = math.ceil(math.log2(max(image.size)))
    levels = {}
    for level in range(maximum, -1, -1):
        d = 2 ** (maximum - level)
        size = (math.ceil(image.width / d), math.ceil(image.height / d))
        reduced = image if d == 1 else image.resize(size, Image.Resampling.BOX)
        (out / 'outline_files' / str(level)).mkdir(parents=True, exist_ok=True)
        cols, rows = math.ceil(size[0] / 256), math.ceil(size[1] / 256)
        levels[str(level)] = {'width': size[0], 'height': size[1], 'columns': cols, 'rows': rows}
        for r in range(rows):
            for c in range(cols):
                tile = reduced.crop((max(0, c * 256 - 1), max(0, r * 256 - 1), min(size[0], (c + 1) * 256 + 1), min(size[1], (r + 1) * 256 + 1)))
                if tile.getbbox() is None:                # fully transparent: write nothing, the viewer shows nothing
                    tile = Image.new('RGBA', (1, 1))
                tile.save(out / 'outline_files' / str(level) / f'{c}_{r}.png', optimize=True)
    return {'tile_size': 256, 'overlap': 1, 'format': 'png', 'max_level': maximum, 'levels': levels}


def city_page(name, config, cities, outline=None, tiles=None, fill=None, base='', hitmap=None):
    bundle = ROOT / 'cities' / name
    manifest = json.loads((bundle / 'manifest.json').read_text())
    camera = json.loads((bundle / 'camera.json').read_text())
    buildings = {b['wikidata']: b for b in json.loads((bundle / 'buildings.json').read_text())['buildings'] if b.get('wikidata')}
    lang = config.get('lang', 'de')
    info_file = ROOT / 'info' / f'{name}.{lang}.json'
    info = json.loads(info_file.read_text())['items'] if info_file.exists() else {}
    landmarks = []
    for item in config['landmarks']:
        b = buildings.get(item['wikidata'])
        if not b or 'centre' not in b:
            print(f"warning: {name}: landmark {item['wikidata']} not visible in the bundle"); continue
        i = info.get(item['wikidata'], {})
        landmarks.append({'id': item['id'], 'name': i.get('title') or b.get('name') or item['short_name'], 'short_name': item['short_name'],
                          'x': b['centre'][0], 'y': b['centre'][1], 'view_width': 1024, 'wikidata': item['wikidata'], 'building': b['id'],
                          'category': {c['id']: c['name'] for c in config.get('categories', [])}.get(item.get('category'))})
    tours = []
    tour_file = ROOT / 'config' / f'tours.{name}.json'
    if tour_file.exists():
        by_q = {}
        for b in json.loads((bundle / 'buildings.json').read_text())['buildings']:
            if b.get('wikidata') and 'centre' in b and b['visible_px'] > by_q.get(b['wikidata'], {}).get('visible_px', 0):
                by_q[b['wikidata']] = b
        import hashlib
        key = hashlib.sha256(tour_file.read_bytes() + (bundle / 'walkable.json').read_bytes() + (bundle / 'buildings.json').read_bytes()
                             + (info_file.read_bytes() if info_file.exists() else b'')).hexdigest()
        cache = ROOT / 'config' / f'{name}.walks.json'
        ids = hit_ids(bundle)
        if ids is None and cache.exists() and json.loads(cache.read_text())['key'] == key:
            tours = json.loads(cache.read_text())['tours']           # CI: paths measured locally against the hit map
        else:
            if ids is None: print(f'warning: {name}: no hit map, walk paths drawn without hiding (run the build locally)')
            walk = Walk(bundle, ids)
            for t in json.loads(tour_file.read_text())['tours']:
                stations, previous, at = [], None, None
                for k, st in enumerate(t['stations']):
                    b = by_q.get(st['wikidata'])
                    if not b:
                        print(f"warning: tour {t['id']}: {st['wikidata']} not in bundle"); continue
                    i = info.get(st['wikidata'], {})
                    nm = (i.get('title') or b.get('name') or st['wikidata']).replace(' (Lübeck)', '')
                    station = {'id': f"{t['id']}-{k + 1}", 'name': nm, 'short_name': nm, 'x': b['centre'][0], 'y': b['centre'][1],
                               'view_width': 900, 'building': b['id'], 'blurb': first_sentence(i.get('intro') or ''),
                               'source': i.get('title') and {'title': i['title'], 'url': i.get('url')}}
                    if previous:
                        metres, path = walk.route(previous, b, at); at = walk.end
                        station['leg'] = {'metres': round(metres, -1), 'minutes': max(1, round(metres / 75)), 'path': path}
                    stations.append(station); previous = b
                if len(stations) >= 2:
                    length = sum(s['leg']['metres'] for s in stations[1:])
                    tours.append({'id': t['id'], 'title': t['title'], 'intro': t.get('intro'), 'length_m': length,
                                  'minutes': round(length / 75), 'stations': stations})
            if ids is not None:
                cache.write_text(json.dumps({'key': key, 'tours': tours}, ensure_ascii=False, separators=(',', ':')) + '\n')
    audio_file = ROOT / 'config' / f'{name}.audio.json'
    if audio_file.exists() and (ROOT / 'config' / f'{name}.tiles.json').exists():
        spoken = json.loads(audio_file.read_text())['stations']; root_url = json.loads((ROOT / 'config' / f'{name}.tiles.json').read_text())['base']
        for t in tours:
            for st in t['stations']:
                if st['id'] in spoken:
                    st['audio'] = {v['id']: {'url': root_url + spoken[st['id']][v['id']]['file'], 'seconds': spoken[st['id']][v['id']]['seconds']}
                                   for v in config.get('voices', []) if v['id'] in spoken[st['id']]}
    spoken_buildings = {}
    if audio_file.exists() and (ROOT / 'config' / f'{name}.tiles.json').exists():
        root_url = json.loads((ROOT / 'config' / f'{name}.tiles.json').read_text())['base']
        spoken_buildings = {q: {v: root_url + f for v, f in d.items()} for q, d in json.loads(audio_file.read_text()).get('buildings', {}).items()}
    stones, stones_credit = [], None
    stone_file = ROOT / 'info' / f'{name}.stolpersteine.json'
    if stone_file.exists() and (bundle / 'ground.json').exists():
        import numpy as np
        from pyproj import Transformer
        sdata = json.loads(stone_file.read_text()); ground = json.loads((bundle / 'ground.json').read_text())
        h = np.array(ground['heights_dm'], np.float32).reshape(ground['rows'], ground['columns']) / 10
        tf = Transformer.from_crs(4326, ground['crs'], always_xy=True)
        M = np.array(camera['pixel_matrix'])
        places = {}
        for st in sdata['stones']:
            e, n = tf.transform(st['lon'], st['lat'])
            c = int(round((e - ground['west']) / ground['step_m'])); r = int(round((ground['north'] - n) / ground['step_m']))
            if not (0 <= r < ground['rows'] and 0 <= c < ground['columns']):
                continue
            px, py = M @ [e, n, float(h[r, c]), 1]
            if not (0 <= px < manifest['size'][0] and 0 <= py < manifest['size'][1]):
                continue
            key = (round(st['lat'], 5), round(st['lon'], 5))
            place = places.setdefault(key, {'x': round(float(px), 1), 'y': round(float(py), 1), 'address': st['address'], 'people': []})
            place['people'].append({k: st[k] for k in ('given', 'surname', 'born', 'laid', 'biography')})
        stones = sorted(places.values(), key=lambda p: (p['y'], p['x']))
        stones_credit = sdata['source']
        print(f"{name}: {sum(len(p['people']) for p in stones)} Stolpersteine an {len(stones)} Adressen im Kartenausschnitt")
    credits = manifest['credits']
    data = {'title': config['title'], 'city_id': name, 'width': manifest['size'][0], 'height': manifest['size'][1],
            'status': config.get('status', 'Illustrative pixel-art map from open geodata'),
            'credits': ' · '.join([*credits['attribution'], credits['art'], 'Wikipedia texts: CC BY-SA 4.0 (see each entry)']),
            'licence': 'Map art: non-commercial use only. Geodata: CC BY 4.0. OSM: ODbL. Wikipedia: CC BY-SA 4.0.',
            'camera': camera, 'limitations': config.get('limitations', []), 'landmarks': landmarks,
            'opening_landmark': config.get('opening'), 'navigation': [{'id': c, 'name': t, 'href': f'../{c}/'} for c, t in cities],
            'viewer_tiles': [tiles['map'], tiles['source']], 'art_dir': 'map_files', 'palettes': PALETTES,
            'depth_tiles': dict(tiles['depth'], metres_per_level=(camera.get('depth') or {}).get('metres_per_level', .5)),
            'tours': tours, 'stones': stones, 'stones_source': stones_credit, 'hitmap_tiles': hitmap or manifest['tiles']['hitmap'], 'voices': [{k: v[k] for k in ('id', 'name', 'label', 'credit')} for v in config.get('voices', [])], 'spoken': spoken_buildings, 'default_voice': config.get('default_voice'),
            'tiles_base': base, 'groups': groups_of(name, ROOT / 'cities' / name, {name: config}),
            'places_extra': extra_places(config, bundle, info, groups_of(name, ROOT / 'cities' / name, {name: config})), 'categories': [c['name'] for c in config.get('categories', [])], 'buildings_url': 'buildings.json', 'outline_tiles': outline, 'fill_tiles': fill,
            'info_url': f'../info/{name}.{lang}.json' if info_file.exists() else None,
            'bundle': {'format': manifest['format'], 'files_sha256': manifest['files']}}
    values = {'ART': script_json(base + 'preview-map.webp'), 'SOURCE': script_json(base + 'preview-source.webp'),
              'DATA': script_json(data), 'TITLE': html.escape(config['title'] + ' · Pixel Map')}
    import hashlib
    page = re.sub(r'__(ART|SOURCE|DATA|TITLE)__', lambda m: values[m[1]], TEMPLATE)
    for js in ('info', 'memorial', 'sidebar', 'tours'):                                    # new code is never served from cache
        version = hashlib.sha256((ROOT / f'app/{js}.js').read_bytes()).hexdigest()[:10]
        page = page.replace(f'src="../app/{js}.js"', f'src="../app/{js}.js?v={version}"')
    return page


def make_tiles(name, root, out, configs):
    """Every image the viewer loads for one city: art, raw art, source, depth, hit map, outlines, previews."""
    out.mkdir(parents=True, exist_ok=True)
    shutil.copytree(root / 'hitmap_files', out / 'hitmap_files', dirs_exist_ok=True)   # exact ids: the bundle's PNG tiles
    art = Image.open(root / 'map.png').convert('RGB')
    graded = grade(art, *DEFAULT_GRADE)
    tiles = {'map': pyramid(graded, out / 'map_files'), 'raw': pyramid(art, out / 'raw_files'),
             'source': pyramid(Image.open(root / 'source.png').convert('RGB'), out / 'source_files'),
             'depth': pyramid(Image.open(root / 'depth.png').convert('L'), out / 'depth_files', fmt='png', resample=Image.Resampling.NEAREST)}
    for kind, src in (('map', graded), ('source', Image.open(root / 'source.png').convert('RGB'))):
        p = src.copy(); p.thumbnail((1600, 1600), Image.Resampling.BOX); p.save(out / f'preview-{kind}.webp', 'WEBP', quality=80)
    wanted, groups = outline_ids(name, root, configs), groups_of(name, root, configs)
    outline, fill = outline_tiles(root, out, wanted, groups) if wanted else (None, None)
    return {'tiles': tiles, 'outline': outline, 'fill': fill, 'outline_ids_sha256': ids_digest(wanted, groups),
            'hitmap': json.loads((root / 'manifest.json').read_text())['tiles']['hitmap']}


def outline_ids(name, root, configs):
    """Buildings that open an info panel: those whose Wikidata id has an info entry."""
    lang = configs[name].get('lang', 'de'); info_file = ROOT / 'info' / f'{name}.{lang}.json'
    info = json.loads(info_file.read_text())['items'] if info_file.exists() else {}
    return {b['id'] for b in json.loads((root / 'buildings.json').read_text())['buildings'] if b.get('wikidata') in info}


def ids_digest(ids, groups=()):
    import hashlib
    return hashlib.sha256((','.join(map(str, sorted(ids))) + json.dumps(groups)).encode()).hexdigest()


def main(argv=None):
    import argparse
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--tiles-out', type=Path, help='make the tiles of every city here instead of building pages')
    ap.add_argument('--tiles-base', help='public URL the tiles directory will be served from (with --tiles-out)')
    a = ap.parse_args(argv)
    configs = {p.stem: json.loads(p.read_text()) for p in sorted((ROOT / 'config').glob('*.json')) if '.' not in p.stem}
    cities = [(n, c['title']) for n, c in configs.items() if (ROOT / 'cities' / n / 'manifest.json').exists()]
    if a.tiles_out:
        if not a.tiles_base:
            raise SystemExit('--tiles-out needs --tiles-base')
        for name, _ in cities:
            root = ROOT / 'cities' / name
            tiles_meta = json.loads((root / 'manifest.json').read_text())['tiles']
            version = tiles_meta['map']['image_sha256'][:12] + '-' + tiles_meta['hitmap']['image_sha256'][:6]
            meta = make_tiles(name, root, a.tiles_out / name / version, configs)
            record = {'base': a.tiles_base.rstrip('/') + '/', 'path': f'{name}/{version}/', **meta}
            (ROOT / 'config' / f'{name}.tiles.json').write_text(json.dumps(record, indent=1) + '\n')
            print(f'tiles {name}: {a.tiles_out / name / version}')
        return
    if SITE.exists():
        shutil.rmtree(SITE)
    SITE.mkdir()
    shutil.copytree(ROOT / 'app', SITE / 'app', ignore=shutil.ignore_patterns('*.template.html'))
    if (ROOT / 'info').exists():
        shutil.copytree(ROOT / 'info', SITE / 'info')
    for name, title in cities:
        out = SITE / name
        root = ROOT / 'cities' / name
        out.mkdir()
        for f in ('buildings.json', 'manifest.json', 'camera.json', 'walkable.json', 'landmark-repaints.json'):
            if (root / f).exists(): shutil.copyfile(root / f, out / f)
        remote = ROOT / 'config' / f'{name}.tiles.json'
        if remote.exists():                         # tiles are served from object storage
            meta = json.loads(remote.read_text()); base = meta['base'] + meta['path']
            if meta['outline_ids_sha256'] != ids_digest(outline_ids(name, root, configs), groups_of(name, root, configs)):
                print(f'warning: {name}: info entries changed since the outline tiles were made; remake tiles to update outlines')
        else:                                       # tiles are made into the site
            meta = make_tiles(name, root, out, configs); base = ''
        (out / 'tiles.json').write_text(json.dumps({'base': base}) + '\n')         # for other apps on the same map
        (out / 'index.html').write_text(city_page(name, configs[name], cities, meta['outline'], meta['tiles'], meta['fill'], base, meta['hitmap']))
        (out / 'viewer.html').write_text('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./">'
                                         '<script>location.replace("./"+location.hash)</script><a href="./">Karte öffnen</a>')
        print(f'built {name}' + (f' (tiles from {base})' if base else ''))
    items = ''.join(f'<li><a href="{n}/">{html.escape(t)}</a></li>' for n, t in cities)
    (SITE / 'index.html').write_text(start_page(cities, items))
    (SITE / '.nojekyll').write_text('')
    check_scripts()


GAMES = 'https://hanse-dev.github.io/pixel-map-game/'


def start_page(cities, items):
    """The start page: map, walks, memorial and games of the first city in one place."""
    name = cities[0][0]
    base = json.loads((SITE / name / 'tiles.json').read_text())['base'] or f'{name}/'
    tours = json.loads((ROOT / 'config' / f'tours.{name}.json').read_text())['tours'] if (ROOT / 'config' / f'tours.{name}.json').exists() else []
    icons = {'kirchen': '⛪', 'hanse': '⚓', 'buergerhaeuser': '🏛', 'kloester': '🕯'}
    km = lambda t: f"{t.get('length_m', 0) / 1000:.1f}".replace('.', ',')
    cards = ''.join(f'<a class="card" href="{name}/?tour={html.escape(t["id"])}"><div class="k">{icons.get(t["id"], "🚶")}</div>'
                    f'<h3>{html.escape(t["title"])}</h3><p>{html.escape(t.get("intro") or "")}</p>'
                    f'<span class="tag">Rundgang · {len(t["stations"])} Stationen · {km(t)} km · ca. {round(t.get("length_m", 0) / 75)} Min. Gehzeit</span></a>'
                    for t in tours)
    stones = ''
    page = (SITE / name / 'index.html').read_text()
    sfile = ROOT / 'info' / f'{name}.stolpersteine.json'
    if sfile.exists():
        data = json.loads(re.search(r'const DATA=(.*?), ART=', page, re.S)[1])
        n = sum(len(p['people']) for p in data.get('stones') or [])
        stones = f'{n} Steine an {len(data.get("stones") or [])} Adressen liegen im Kartenausschnitt.' if n else ''
    out = (ROOT / 'app/index.template.html').read_text()
    for k, v in {'__PREVIEW__': html.escape(base + 'preview-map.webp'), '__TOURS__': cards, '__STONES__': stones,
                 '__GAMES__': GAMES, '__CITIES__': items}.items():
        out = out.replace(k, v)
    return out


def check_scripts():
    """Refuse to publish a page whose inline or app script does not parse (needs node; skipped without it)."""
    import shutil, subprocess, tempfile
    if not shutil.which('node'):
        print('warning: node not found, scripts not syntax-checked'); return
    files = list((SITE / 'app').glob('*.js'))
    with tempfile.TemporaryDirectory() as t:
        for page in SITE.glob('*/index.html'):
            for i, code in enumerate(re.findall(r'<script>(.*?)</script>', page.read_text(), re.S)):
                f = Path(t) / f'{page.parent.name}-{i}.js'; f.write_text(code); files.append(f)
        for f in files:
            r = subprocess.run(['node', '--check', str(f)], capture_output=True, text=True)
            if r.returncode:
                raise SystemExit(f'syntax error in {f.name}:\n{r.stderr[:600]}')


if __name__ == '__main__':
    main()
