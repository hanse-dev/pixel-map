#!/usr/bin/env python3
"""Fetch short Wikipedia summaries for every building in a map bundle that has a Wikidata id.

Run locally when the bundle changes; the result is committed so the site builds offline.
  python3 scripts/fetch_info.py cities/luebeck --lang de

Writes info/<city>.<lang>.json: Wikidata id -> title, summary, article URL, licence, retrieval time.
Texts are Wikipedia content under CC BY-SA 4.0 and must be shown with that attribution.
Requests carry an identifying User-Agent and are paced to stay well within Wikimedia's API etiquette.
"""
import argparse, json, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

UA = 'pixel-map/1 (https://github.com/hanse-dev/pixel-map; static map info, few requests)'


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('bundle', type=Path); ap.add_argument('--lang', default='de')
    a = ap.parse_args()
    buildings = json.loads((a.bundle / 'buildings.json').read_text())['buildings']
    qids = sorted({b['wikidata'] for b in buildings if b.get('wikidata')})
    site = f'{a.lang}wiki'
    titles = {}
    for i in range(0, len(qids), 50):                      # Wikidata: sitelinks for up to 50 items per call
        chunk = qids[i:i + 50]
        q = urllib.parse.urlencode({'action': 'wbgetentities', 'ids': '|'.join(chunk), 'props': 'sitelinks|labels',
                                    'sitefilter': site, 'languages': a.lang, 'format': 'json'})
        data = get('https://www.wikidata.org/w/api.php?' + q)['entities']
        for qid, ent in data.items():
            link = ent.get('sitelinks', {}).get(site)
            titles[qid] = (link['title'] if link else None, ent.get('labels', {}).get(a.lang, {}).get('value'))
        time.sleep(1)
    info = {}
    for qid in qids:
        title, label = titles.get(qid, (None, None))
        entry = {'wikidata': qid, 'label': label, 'wikidata_url': f'https://www.wikidata.org/wiki/{qid}'}
        if title:
            try:
                s = get(f'https://{a.lang}.wikipedia.org/api/rest_v1/page/summary/' + urllib.parse.quote(title.replace(' ', '_'), safe=''))
                entry.update(title=s.get('title', title), summary=s.get('extract'), url=s.get('content_urls', {}).get('desktop', {}).get('page'),
                             licence='CC BY-SA 4.0', attribution=f"Wikipedia, „{s.get('title', title)}“, CC BY-SA 4.0")
            except Exception as error:                      # keep the label and link; report the gap
                entry['error'] = str(error)[:200]
            time.sleep(.5)
        info[qid] = entry
        print(qid, entry.get('title') or label or '-', file=sys.stderr)
    out = a.bundle.parent.parent / 'info' / f'{a.bundle.name}.{a.lang}.json'
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({'retrieved': datetime.now(timezone.utc).isoformat(timespec='seconds'), 'lang': a.lang,
                               'source': 'Wikidata sitelinks and Wikipedia REST summaries', 'items': info},
                              ensure_ascii=False, indent=1) + '\n')
    print(json.dumps({'items': len(info), 'with_summary': sum(1 for v in info.values() if v.get('summary')), 'out': str(out)}))


if __name__ == '__main__':
    main()
