"""Decorations + UI extraction (imported by extract_assets.py)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *  # noqa: E402,F403

# id, panel, row, col, name, ko, footprint(w,h), cost, townLevel, emoji
DECOR = [
    # trees & plants
    ('tree', 'trees', 0, 0, 'Tree', '나무', (1, 1), 15, 1, '🌳'),
    ('apple_tree', 'trees', 1, 0, 'Apple Tree', '사과나무', (1, 1), 25, 1, '🍎'),
    ('pine', 'trees', 1, 2, 'Pine Tree', '소나무', (1, 1), 18, 1, '🌲'),
    ('palm', 'trees', 1, 3, 'Palm Tree', '야자수', (1, 1), 30, 2, '🌴'),
    ('bush', 'trees', 2, 0, 'Daisy Bush', '들꽃 덤불', (1, 1), 10, 1, '🌿'),
    ('pink_bush', 'trees', 2, 1, 'Pink Bush', '분홍 덤불', (1, 1), 12, 1, '🌺'),
    # flowers
    ('flower', 'flowers', 0, 0, 'Tulips', '튤립', (1, 1), 8, 1, '🌷'),
    ('sunflower', 'flowers', 0, 1, 'Sunflowers', '해바라기', (1, 1), 10, 1, '🌻'),
    ('flowerbed', 'flowers', 0, 3, 'Flower Bed', '꽃밭', (1, 1), 14, 1, '💐'),
    ('lavender', 'flowers', 1, 2, 'Lavender', '라벤더', (1, 1), 12, 1, '🪻'),
    ('daisybox', 'flowers', 1, 1, 'Daisy Box', '데이지 화단', (1, 1), 12, 1, '🌼'),
    ('pot', 'flowers', 2, 0, 'Flower Pot', '화분', (1, 1), 10, 1, '🪴'),
    # furniture
    ('bench', 'furniture', 0, 0, 'Bench', '벤치', (1, 1), 20, 1, '🪑'),
    ('heart_bench', 'furniture', 0, 1, 'Heart Bench', '하트 벤치', (1, 1), 28, 2, '💗'),
    ('blue_bench', 'furniture', 0, 2, 'Blue Bench', '파란 벤치', (1, 1), 24, 1, '💺'),
    # street
    ('lamp', 'street', 0, 0, 'Street Lamp', '가로등', (1, 1), 18, 1, '🏮'),
    ('lamp2', 'street', 0, 1, 'Double Lamp', '쌍둥이 가로등', (1, 1), 24, 1, '💡'),
    ('clock', 'street', 0, 3, 'Town Clock', '시계탑', (1, 1), 50, 2, '🕰️'),
    ('sign', 'street', 1, 2, 'Sign', '장식 표지판', (1, 1), 12, 1, '🪧'),
    ('notice', 'street', 1, 3, 'Notice Board', '게시판', (1, 1), 30, 2, '📋'),
    ('fence', 'street', 2, 0, 'Fence', '울타리', (1, 1), 6, 1, '🚧'),
    ('white_fence', 'street', 2, 1, 'White Fence', '흰 울타리', (1, 1), 6, 1, '🏡'),
    ('hedge_fence', 'street', 2, 2, 'Hedge Fence', '풀 울타리', (1, 1), 8, 1, '🌱'),
    ('stone_fence', 'street', 2, 3, 'Stone Fence', '돌 울타리', (1, 1), 8, 1, '🧱'),
    # structures
    ('fountain', 'structures', 0, 0, 'Fountain', '분수', (2, 2), 60, 2, '⛲'),
    ('fountain2', 'structures', 0, 1, 'Stone Fountain', '돌 분수', (2, 2), 70, 2, '⛲'),
    ('statue', 'structures', 0, 2, 'Small Statue', '작은 조각상', (1, 1), 45, 2, '🗿'),
    ('pond', 'structures', 0, 3, 'Lily Pond', '연못', (2, 2), 50, 2, '🪷'),
    ('arch', 'structures', 1, 0, 'Flower Arch', '꽃 아치', (2, 1), 40, 2, '🌸'),
    ('gazebo', 'structures', 1, 2, 'Gazebo', '정자', (2, 2), 90, 3, '🛖'),
    # playground
    ('slide', 'playground', 0, 0, 'Slide', '미끄럼틀', (2, 2), 80, 3, '🛝'),
    ('seesaw', 'playground', 0, 2, 'Seesaw', '시소', (1, 1), 35, 3, '⚖️'),
    ('duck', 'playground', 1, 0, 'Duck Rider', '오리 흔들이', (1, 1), 30, 3, '🦆'),
    ('rabbit', 'playground', 1, 1, 'Rabbit Rider', '토끼 흔들이', (1, 1), 30, 3, '🐰'),
    ('whale', 'playground', 1, 2, 'Whale Rider', '고래 흔들이', (1, 1), 30, 3, '🐳'),
    ('sandbox', 'playground', 1, 3, 'Sandbox', '모래놀이터', (2, 1), 45, 3, '🏖️'),
    # farm
    ('garden', 'farm', 0, 0, 'Veggie Garden', '텃밭', (1, 1), 25, 1, '🥕'),
    ('cabbage', 'farm', 0, 1, 'Cabbage Patch', '양배추 밭', (1, 1), 25, 1, '🥬'),
    ('corn', 'farm', 0, 3, 'Corn Field', '옥수수 밭', (1, 1), 25, 1, '🌽'),
    ('apple_box', 'farm', 1, 0, 'Apple Basket', '사과 바구니', (1, 1), 18, 1, '🍎'),
    ('pumpkin', 'farm', 1, 2, 'Pumpkin Basket', '호박 바구니', (1, 1), 18, 1, '🎃'),
    # misc
    ('mailbox', 'misc', 0, 0, 'Mailbox', '우체통', (1, 1), 20, 1, '📮'),
    ('pawsign', 'misc', 0, 1, 'Paw Sign', '발바닥 표지판', (1, 1), 12, 1, '🐾'),
    ('chalkboard', 'misc', 0, 2, 'Chalkboard', '칠판 간판', (1, 1), 16, 1, '📝'),
    ('bike', 'misc', 1, 0, 'Bicycle', '자전거', (1, 1), 28, 1, '🚲'),
    ('vending', 'misc', 1, 1, 'Vending Machine', '자판기', (1, 1), 40, 2, '🥤'),
    ('gumball', 'misc', 1, 2, 'Gumball Machine', '뽑기 기계', (1, 1), 30, 2, '🍬'),
    ('bin', 'misc', 1, 3, 'Trash Bin', '쓰레기통', (1, 1), 10, 1, '🗑️'),
]
CATEGORY = {'trees': 'plants', 'flowers': 'flowers', 'furniture': 'furniture', 'street': 'street', 'structures': 'structures', 'playground': 'play', 'farm': 'farm', 'misc': 'misc'}
PANELS = {
    'trees': ((12, 135, 366, 428), 4, 3), 'flowers': ((388, 135, 744, 428), 4, 3), 'furniture': ((764, 135, 1114, 428), 3, 4),
    'street': ((1134, 135, 1490, 428), 4, 3), 'structures': ((12, 478, 430, 742), 4, 3), 'playground': ((446, 478, 798, 742), 4, 2),
    'farm': ((814, 478, 1150, 742), 4, 2), 'misc': ((1170, 478, 1492, 742), 4, 2),
}
# Furniture panel items are packed on a different grid; those marked clean were verified by eye.


def drop_specks(img, keep=0.06):
    """Remove stray pixel islands left over from neighbouring panel items."""
    a = np.array(img)
    lab, n = ndi.label(a[:, :, 3] > 0, structure=np.ones((3, 3)))
    if n > 1:
        sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1))
        bad = [i + 1 for i, sz in enumerate(sizes) if sz < keep * sizes.max()]
        for b in bad:
            a[lab == b] = 0
    return Image.fromarray(a)


def trim(img):
    img = drop_specks(img)
    bb = img.getbbox()
    c = img.crop(bb)
    out = Image.new('RGBA', (c.size[0] + 4, c.size[1] + 4))
    out.paste(c, (2, 2))
    return out


def decorations(manifest, report, review, write_defs=False):
    im = load('decorations-sheet')
    from_cell = {}
    for name, (box, cols, rows) in PANELS.items():
        x0, y0, x1, y1 = box
        cw, ch = (x1 - x0) / cols, (y1 - y0) / rows
        for r in range(rows):
            for c in range(cols):
                cell = (int(x0 + c * cw), int(y0 + r * ch), int(x0 + (c + 1) * cw), int(y0 + (r + 1) * ch))
                res = cutout(im, cell, thr=48, dil=2, min_area=250, erode=1)
                if res:
                    res.sort(key=lambda t: -t[0].size[0] * t[0].size[1])
                    from_cell[(name, r, c)] = trim(res[0][0])
    out, items, defs = {}, [], []
    for (did, panel, r, c, name, ko, fp, cost, lvl, emoji) in DECOR:
        img = from_cell.get((panel, r, c))
        if img is None:
            report['skipped'].append(f'decoration {did}: no sprite found in {panel} {r},{c}')
            continue
        w = img.size[0]
        scale = round(min(1.6, max(1.25, fp[0] * 64 * 0.95 / w)), 2)
        rel = f'decorations/{CATEGORY[panel]}/{did}.png'
        (OUT / rel).parent.mkdir(parents=True, exist_ok=True)
        img.save(OUT / rel, optimize=True)
        out[did] = {'file': rel, 'w': img.size[0], 'h': img.size[1], 'ox': 0.5, 'oy': 1.0, 'scale': scale}
        items.append(img)
        defs.append({'id': did, 'name': name, 'ko': ko, 'category': CATEGORY[panel], 'footprint': {'w': fp[0], 'h': fp[1]}, 'cost': cost, 'townLevel': lvl, 'emoji': emoji})
    manifest['decorations'] = out
    contact(items, 12, 100, review / 'decorations.png', bg=(70, 90, 110, 255))
    report['ok'].append(f'decorations: {len(out)} sprites')
    if write_defs:
        p = ROOT / 'src' / 'content' / 'decorations.json'
        p.write_text(json.dumps(defs, ensure_ascii=False, indent=1), encoding='utf-8')
        report['ok'].append(f'decorations.json rewritten with {len(defs)} entries')


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
