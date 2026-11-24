#!/usr/bin/env python3
"""Official LoD2 building models (LVermGeo SH, CityGML 1.0) to a glTF scene of one district: the
buildings inside the district polygon (roofs and walls), the terrain from the bundle's ground grid,
and water from OSM. Each building is matched to the pixel map's building (OSM footprint) so a click
can show the same information. Writes OUT.glb and OUT.json (triangle ranges -> map building id).

  python3 scripts/lod2_gltf.py OUT DISTRICT.json BUNDLE OSM.json TILE.xml [TILE.xml ...]

Buildings: ©GeoBasis-DE/LVermGeo SH/CC BY 4.0 (Quelle verändert). Water: © OpenStreetMap contributors.
"""
import json, sys, xml.etree.ElementTree as ET
from pathlib import Path
import numpy as np, mapbox_earcut as earcut, trimesh
from shapely.geometry import shape, Point, Polygon
from shapely.strtree import STRtree
from pyproj import Transformer

NS = {'gml': 'http://www.opengis.net/gml', 'bldg': 'http://www.opengis.net/citygml/building/1.0'}
COLOURS = {'RoofSurface': [176, 70, 48], 'WallSurface': [214, 186, 156], 'GroundSurface': [150, 150, 150]}
out, district, bundle, osm_path, tiles = sys.argv[1], sys.argv[2], Path(sys.argv[3]), sys.argv[4], sys.argv[5:]
area = shape(json.load(open(district))['utm']); clip = area.buffer(15)
to_utm = Transformer.from_crs(4326, 25832, always_xy=True)
osm = json.load(open(osm_path))['elements']

# pixel-map buildings by OSM footprint, for clicks
recs = {b['osm']: b for b in json.loads((bundle / 'buildings.json').read_text())['buildings']}
polys, ids = [], []
for e in osm:
    k = f"{e['type']}/{e['id']}"
    if k in recs and 'geometry' in e and len(e['geometry']) > 3:
        xs, ys = to_utm.transform([p['lon'] for p in e['geometry']], [p['lat'] for p in e['geometry']])
        try: polys.append(Polygon(zip(xs, ys)).buffer(0)); ids.append(recs[k]['id'])
        except Exception: pass
tree = STRtree(polys)


def tri(ring):
    pts = np.asarray(ring, np.float64)
    n = np.zeros(3)
    for a, b in zip(pts, np.roll(pts, -1, 0)):
        n += [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]
    if len(pts) < 3 or np.linalg.norm(n) < 1e-9: return None
    two = np.delete(pts, int(np.argmax(np.abs(n))), axis=1)
    t = earcut.triangulate_float64(two, np.array([len(two)], np.uint32))
    return t.reshape(-1, 3) if len(t) else None


V, F, C, ranges = [], [], [], []
def add(v, t, colour):
    base = sum(len(x) for x in V); V.append(v); F.append(t + base); C.append(np.tile(list(colour) + [255], (len(v), 1)))
nb = 0
for path in tiles:
    for b in ET.parse(path).getroot().iter('{%s}Building' % NS['bldg']):
        rings = [(kind, np.array(pl.text.split(), float).reshape(-1, 3)[:-1]) for kind in COLOURS
                 for s in b.iter('{%s}%s' % (NS['bldg'], kind)) for pl in s.iter('{%s}posList' % NS['gml'])]
        if not rings: continue
        allp = np.concatenate([r for _, r in rings]); c = Point(allp[:, 0].mean(), allp[:, 1].mean())
        if not clip.contains(c): continue
        hit = [ids[i] for i in tree.query(c) if polys[i].contains(c)]
        f0 = sum(len(f) for f in F)
        for kind, r in rings:
            t = tri(r)
            if t is not None: add(r, t, COLOURS[kind])
        ranges.append([f0, sum(len(f) for f in F), hit[0] if hit else 0, b.get('{http://www.opengis.net/gml}id')]); nb += 1

