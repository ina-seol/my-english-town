"""
Extracts game-ready PNGs from the 7 composite art sheets in public/assets/original/
and writes public/assets/manifest.json.

Run:  python tools/extract_assets.py        (needs numpy, scipy, Pillow)

The sheets are composites (labels, panels, backgrounds), so each sheet is handled by
the method that fits it: alpha components (terrain, buildings) or background cut-out
(characters, NPCs, decorations, UI). Contact sheets for review go to tools/_review/.
"""
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *  # noqa: E402,F403

REVIEW = ROOT / 'tools' / '_review'
REVIEW.mkdir(exist_ok=True)
PX = 64  # source pixels per logical 32px tile used by the manifest (render scale = 32 / PX)

manifest = {'version': 1, 'pxPerTile': PX}
report = {'ok': [], 'skipped': []}


def save(img, rel):
    p = OUT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    img.save(p, optimize=True)
    return rel


def ref(img, rel, **kw):
    r = {'file': save(img, rel), 'w': img.size[0], 'h': img.size[1]}
    r.update(kw)
    return r


def comp_image(im, c):
    x0, y0, x1, y1 = c['box']
    crop = np.array(im.crop(c['box']))
    crop[:, :, 3] = np.where(c['lab'][y0:y1, x0:x1] == c['label'], crop[:, :, 3], 0)
    return Image.fromarray(crop)


# ------------------------------------------------------------------ terrain
def terrain():
    im = load('terrain-tileset')
    a = np.array(im)
    comps = components(a[:, :, 3] > 40, 1500)
    rows = cluster_rows(comps, 30)
    tiles = [[comp_image(im, c) for c in r] for r in rows]
    t = {}

    def inner(img, m=13):
        w, h = img.size
        return img.crop((m, m, w - m, h - m)).resize((PX, PX), Image.LANCZOS)

    t['grass'] = [ref(inner(tiles[0][i]), f'terrain/grass/grass_{i}.png') for i in range(5)]
    t['flowerGrass'] = [ref(inner(tiles[1][i]), f'terrain/grass/flower_{i}.png') for i in range(5)]
    t['water'] = [ref(inner(tiles[4][i], 9), f'terrain/water/water_{i}.png') for i in range(3)]

    # Road tiles (rows 2 = dirt, 3 = stone share one layout). Mask order is N,E,S,W (1 = road reaches that edge).
    # Read off the sheet by eye: straights, cross, T with grass on top, three corner pieces, T with branch up.
    ROAD_MASK = {0: '0101', 1: '1010', 2: '1111', 3: '0111', 4: '0110', 5: '1010', 6: '0111', 7: '1101', 8: '1100', 9: '0111', 10: '0110'}

    def autotile(row, folder):
        found = {}
        for idx, img in enumerate(tiles[row]):
            found.setdefault(ROAD_MASK[idx], img.resize((PX, PX), Image.LANCZOS))
        changed = True
        while changed:  # derive missing orientations: mirror and rotate what exists
            changed = False
            for m, sq in list(found.items()):
                n, e, s, w = m
                derived = (
                    (sq.transpose(Image.FLIP_LEFT_RIGHT), f"{n}{w}{s}{e}"),
                    (sq.transpose(Image.FLIP_TOP_BOTTOM), f"{s}{e}{n}{w}"),
                    (sq.transpose(Image.ROTATE_270), f"{w}{n}{e}{s}"),  # 90 degrees clockwise
                )
                for img, fm in derived:
                    if fm not in found:
                        found[fm] = img
                        changed = True
        return {m: ref(sq, f'terrain/paths/{folder}_{m}.png') for m, sq in sorted(found.items())}

    t['dirt'] = autotile(2, 'dirt')
    t['stone'] = autotile(3, 'stone')
    # bridges (wooden planks) for later use
    for i, img in enumerate(tiles[6]):
        save(img, f'terrain/bridges/bridge_{i}.png')
    manifest['terrain'] = t
    items = [Image.open(OUT / r['file']) for r in t['grass'] + t['flowerGrass'] + t['water']] + [Image.open(OUT / r['file']) for r in t['dirt'].values()]
    contact(items, 9, 80, REVIEW / 'terrain.png', bg=(190, 120, 190, 255))
    report['ok'].append(f"terrain: {len(t['grass'])} grass, {len(t['flowerGrass'])} flower, {len(t['water'])} water, dirt masks {sorted(t['dirt'])}")


