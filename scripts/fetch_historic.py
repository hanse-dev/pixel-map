#!/usr/bin/env python3
"""Historic photos and pictures of the buildings with a Wikipedia entry, from Wikimedia Commons'
category "Historical images of Lübeck" (and its subcategories): dated before 1950, freely licensed,
and naming the building in the file name or description. Thumbnails are linked, not copied.

  python3 scripts/fetch_historic.py luebeck
"""
import json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

UA = 'pixel-map/1 (https://github.com/hanse-dev/pixel-map; static map info, few requests)'
ROOT = Path(__file__).resolve().parents[1]
city = sys.argv[1]
info = json.loads((ROOT / 'info' / f'{city}.de.json').read_text())['items']
FREE = ('public domain', 'cc0', 'cc by', 'cc-by', 'pd')


def api(**q):
    u = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({**q, 'format': 'json', 'formatversion': 2})
    for attempt in range(4):
        try: return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': UA}), timeout=60).read())
        except Exception: time.sleep(5 * (attempt + 1))
    return {}


def words(name):
    name = re.sub(r'\s*\(.*?\)', '', name)
    return [w for w in re.findall(r'[A-Za-zÄÖÜäöüß][\wäöüß-]{3,}', name) if w.lower() not in ('lübeck', 'lübecker', 'kirche', 'haus', 'museum')] or [name]


out = {}
for q, item in info.items():
    name = (item.get('title') or item.get('label') or '').replace(' (Lübeck)', '')
    key = words(name)
    r = api(action='query', generator='search', gsrsearch=f'"{name}" deepcat:"Historical images of Lübeck" filetype:bitmap', gsrnamespace=6, gsrlimit=30,
            prop='imageinfo', iiprop='extmetadata|url', iiurlwidth=640,
            iiextmetadatafilter='DateTimeOriginal|LicenseShortName|Artist|ImageDescription|ObjectName')
    keep = []
    for p in r.get('query', {}).get('pages', []):
        ii = p['imageinfo'][0]; m = ii['extmetadata']
        val = lambda k: re.sub(r'<[^>]+>', '', m.get(k, {}).get('value', '')).strip()
        y = re.search(r'\b(1[4-9]\d\d)\b', val('DateTimeOriginal'))
        lic = val('LicenseShortName')
        text = p['title'] + ' ' + val('ImageDescription') + ' ' + val('ObjectName')
        if not y or int(y[1]) >= 1950 or not lic.lower().startswith(FREE): continue
        if not all(w.lower() in text.lower() for w in key[:2]): continue
        keep.append({'year': int(y[1]), 'file': p['title'], 'page': ii['descriptionurl'], 'thumb': ii['thumburl'],
                     'author': re.sub(r'\s+', ' ', val('Artist'))[:120] or 'unbekannt', 'licence': lic,
                     'caption': re.sub(r'\s+', ' ', val('ImageDescription'))[:200]})
    for k in keep:
        a = re.sub(r'(?i)unknown author', 'unbekannt', k['author']); half = len(a) // 2
        k['author'] = a[:half] if a[:half] == a[half:] else a          # Commons sometimes repeats the name
    seen, unique = set(), []
    for k in sorted(keep, key=lambda k: k['year']):
        if k['file'].endswith('.tif') or (k['year'], k['author']) in seen: continue
        seen.add((k['year'], k['author'])); unique.append(k)
    keep = unique[:6]
    if keep: out[q] = keep
    time.sleep(.3)
(ROOT / 'info' / f'{city}.historic.json').write_text(json.dumps({'source': 'Wikimedia Commons, Kategorie „Historical images of Lübeck“',
    'items': out}, ensure_ascii=False, indent=1) + '\n')
print({'buildings_with_photos': len(out), 'photos': sum(len(v) for v in out.values())})
