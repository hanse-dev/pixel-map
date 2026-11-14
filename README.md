# Pixel Map

Isometric pixel-art city maps built from open geodata, with buildings you can click for their Wikipedia summary.
Illustrative, not survey-grade. Live: https://hanse-dev.github.io/pixel-map/

## Layout

| Path | What |
|---|---|
| `cities/<city>/` | map bundle from [isometric-cities](https://github.com/hanse-dev/isometric-cities) (`atlas.py bundle`): tiles, hit map, buildings, streets, camera |
| `config/<city>.json` | title, landmark list (Wikidata ids), opening view, known limits |
| `info/<city>.<lang>.json` | Wikipedia summaries fetched by `scripts/fetch_info.py` (CC BY-SA 4.0) |
| `app/` | viewer template, click-to-info script, start page |
| `scripts/build.py` | builds `_site/`; GitHub Actions publishes it to Pages on every push |

Local preview: `python3 scripts/build.py && python3 -m http.server -d _site 8000` (needs Pillow).
Update texts after a new bundle: `python3 scripts/fetch_info.py cities/luebeck --lang de`.

## Credits and licences

- Contains GeoBasis-DE/LVermGeo SH data: bDOM20 (2023, rendered at 0.4 m), DGM1 (2022), DOP20 (2025), CC BY 4.0.
- © OpenStreetMap contributors, ODbL.
- Map art painted locally with FLUX.2 Klein 9B (FLUX Non-Commercial licence) and Pixel Art Redmond (Apache-2.0). **Non-commercial use only.**
- Building texts: Wikipedia, CC BY-SA 4.0, attributed in each info panel.
- Facades, windows and landmark details are illustrative. Holstentor, Rathaus, Katharinenkirche, Burgtor and Salzspeicher were repainted individually; see `cities/luebeck/landmark-repaints.json`.
