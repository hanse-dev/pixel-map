#!/usr/bin/env python3
"""Build the static site into _site/ from the map bundles in cities/ and the app in app/.

  python3 scripts/build.py            # then: python3 -m http.server -d _site 8000

Each city needs cities/<name>/ (a map bundle from isometric-cities `atlas.py bundle`) and
config/<name>.json (title, landmark Wikidata ids, opening landmark). info/<name>.<lang>.json is
optional; without it buildings still open with name and links, just without Wikipedia text.
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


def outline_tiles(bundle, out, wanted):
    """Gold outlines of the buildings that open an info panel, as an RGBA Deep Zoom pyramid."""
    import numpy as np
    from scipy import ndimage as ndi
    rgb = np.asarray(Image.open(bundle / 'hitmap.png').convert('RGB')).astype(np.uint32)
    ids = rgb[..., 0] | (rgb[..., 1] << 8) | (rgb[..., 2] << 16)
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
    return pyramid(image, out / 'outline_files', fmt='png')
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


def city_page(name, config, cities, outline=None, tiles=None):
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
                          'x': b['centre'][0], 'y': b['centre'][1], 'view_width': 1024, 'wikidata': item['wikidata']})
    credits = manifest['credits']
    data = {'title': config['title'], 'city_id': name, 'width': manifest['size'][0], 'height': manifest['size'][1],
            'status': config.get('status', 'Illustrative pixel-art map from open geodata'),
            'credits': ' · '.join([*credits['attribution'], credits['art'], 'Wikipedia texts: CC BY-SA 4.0 (see each entry)']),
            'licence': 'Map art: non-commercial use only. Geodata: CC BY 4.0. OSM: ODbL. Wikipedia: CC BY-SA 4.0.',
            'camera': camera, 'limitations': config.get('limitations', []), 'landmarks': landmarks,
            'opening_landmark': config.get('opening'), 'navigation': [{'id': c, 'name': t, 'href': f'../{c}/'} for c, t in cities],
            'viewer_tiles': [tiles['map'], tiles['source']], 'art_dir': 'map_files', 'palettes': PALETTES,
            'depth_tiles': dict(tiles['depth'], metres_per_level=(camera.get('depth') or {}).get('metres_per_level', .5)),
            'hitmap_tiles': manifest['tiles']['hitmap'], 'buildings_url': 'buildings.json', 'outline_tiles': outline,
            'info_url': f'../info/{name}.{lang}.json' if info_file.exists() else None,
            'bundle': {'format': manifest['format'], 'files_sha256': manifest['files']}}
    values = {'ART': script_json('preview-map.webp'), 'SOURCE': script_json('preview-source.webp'),
              'DATA': script_json(data), 'TITLE': html.escape(config['title'] + ' · Pixel Map')}
    import hashlib
    version = hashlib.sha256((ROOT / 'app/info.js').read_bytes()).hexdigest()[:10]
    page = re.sub(r'__(ART|SOURCE|DATA|TITLE)__', lambda m: values[m[1]], TEMPLATE)
    return page.replace('src="../app/info.js"', f'src="../app/info.js?v={version}"')   # new code is never served from cache


def main():
    if SITE.exists():
        shutil.rmtree(SITE)
    SITE.mkdir()
    shutil.copytree(ROOT / 'app', SITE / 'app', ignore=shutil.ignore_patterns('*.template.html'))
    if (ROOT / 'info').exists():
        shutil.copytree(ROOT / 'info', SITE / 'info')
    configs = {p.stem: json.loads(p.read_text()) for p in sorted((ROOT / 'config').glob('*.json'))}
    cities = [(n, c['title']) for n, c in configs.items() if (ROOT / 'cities' / n / 'manifest.json').exists()]
    for name, title in cities:
        out = SITE / name
        root = ROOT / 'cities' / name
        out.mkdir()
        for f in ('buildings.json', 'manifest.json', 'camera.json', 'walkable.json', 'landmark-repaints.json'):
            if (root / f).exists(): shutil.copyfile(root / f, out / f)
        shutil.copytree(root / 'hitmap_files', out / 'hitmap_files')      # exact ids: keep the bundle's PNG tiles
        art = Image.open(root / 'map.png').convert('RGB')
        tiles = {'map': pyramid(grade(art, *DEFAULT_GRADE), out / 'map_files'), 'raw': pyramid(art, out / 'raw_files'),
                 'source': pyramid(Image.open(root / 'source.png').convert('RGB'), out / 'source_files'),
                 'depth': pyramid(Image.open(root / 'depth.png').convert('L'), out / 'depth_files', fmt='png', resample=Image.Resampling.NEAREST)}
        for kind, src in (('map', grade(art, *DEFAULT_GRADE)), ('source', Image.open(root / 'source.png').convert('RGB'))):
            p = src.copy(); p.thumbnail((1600, 1600), Image.Resampling.BOX); p.save(out / f'preview-{kind}.webp', 'WEBP', quality=80)
        lang = configs[name].get('lang', 'de'); info_file = ROOT / 'info' / f'{name}.{lang}.json'
        info = json.loads(info_file.read_text())['items'] if info_file.exists() else {}
        wanted = {b['id'] for b in json.loads((root / 'buildings.json').read_text())['buildings'] if b.get('wikidata') in info}
        outline = outline_tiles(root, out, wanted) if wanted else None
        (out / 'index.html').write_text(city_page(name, configs[name], cities, outline, tiles))
        (out / 'viewer.html').write_text('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./">'
                                         '<script>location.replace("./"+location.hash)</script><a href="./">Karte öffnen</a>')
        print(f'built {name}')
    items = ''.join(f'<li><a href="{n}/">{html.escape(t)}</a></li>' for n, t in cities)
    (SITE / 'index.html').write_text((ROOT / 'app/index.template.html').read_text().replace('__CITIES__', items))
    (SITE / '.nojekyll').write_text('')


if __name__ == '__main__':
    main()
