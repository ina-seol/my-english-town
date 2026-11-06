"""Per-character walk sheets (public/assets/original/sheet-*.png) -> players/cN/<dir>_<i>.png + manifest entries."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *  # noqa: E402,F403

DIRS = ['down', 'left', 'right', 'up']
# character id -> (sheet name, how to find the 4 walk rows)
#   rows:   {dir: row index}            (rows found by clustering components)
#   split:  {dir: (row index, slice)}   (Harin has two directions in one row)
SHEETS = {
    'c1': {'sheet': 'jun', 'rows': {'down': 0, 'left': 1, 'right': 2, 'up': 3}},
    'c2': {'sheet': 'minseo', 'rows': {'down': 0, 'left': 1, 'right': 2, 'up': 3}},
    'c3': {'sheet': 'jiho', 'rows': {'down': 0, 'left': 1, 'right': 2, 'up': 3}},
    'c4': {'sheet': 'sua', 'rows': {'down': 0, 'left': 1, 'right': 2, 'up': 3}},
    'c5': {'sheet': 'harin', 'alpha': 220, 'split': {'down': (0, slice(0, 4)), 'left': (0, slice(4, 8)), 'right': (1, slice(0, 4)), 'up': (1, slice(4, 8))}},
    'c6': {'sheet': 'doyun', 'rows': {'down': 1, 'left': 2, 'right': 3, 'up': 4}},
}
TARGET = 38  # logical px tall on the map


def comp_image(im, c):
    x0, y0, x1, y1 = c['box']
    crop = np.array(im.crop(c['box']))
    crop[:, :, 3] = np.where(c['lab'][y0:y1, x0:x1] == c['label'], crop[:, :, 3], 0)
    return Image.fromarray(crop)


def frames_for(cid, spec):
    im = load(f"sheet-{spec['sheet']}")
    a = np.array(im)
    thr = spec.get('alpha', 60)
    comps = components(a[:, :, 3] > thr, 1500 if cid != 'c5' else 800)
    rows = cluster_rows(comps, 60 if cid != 'c5' else 50)
    out = {}
    if 'rows' in spec:
        for d, r in spec['rows'].items():
            out[d] = [comp_image(im, c) for c in rows[r]]
    else:
        for d, (r, sl) in spec['split'].items():
            out[d] = [comp_image(im, c) for c in rows[r][sl]]
    return out


def run(manifest, report, review, out_root):
    players, sheet_items, left_right = {}, [], []
    for cid, spec in SHEETS.items():
        frames = frames_for(cid, spec)
        sizes = {d: len(f) for d, f in frames.items()}
        allf = [f for fs in frames.values() for f in fs]
        W = max(f.size[0] for f in allf)
        H = max(f.size[1] for f in allf)
        scale = round(TARGET * 2 / H, 3)
        players[cid] = {}
        for d, fs in frames.items():
            canvas = []
            for f in fs:
                c = Image.new('RGBA', (W, H))
                c.paste(f, ((W - f.size[0]) // 2, H - f.size[1]))  # feet on the same line, centred
                canvas.append(c)
            players[cid][d] = []
            for i, c in enumerate(canvas):
                rel = f'characters/players/{cid}/{d}_{i}.png'
                p = out_root / rel
                p.parent.mkdir(parents=True, exist_ok=True)
                c.save(p, optimize=True)
                players[cid][d].append({'file': rel, 'w': c.size[0], 'h': c.size[1], 'ox': 0.5, 'oy': 1.0, 'scale': scale})
            sheet_items.append(canvas[0])
        left_right += [players[cid]['left'][0], players[cid]['right'][0]]
        report['ok'].append(f'player {cid} ({spec["sheet"]}): frames/dir {sizes}')
    manifest['players'] = players
    return sheet_items
