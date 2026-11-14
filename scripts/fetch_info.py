#!/usr/bin/env python3
"""Fetch building information for every building in a map bundle that has a Wikidata id.

Run locally when the bundle changes; results are committed so the site builds offline.
  python3 scripts/fetch_info.py cities/luebeck --lang de

Writes info/<city>.<lang>.json and info/img/<city>/<Q>.jpg:
- Wikipedia: the article's whole introduction (plain text), title and URL - CC BY-SA 4.0
- Wikidata facts: heritage status, inception, architectural style, architect, official website - CC0
- Wikimedia Commons: the item's main image as a 640 px thumbnail with author, licence and file page;
  files without a known free licence are skipped
Requests carry an identifying User-Agent and are paced, within Wikimedia's API etiquette.
"""
import argparse, html, json, re, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

UA = 'pixel-map/1 (https://github.com/hanse-dev/pixel-map; static map info, few requests)'
FACTS = {'P1435': 'heritage', 'P149': 'style', 'P84': 'architect'}
FREE = re.compile(r'^(CC0|CC BY(-SA)? [0-9.]+( [a-z]{2})?|Public domain|PD.*|GFDL.*|Attribution|Copyrighted free use)$', re.I)


def get(url, binary=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*' if binary else 'application/json'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            return data if binary else json.loads(data.decode())
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 2:
                raise
            time.sleep(10 * (attempt + 1))


def api(host, **params):
    return get(f'https://{host}/w/api.php?' + urllib.parse.urlencode({**params, 'format': 'json', 'formatversion': 2}))


def plain(markup):
    text = html.unescape(re.sub(r'<[^>]+>', ' ', markup or ''))
    return re.sub(r'\s+', ' ', re.sub(r'\[\d+\]', '', text)).strip()


def year(claim):
    t = claim['mainsnak'].get('datavalue', {}).get('value', {})
    m = re.match(r'([+-])(\d+)-(\d\d)-(\d\d)', t.get('time', ''))
    if not m:
        return None
    y = int(m[2]) * (-1 if m[1] == '-' else 1)
    precision = t.get('precision', 9)
    return f'{y // 100 + 1}. Jh.' if precision == 7 else f'{y}er' if precision == 8 else str(y)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('bundle', type=Path); ap.add_argument('--lang', default='de')
    a = ap.parse_args()
    city, lang = a.bundle.name, a.lang
    root = a.bundle.parent.parent
    buildings = json.loads((a.bundle / 'buildings.json').read_text())['buildings']
    qids = sorted({b['wikidata'] for b in buildings if b.get('wikidata')})
    site = f'{lang}wiki'
    entities = {}
    for i in range(0, len(qids), 50):
        entities.update(api('www.wikidata.org', action='wbgetentities', ids='|'.join(qids[i:i + 50]),
                            props='sitelinks|labels|claims', sitefilter=site, languages=lang)['entities'])
        time.sleep(1)
    # labels of the items that facts point to (heritage classes, styles, architects)
    refs = sorted({c['mainsnak']['datavalue']['value']['id'] for e in entities.values() for p in FACTS
                   for c in e.get('claims', {}).get(p, []) if c['mainsnak'].get('datavalue')})
    labels = {}
    for i in range(0, len(refs), 50):
        for q, e in api('www.wikidata.org', action='wbgetentities', ids='|'.join(refs[i:i + 50]), props='labels', languages=f'{lang}|en')['entities'].items():
            labels[q] = (e.get('labels', {}).get(lang) or e.get('labels', {}).get('en') or {}).get('value')
        time.sleep(1)
    img_dir = root / 'info' / 'img' / city
    img_dir.mkdir(parents=True, exist_ok=True)
    info = {}
    for qid in qids:
        e = entities.get(qid, {})
        claims = e.get('claims', {})
        entry = {'wikidata': qid, 'label': e.get('labels', {}).get(lang, {}).get('value'),
                 'wikidata_url': f'https://www.wikidata.org/wiki/{qid}'}
        facts = {}
        for p, key in FACTS.items():
            values = [labels.get(c['mainsnak']['datavalue']['value']['id']) for c in claims.get(p, []) if c['mainsnak'].get('datavalue')]
            if any(values):
                facts[key] = [v for v in dict.fromkeys(values) if v]
        built = [year(c) for c in claims.get('P571', [])] + [year(c) for c in claims.get('P1619', [])]
        if any(built):
            facts['built'] = next(b for b in built if b)
        site_url = [c['mainsnak']['datavalue']['value'] for c in claims.get('P856', []) if c['mainsnak'].get('datavalue')]
        if site_url:
            facts['website'] = site_url[0]
        if facts:
            entry['facts'] = facts
        title = e.get('sitelinks', {}).get(site, {}).get('title')
        if title:
            try:
                page = api(f'{lang}.wikipedia.org', action='query', prop='extracts|info', exintro=1, explaintext=1,
                           inprop='url', titles=title)['query']['pages'][0]
                intro = re.sub(r'\n{2,}', '\n\n', (page.get('extract') or '').strip())
                entry.update(title=page.get('title', title), intro=intro, url=page.get('fullurl'),
                             licence='CC BY-SA 4.0', attribution=f"Wikipedia, „{page.get('title', title)}“, CC BY-SA 4.0")
            except Exception as error:
                entry['error'] = str(error)[:200]
            time.sleep(.5)
        image = [c['mainsnak']['datavalue']['value'] for c in claims.get('P18', []) if c['mainsnak'].get('datavalue')]
        if image:
            try:
                pages = api('commons.wikimedia.org', action='query', prop='imageinfo', iiprop='url|extmetadata', iiurlwidth=640,
                            titles='File:' + image[0])['query']['pages']
                ii = pages[0]['imageinfo'][0]; meta = ii.get('extmetadata', {})
                licence = plain(meta.get('LicenseShortName', {}).get('value'))
                if FREE.match(licence):
                    out = img_dir / f'{qid}.jpg'
                    out.write_bytes(get(ii['thumburl'], binary=True))
                    entry['image'] = {'src': f'img/{city}/{qid}.jpg', 'author': plain(meta.get('Artist', {}).get('value')) or 'unbekannt',
                                      'licence': licence, 'licence_url': meta.get('LicenseUrl', {}).get('value'),
                                      'file': ii['descriptionurl'], 'width': ii.get('thumbwidth'), 'height': ii.get('thumbheight')}
                else:
                    entry['image_skipped'] = f'licence not recognised as free: {licence or "none"}'
            except Exception as error:
                entry['image_error'] = str(error)[:200]
            time.sleep(.5)
        info[qid] = entry
        print(qid, entry.get('title') or entry.get('label') or '-', '| Bild' if 'image' in entry else '', file=sys.stderr)
    out = root / 'info' / f'{city}.{lang}.json'
    out.write_text(json.dumps({'retrieved': datetime.now(timezone.utc).isoformat(timespec='seconds'), 'lang': lang,
                               'source': 'Wikidata (CC0), Wikipedia introductions (CC BY-SA 4.0), Wikimedia Commons thumbnails (per-file licence)',
                               'items': info}, ensure_ascii=False, indent=1) + '\n')
    print(json.dumps({'items': len(info), 'with_intro': sum(1 for v in info.values() if v.get('intro')),
                      'with_image': sum(1 for v in info.values() if v.get('image')),
                      'with_facts': sum(1 for v in info.values() if v.get('facts')), 'out': str(out)}))


if __name__ == '__main__':
    main()