# ------------------------------------------------------------------ buildings
BUILDING_GRID = [  # (row band, column group) -> building id, in sheet order
    ['house', 'school', 'bakery'],
    ['market', 'restaurant', 'library'],
    ['hospital', 'park', 'pet-shop'],
    ['clothing-shop', 'post-office', 'town-hall'],
]
# game ids used by src/content/buildings.json
GAME_ID = {'pet-shop': 'petshop', 'clothing-shop': 'clothing', 'post-office': 'post', 'town-hall': 'townhall'}


def buildings():
    im = load('buildings-sheet')
    a = np.array(im)
    comps = [c for c in components(a[:, :, 3] > 40, 600) if c['h'] > 70 and c['y'] > 60]
    groups = {}
    for c in comps:
        bottom = c['y'] + c['h']
        row = 0 if bottom <= 250 else 1 if bottom <= 480 else 2 if bottom <= 710 else 3
        col = min(2, (c['x'] + c['w'] // 2) // 512)
        groups.setdefault((row, col), []).append(c)
    out, review = {}, []
    for (row, col), cs in sorted(groups.items()):
        name = BUILDING_GRID[row][col]
        cs.sort(key=lambda c: c['x'])
        if len(cs) != 3:
            report['skipped'].append(f'building {name}: found {len(cs)} sprites, expected 3')
            continue
        gid = GAME_ID.get(name, name)
        out[gid] = {}
        for lv, c in enumerate(cs, 1):
            img = comp_image(im, c)
            bbox = img.getbbox()
            img = img.crop(bbox)
            padded = Image.new('RGBA', (img.size[0] + 4, img.size[1] + 4))
            padded.paste(img, (2, 2))
            out[gid][str(lv)] = ref(padded, f'buildings/{name}/lv{lv}.png', ox=0.5, oy=1.0, scale=1.35)
            review.append(padded)
    manifest['buildings'] = out
    contact(review, 9, 150, REVIEW / 'buildings.png', bg=(190, 215, 190, 255))
    report['ok'].append(f"buildings: {len(out)} types x 3 levels")


# ------------------------------------------------------------------ players / npcs
def normalise_frames(frames):
    """Pad frames to one common canvas, bottom-centre aligned so feet stay put."""
    W = max(f.size[0] for f in frames)
    H = max(f.size[1] for f in frames)
    outs = []
    for f in frames:
        canvas = Image.new('RGBA', (W, H))
        canvas.paste(f, ((W - f.size[0]) // 2, H - f.size[1]))
        outs.append(canvas)
    return outs


def players():
    im = load('player-characters')
    walk = cutout(im, (130, 370, 525, 770), thr=36, min_area=2500)
    cols = cutout(im, (548, 419, 1185, 770), thr=36, min_area=2500)
    if len(walk) != 16 or len(cols) != 24:
        report['skipped'].append(f'players: unexpected counts walk={len(walk)} colors={len(cols)}')
        return
    dirs = ['down', 'left', 'right', 'up']
    walk = sorted(walk, key=lambda w: (round(w[1][1] / 100), w[1][0]))
    cols = sorted(cols, key=lambda w: (round(w[1][1] / 85), w[1][0]))
    TARGET = 36  # logical px tall
    players_m, review = {}, []
    for ci in range(6):
        cid = f'c{ci + 1}'
        players_m[cid] = {}
        if ci == 0:  # Jun has real 4-frame walk cycles in all four directions
            groups = {d: [walk[di * 4 + k][0] for k in range(4)] for di, d in enumerate(dirs)}
        else:
            groups = {d: [cols[di * 6 + ci][0]] for di, d in enumerate(dirs)}
        allf = [f for g in groups.values() for f in g]
        W = max(f.size[0] for f in allf); H = max(f.size[1] for f in allf)
        scale = round(TARGET * 2 / H, 3)
        for d, frames in groups.items():
            canvas = []
            for f in frames:
                c = Image.new('RGBA', (W, H)); c.paste(f, ((W - f.size[0]) // 2, H - f.size[1])); canvas.append(c)
            players_m[cid][d] = [ref(c, f'characters/players/{cid}/{d}_{i}.png', ox=0.5, oy=1.0, scale=scale) for i, c in enumerate(canvas)]
            review += canvas
    manifest['players'] = players_m
    contact(review, 12, 100, REVIEW / 'players.png', bg=(60, 90, 110, 255))
    report['ok'].append('players: 6 characters x 4 directions (c1 Jun has 4 walk frames/direction, others 1 stand pose/direction)')


NPC_ROLES = ['guide', 'baker', 'teacher', 'grocer', 'cook', 'librarian', 'doctor', 'postman', 'petshop', 'ranger', 'stylist', 'mayor']
NPC_NAMES = ['Ms. Rose', 'Mr. Baker', 'Ms. Emma', 'Mr. Lee', 'Ms. Cook', 'Ms. Book', 'Dr. Green', 'Mr. Post', 'Ms. Pet', 'Mr. Park', 'Ms. Style', 'Mayor Brown']
# existing game NPC ids -> art role (ids are kept so saved games stay valid)
NPC_ALIAS = {'mia': 'guide', 'emma': 'baker'}


def token_from_portrait(p):
    """Overworld marker for residents that only have a bust: round badge + ground shadow."""
    w, h = p.size
    face = p.crop((0, 0, w, min(h, w)))
    S = 84
    face = face.resize((S - 12, S - 12), Image.LANCZOS)
    tok = Image.new('RGBA', (S, S + 20))
    d = ImageDraw.Draw(tok)
    d.ellipse((6, S - 4, S - 6, S + 14), fill=(0, 0, 0, 55))
    d.ellipse((0, 0, S - 1, S - 1), fill=(138, 90, 60, 255))
    d.ellipse((3, 3, S - 4, S - 4), fill=(255, 248, 231, 255))
    m = Image.new('L', (S - 12, S - 12), 0)
    ImageDraw.Draw(m).ellipse((0, 0, S - 13, S - 13), fill=255)
    fa = face.copy()
    fa.putalpha(Image.composite(face.getchannel('A'), Image.new('L', face.size, 0), m))
    tok.alpha_composite(fa, (6, 6))
    return tok


def npcs():
    im = load('npc-characters')
    xs = [8, 258, 506, 755, 1003, 1252]
    ys = [85, 335]
    portraits = []
    for r, y in enumerate(ys):
        for c, x in enumerate(xs):
            res = cutout(im, (x + 2, y + 2, x + 132, y + 160), thr=60, min_area=3000, erode=1)
            res.sort(key=lambda t: -t[0].size[0] * t[0].size[1])
            if not res:
                report['skipped'].append(f'npc portrait {r},{c}')
                portraits.append(None)
            else:
                portraits.append(res[0][0])
    por, npc_m = {}, {}
    review = []
    for i, role in enumerate(NPC_ROLES):
        p = portraits[i]
        if p is None:
            continue
        por[role] = ref(p, f'characters/npcs/{role}/portrait.png', ox=0.5, oy=1.0)
        tok = token_from_portrait(p)
        npc_m[role] = {'down': [ref(tok, f'characters/npcs/{role}/token.png', ox=0.5, oy=0.86, scale=0.62)]}
        review.append(p)
    # Mr. Baker has a real 4-direction walk cycle
    base = cutout(im, (110, 650, 500, 970), thr=36, min_area=1500)
    base = [b for b in base if b[0].size[0] < 80]
    if len(base) == 16:
        base = sorted(base, key=lambda t: (round(t[1][1] / 80), t[1][0]))
        dirs = ['down', 'left', 'right', 'up']
        frames = {d: [base[di * 4 + k][0] for k in range(4)] for di, d in enumerate(dirs)}
        W = max(f.size[0] for g in frames.values() for f in g); H = max(f.size[1] for g in frames.values() for f in g)
        scale = round(36 * 2 / H, 3)
        npc_m['baker'] = {}
        for d, fs in frames.items():
            cs = []
            for f in fs:
                c = Image.new('RGBA', (W, H)); c.paste(f, ((W - f.size[0]) // 2, H - f.size[1])); cs.append(c)
            npc_m['baker'][d] = [ref(c, f'characters/npcs/baker/{d}_{i}.png', ox=0.5, oy=1.0, scale=scale) for i, c in enumerate(cs)]
            review += cs
        report['ok'].append('npc baker: full 4-direction walk frames')
    else:
        report['skipped'].append(f'npc baker walk frames: found {len(base)} (expected 16); using token')
    for alias, role in NPC_ALIAS.items():
        if role in npc_m:
            npc_m[alias] = npc_m[role]
        if role in por:
            por[alias] = por[role]
    manifest['npcs'] = npc_m
    manifest['portraits'] = por
    contact(review, 10, 110, REVIEW / 'npcs.png', bg=(60, 90, 110, 255))
    report['ok'].append(f'npcs: {len([r for r in NPC_ROLES if r in por])} portraits; world sprite = token (bust badge) except baker')


# ------------------------------------------------------------------ title
def title():
    im = Image.open(ORIG / 'main-title.png').convert('RGB')
    p = OUT / 'title' / 'main-title.webp'
    p.parent.mkdir(parents=True, exist_ok=True)
    im.save(p, 'WEBP', quality=78, method=6)
    manifest['title'] = {'file': 'title/main-title.webp', 'w': im.size[0], 'h': im.size[1]}
    report['ok'].append(f'title: {im.size} -> webp {p.stat().st_size // 1024} KB')


def runtime_files():
    """(texture key, file) for every sprite the Phaser scene uses. Mirrors listImages() in manifest.ts."""
    m = manifest
    out = []
    t = m.get('terrain', {})
    out += [(f't:grass:{i}', r['file'], 'terrain') for i, r in enumerate(t.get('grass', []))]
    out += [(f't:flower:{i}', r['file'], 'terrain') for i, r in enumerate(t.get('flowerGrass', []))]
    out += [(f't:water:{i}', r['file'], 'terrain') for i, r in enumerate(t.get('water', []))]
    out += [(f't:dirt:{k}', r['file'], 'terrain') for k, r in t.get('dirt', {}).items()]
    out += [(f't:stone:{k}', r['file'], 'terrain') for k, r in t.get('stone', {}).items()]
    for bid, lv in m.get('buildings', {}).items():
        out += [(f'b:{bid}:{l}', r['file'], 'buildings') for l, r in lv.items()]
    out += [(f'd:{did}', r['file'], 'decor') for did, r in m.get('decorations', {}).items()]
    for kind, grp in (('p', m.get('players', {})), ('n', m.get('npcs', {}))):
        for cid, dirs in grp.items():
            for d, refs in dirs.items():
                out += [(f'{kind}:{cid}:{d}:{i}', r['file'], 'chars') for i, r in enumerate(refs)]
    return out


def build_atlases():
    import pack_atlas
    by_atlas = {}
    for key, file, atlas in runtime_files():
        by_atlas.setdefault(atlas, {}).setdefault(file, []).append(key)
    shutil.rmtree(OUT / 'atlas', ignore_errors=True)
    infos = []
    for atlas, files in by_atlas.items():
        entries = [(keys, Image.open(OUT / f).convert('RGBA')) for f, keys in files.items()]
        info = pack_atlas.write_atlas(OUT, atlas, entries)
        infos.append(info)
        report['ok'].append(f"atlas {atlas}: {info['frames']} frames, {info['size'][0]}x{info['size'][1]}")
    manifest['atlases'] = [{'key': i['key'], 'image': i['image'], 'data': i['data']} for i in infos]


def run():
    for sub in ('terrain', 'buildings', 'characters', 'title', 'decorations', 'ui'):
        shutil.rmtree(OUT / sub, ignore_errors=True)
    terrain(); buildings(); players(); npcs(); title()
    import extract_decor_ui
    extract_decor_ui.run(manifest, report, REVIEW)
    build_atlases()
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=1), encoding='utf-8')
    print(json.dumps(report, indent=1, ensure_ascii=False))


if __name__ == '__main__':
    run()
