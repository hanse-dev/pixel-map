#!/usr/bin/env python3
"""Fetch the Stolpersteine of a city from its Wikipedia list (name, birth year, address, coordinates,
year laid, link to the biography of the local initiative).

  python3 scripts/fetch_stolpersteine.py luebeck "Liste der Stolpersteine in Lübeck"

Writes info/<city>.stolpersteine.json. Biographies are not copied: they belong to the initiative and
are linked. The list itself is Wikipedia content (CC BY-SA 4.0) and is credited with its revision.
"""
import json, re, sys, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

UA = 'pixel-map/1 (https://github.com/hanse-dev/pixel-map; static map info, few requests)'
city, page = sys.argv[1], sys.argv[2]
u = 'https://de.wikipedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'parse', 'page': page, 'prop': 'wikitext|revid', 'format': 'json', 'formatversion': 2})
r = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': UA}), timeout=60).read())['parse']
wiki, rev = r['wikitext'], r['revid']


def clean(t):
    t = re.sub(r'<!--.*?-->', '', t, flags=re.S)
    t = re.sub(r'<div.*?</div>', '', t, flags=re.S)
    t = re.sub(r'<ref.*?(</ref>|/>)', '', t, flags=re.S)
    t = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', t)
    return re.sub(r'\s+', ' ', re.sub(r"'{2,}", '', t)).strip()


stones = []
for row in wiki.split('\n|-')[1:]:
    cells = [c for c in re.split(r'\n\|\s*', '\n' + row.split('\n|}')[0]) if c.strip()]
    if len(cells) < 4:
        continue
    coord = re.search(r'NS=([\d.]+)\|EW=([\d.]+)', row)
    first = re.search(r'\{\{Stolperstein HL\|([^|}]+)\|([^}]+)\}\}', cells[1])
    if not coord or not first:
        continue
    laid = re.search(r'verlegt:\s*(\d{4})', row)
    stones.append({'surname': clean(cells[0]), 'given': clean(first[2]), 'born': clean(cells[2]) or None,
                   'address': clean(cells[3]), 'lat': float(coord[1]), 'lon': float(coord[2]),
                   'laid': int(laid[1]) if laid else None,
                   'biography': f'https://www.stolpersteine-luebeck.de/stolperstein/{first[1].strip()}'})
out = Path(__file__).resolve().parents[1] / 'info' / f'{city}.stolpersteine.json'
out.write_text(json.dumps({'retrieved': datetime.now(timezone.utc).isoformat(timespec='seconds'),
                           'source': f'https://de.wikipedia.org/w/index.php?title={urllib.parse.quote(page.replace(" ", "_"))}&oldid={rev}',
                           'attribution': f'Wikipedia, „{page}“, CC BY-SA 4.0; Daten der Initiative „Stolpersteine für Lübeck“',
                           'stones': stones}, ensure_ascii=False, indent=1) + '\n')
print(json.dumps({'stones': len(stones), 'out': str(out)}))