# terrain from the bundle ground grid, inside the district (10 m cells)
g = json.loads((bundle / 'ground.json').read_text()); h = np.array(g['heights_dm'], np.float32).reshape(g['rows'], g['columns']) / 10
x0, y0, x1, y1 = clip.bounds; s = g['step_m']
c0, c1 = int((x0 - g['west']) / s) - 1, int((x1 - g['west']) / s) + 2; r0, r1 = int((g['north'] - y1) / s) - 1, int((g['north'] - y0) / s) + 2
gx = g['west'] + np.arange(c0, c1) * s; gy = g['north'] - np.arange(r0, r1) * s
GX, GY = np.meshgrid(gx, gy); GZ = h[r0:r1, c0:c1] - .3
wpolys = []
for e in osm:
    t = e.get('tags', {})
    if (t.get('natural') == 'water' or t.get('waterway') == 'riverbank') and 'geometry' in e and len(e['geometry']) > 3:
        xs, ys = to_utm.transform([p['lon'] for p in e['geometry']], [p['lat'] for p in e['geometry']])
        try: wpolys.append(Polygon(zip(xs, ys)).buffer(8))
        except Exception: pass
wtree = STRtree(wpolys)
for i in range(GX.shape[0]):                     # sink the terrain under water so the water surface stays clean
    for j in range(GX.shape[1]):
        pt = Point(GX[i, j], GY[i, j])
        if any(wpolys[k].contains(pt) for k in wtree.query(pt)): GZ[i, j] = min(GZ[i, j], -1.5)
gv = np.stack([GX.ravel(), GY.ravel(), GZ.ravel()], 1); nr, nc = GX.shape
gf = [[i * nc + j, (i + 1) * nc + j, i * nc + j + 1] for i in range(nr - 1) for j in range(nc - 1)] + \
     [[i * nc + j + 1, (i + 1) * nc + j, (i + 1) * nc + j + 1] for i in range(nr - 1) for j in range(nc - 1)]
add(gv, np.array(gf), [200, 192, 172])
# water (OSM), flat a little below the lowest quay
for e in osm:
    t = e.get('tags', {})
    if not (t.get('natural') == 'water' or t.get('waterway') == 'riverbank') or 'geometry' not in e or len(e['geometry']) < 4: continue
    xs, ys = to_utm.transform([p['lon'] for p in e['geometry']], [p['lat'] for p in e['geometry']])
    poly = Polygon(zip(xs, ys)).buffer(0).intersection(clip.buffer(150))
    for p in getattr(poly, 'geoms', [poly]):
        if p.is_empty or p.geom_type != 'Polygon': continue
        ring = np.array(p.exterior.coords)[:-1]
        t2 = earcut.triangulate_float64(ring[:, :2], np.array([len(ring)], np.uint32))
        if len(t2): add(np.c_[ring[:, :2], np.full(len(ring), .4)], t2.reshape(-1, 3)[:, ::-1], [64, 110, 150])
origin = np.array([area.centroid.x, area.centroid.y, 0])
Vall = np.concatenate(V) - origin; Vall = Vall[:, [0, 2, 1]] * [1, 1, -1]
mesh = trimesh.Trimesh(Vall, np.concatenate(F), vertex_colors=np.concatenate(C).astype(np.uint8), process=False)
mesh.export(out + '.glb')
json.dump({'origin_utm': origin[:2].round(2).tolist(), 'buildings': ranges,
           'credits': 'Gebäudemodelle (LoD2): ©GeoBasis-DE/LVermGeo SH/CC BY 4.0 (Quelle verändert) · Wasser: © OpenStreetMap-Mitwirkende'},
          open(out + '.json', 'w'), separators=(',', ':'))
print({'buildings': nb, 'matched': sum(1 for r in ranges if r[2]), 'triangles': len(mesh.faces), 'mb': round(Path(out + '.glb').stat().st_size / 1e6, 1)})
