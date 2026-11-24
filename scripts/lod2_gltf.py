#!/usr/bin/env python3
"""Official LoD2 building models (LVermGeo SH, CityGML 1.0) to one glTF binary for a 3D view:
walls in brick tones, roofs coloured like the pixel map, ground at the measured height.

  python3 scripts/lod2_gltf.py OUT.glb TILE.xml [TILE.xml ...]

© GeoBasis-DE/LVermGeo SH/CC BY 4.0 (Quelle verändert).
"""
import sys, xml.etree.ElementTree as ET
import numpy as np, mapbox_earcut as earcut, trimesh

NS = {'gml': 'http://www.opengis.net/gml', 'bldg': 'http://www.opengis.net/citygml/building/1.0'}
COLOURS = {'RoofSurface': [176, 70, 48], 'WallSurface': [214, 186, 156], 'GroundSurface': [140, 140, 140]}
out, tiles = sys.argv[1], sys.argv[2:]
verts, faces, cols, origin, n_buildings = [], [], [], None, 0


def triangulate(ring):
    pts = np.asarray(ring, np.float64)
    if len(pts) < 3: return None
    n = np.cross(pts[1] - pts[0], pts[2] - pts[0])
    for k in range(2, len(pts) - 1):                      # a robust normal from the polygon (Newell)
        pass
    n = np.zeros(3)
    for a, b in zip(pts, np.roll(pts, -1, 0)):
        n += [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]
    if np.linalg.norm(n) < 1e-9: return None
    drop = int(np.argmax(np.abs(n)))
    two = np.delete(pts, drop, axis=1)
    tri = earcut.triangulate_float64(two, np.array([len(two)], np.uint32))
    return tri.reshape(-1, 3) if len(tri) else None


for path in tiles:
    root = ET.parse(path).getroot()
    for b in root.iter('{%s}Building' % NS['bldg']):
        n_buildings += 1
        for kind in COLOURS:
            for surf in b.iter('{%s}%s' % (NS['bldg'], kind)):
                for pl in surf.iter('{%s}posList' % NS['gml']):
                    v = np.array(pl.text.split(), float).reshape(-1, 3)[:-1]
                    if origin is None: origin = v.min(0)
                    tri = triangulate(v)
                    if tri is None: continue
                    base = sum(len(x) for x in verts)
                    verts.append(v - origin); faces.append(tri + base)
                    cols.append(np.tile(COLOURS[kind] + [255], (len(v), 1)))
V = np.concatenate(verts); F = np.concatenate(faces)
C = np.concatenate(cols).astype(np.uint8)
V = V[:, [0, 2, 1]] * [1, 1, -1]                          # east, up, south: glTF is y-up
mesh = trimesh.Trimesh(V, F, vertex_colors=C, process=False)
mesh.export(out)
print({'buildings': n_buildings, 'triangles': len(F), 'origin_utm': origin.round(2).tolist(), 'out': out})
