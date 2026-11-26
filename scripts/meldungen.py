#!/usr/bin/env python3
"""Open map error reports (GitHub issues labelled "Kartenfehler"), grouped by painting area.

    scripts/meldungen.py          all open reports, area by area
    scripts/meldungen.py --neu    only reports and comments since the last --neu run (one line, for status updates)

Reads GITHUB_REPORT_TOKEN and GITHUB_REPORT_REPO from ~/.config/pixel-map/report.env.
"""
import json, os, re, sys, urllib.request
from collections import defaultdict
from pathlib import Path

ENV = Path.home() / '.config/pixel-map/report.env'
SEEN = Path.home() / '.config/pixel-map/meldungen-gesehen.json'


def env():
    values = {}
    for line in ENV.read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            values[k.strip()] = v.strip()
    if not values.get('GITHUB_REPORT_TOKEN') or not values.get('GITHUB_REPORT_REPO'):
        sys.exit(f'GITHUB_REPORT_TOKEN / GITHUB_REPORT_REPO fehlen in {ENV}')
    return values


def issues(values):
    request = urllib.request.Request(
        f"https://api.github.com/repos/{values['GITHUB_REPORT_REPO']}/issues?state=open&labels=Kartenfehler&per_page=100",
        headers={'Authorization': f"Bearer {values['GITHUB_REPORT_TOKEN']}", 'Accept': 'application/vnd.github+json', 'User-Agent': 'pixel-map-meldungen'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def main():
    found = issues(env())
    if '--neu' in sys.argv:
        seen = json.loads(SEEN.read_text()) if SEEN.exists() else {}
        new = [i for i in found if seen.get(str(i['number'])) != i['comments']]
        SEEN.write_text(json.dumps({str(i['number']): i['comments'] for i in found}))
        print(f"{len(new)} neue Meldungen" + (': ' + '; '.join(f"#{i['number']} {i['title']}" for i in new) if new else ''))
        return
    areas = defaultdict(list)
    for i in found:
        area = next((l['name'] for l in i['labels'] if l['name'].startswith('Bereich ')), 'ohne Bereich')
        point = re.search(r'<!-- stelle:(\d+),(\d+)', i['body'] or '')
        areas[area].append((i, point.groups() if point else None))
    for area in sorted(areas):
        print(area)
        for i, point in areas[area]:
            print(f"  #{i['number']} {i['title']}  ({1 + i['comments']} Meldung{'en' if i['comments'] else ''})"
                  + (f"  Punkt {point[0]},{point[1]}" if point else '') + f"\n     {i['html_url']}")
    if not found:
        print('keine offenen Meldungen')


if __name__ == '__main__':
    main()
