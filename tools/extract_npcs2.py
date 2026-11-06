"""In-game NPC sprites: public/assets/original/npc-ingame-large.png (12 full-body residents on a transparent background,
4 columns x 3 rows, reading order = ROLES). Each resident is one connected piece; they are scaled down with a smooth filter
to twice their on-map size (so the game shows them 1:2 crisp instead of shrinking a big image with nearest-neighbour)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *  # noqa: E402,F403

ROLES = ['guide', 'baker', 'teacher', 'grocer', 'cook', 'librarian', 'doctor', 'postman', 'petshop', 'ranger', 'stylist', 'mayor']
TARGET = 38          # logical px tall on the map
PX_HEIGHT = TARGET * 2


def comp_image(im, c):
    x0, y0, x1, y1 = c['box']
    crop = np.array(im.crop(c['box']))
    crop[:, :, 3] = np.where(c['lab'][y0:y1, x0:x1] == c['label'], crop[:, :, 3], 0)
    return Image.fromarray(crop)


def run(manifest, report, review, out_root):
    im = load('npc-ingame-large')
    comps = components(np.array(im)[:, :, 3] > 40, 4000)
    if len(comps) != 12:
        report['skipped'].append(f'npc in-game sheet: found {len(comps)} residents, expected 12')
        manifest['npcs'] = {}
        return []
    comps.sort(key=lambda c: (round(c['y'] / 300), c['x']))
    npcs, items = {}, []
    for role, c in zip(ROLES, comps):
        img = comp_image(im, c)
        img = img.crop(img.getbbox())
        w = max(1, round(img.size[0] * PX_HEIGHT / img.size[1]))
        img = img.resize((w, PX_HEIGHT), Image.LANCZOS)
        rel = f'characters/npcs/{role}/down_0.png'
        path = out_root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        img.save(path, optimize=True)
        npcs[role] = {'down': [{'file': rel, 'w': img.size[0], 'h': img.size[1], 'ox': 0.5, 'oy': 1.0, 'scale': 1.0}]}
        items.append(img)
    manifest['npcs'] = npcs
    report['ok'].append(f'npc in-game sprites: {len(npcs)} of 12 (full body, front)')
    return items
