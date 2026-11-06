"""In-game NPC sprites from npc-ingame.png (3 x 4 cards, reading order = ROLES).

Each card has a small strip: front stand | down-walk x2 | left x2 | right x2 | back. The walk frames of several residents
are drawn as OTHER characters (e.g. Ms. Rose walking as a chef), so only the front stand pose is used (the back pose sits on a differently tinted box and is not needed: residents stand still).
They stand still in the town (walking is switched off), which is all that is needed.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *  # noqa: E402,F403
from decor_items import drop_specks  # noqa: E402

ROLES = ['guide', 'baker', 'teacher', 'grocer', 'cook', 'librarian', 'doctor', 'postman', 'petshop', 'ranger', 'stylist', 'mayor']
COL_X = [8, 383, 758]
ROW_Y = [5, 195, 383, 572]
FRONT = (90, 56, 128, 118)    # card-relative box of the front stand pose
TARGET = 38                   # logical px tall on the map


def biggest(rgb, box):
    res = cutout(rgb, box, thr=34, dil=2, min_area=200, erode=0)
    if not res:
        return None
    res.sort(key=lambda t: -t[0].size[0] * t[0].size[1])
    img = drop_specks(res[0][0], keep=0.15)  # card lines / shadow bits are tiny compared with the character
    bb = img.getbbox()
    return img.crop(bb) if bb else None


def run(manifest, report, review, out_root):
    rgb = load('npc-ingame').convert('RGB')
    npcs, items = {}, []
    for idx, role in enumerate(ROLES):
        cx, cy = COL_X[idx % 3], ROW_Y[idx // 3]
        front = biggest(rgb, (cx + FRONT[0], cy + FRONT[1], cx + FRONT[2], cy + FRONT[3]))
        if front is None or front.size[1] < 30:
            report['skipped'].append(f'npc {role}: front pose not found')
            continue
        poses = {'down': front}
        H = max(p.size[1] for p in poses.values())
        W = max(p.size[0] for p in poses.values())
        scale = round(TARGET * 2 / H, 3)
        npcs[role] = {}
        for d, p in poses.items():
            c = Image.new('RGBA', (W, H))
            c.paste(p, ((W - p.size[0]) // 2, H - p.size[1]))
            rel = f'characters/npcs/{role}/{d}_0.png'
            path = out_root / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            c.save(path, optimize=True)
            npcs[role][d] = [{'file': rel, 'w': W, 'h': H, 'ox': 0.5, 'oy': 1.0, 'scale': scale}]
            items.append(c)
    manifest['npcs'] = npcs
    report['ok'].append(f'npc in-game sprites: {len(npcs)} of 12 (front stand pose)')
    return items
