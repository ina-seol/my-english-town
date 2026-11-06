"""Decorations + UI extraction (imported by extract_assets.py)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *  # noqa: E402,F403

import decor_items


def trim(img):
    return decor_items.trim(img)


def decorations(manifest, report, review, write_defs=False):
    decor_items.decorations(manifest, report, review, write_defs)


def ui(manifest, report, review):
    im = load('ui-assets')
    ui_m, items = {}, []

    def put(key, img):
        img = trim(img)
        rel = f'ui/{key}.png'
        (OUT / rel).parent.mkdir(parents=True, exist_ok=True)
        img.save(OUT / rel, optimize=True)
        ui_m[key] = {'file': rel, 'w': img.size[0], 'h': img.size[1]}
        items.append(img)

    def region(box, thr=40, min_area=120):
        res = cutout(im, box, thr=thr, dil=2, min_area=min_area, erode=1)
        return sorted(res, key=lambda t: (round(t[1][1] / 50), t[1][0]))

    status = [t for t in region((880, 525, 1524, 590)) if t[0].size[0] < 80 and t[0].size[1] > 30]
    for key, t in zip(['coin', 'gem', 'star', 'heart', 'energy', 'key', 'leaf', 'mail', 'gear'], status):
        put(key, t[0])
    if len(status) < 9:
        report['skipped'].append(f'ui status icons: found {len(status)} of 9')
    # nav glyphs: three are stand-alone glyphs, three sit inside labelled squares (take the glyph part)
    menu = region((315, 525, 858, 642))
    squares = [t for t in menu if t[0].size[0] > 75 and t[0].size[1] > 80]
    glyphs = [t for t in menu if 40 < t[0].size[0] < 60 and t[0].size[1] > 38]
    named = {}
    if len(squares) >= 6:
        for key, t in zip(['home', 'build', 'shop', None, 'bag_sq', None, 'map_sq'][:0], []):
            pass
    sq = {k: t for k, t in zip(['home', 'build', 'shop', 'quest', 'bag', 'map'], squares)}
    for key in ('home', 'build', 'shop'):
        if key in sq:
            img = sq[key][0]
            w, h = img.size
            inner = img.crop((8, 6, w - 8, int(h * 0.62)))
            res = cutout(inner.convert('RGBA'), (0, 0, inner.size[0], inner.size[1]), thr=46, dil=1, min_area=150, erode=0)
            if res:
                res.sort(key=lambda t: -t[0].size[0] * t[0].size[1])
                put(f'nav_{key}', res[0][0])
    for key, t in zip(['nav_quest', 'nav_bag', 'nav_map'], glyphs):
        put(key, t[0])
    # panel frames
    for key, t in zip(['frame_blue', 'frame_awning', 'frame_pink', 'frame_wood'], [t for t in region((10, 672, 528, 935), min_area=2000)]):
        put(key, t[0])
    manifest['ui'] = ui_m
    contact(items, 10, 110, review / 'ui.png', bg=(70, 90, 110, 255))
    report['ok'].append(f'ui: {len(ui_m)} images ({", ".join(ui_m)})')


def run(manifest, report, review):
    decorations(manifest, report, review, write_defs='--write-defs' in sys.argv)
    ui(manifest, report, review)
