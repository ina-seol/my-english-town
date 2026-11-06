"""Decoration props: found as WHOLE connected pieces in each panel of decorations-sheet.png (so nothing is cut at a grid line)."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *  # noqa: E402,F403

# id, panel, index in the panel (props sorted top-to-bottom then left-to-right), name, ko, footprint (w, h), cost, townLevel, emoji
DECOR = [
    ('tree', 'trees', 0, 'Tree', '나무', (1, 1), 15, 1, '🌳'),
    ('cherry_tree', 'trees', 1, 'Cherry Tree', '벚나무', (1, 1), 28, 1, '🌸'),
    ('autumn_tree', 'trees', 2, 'Autumn Tree', '단풍나무', (1, 1), 28, 2, '🍂'),
    ('snow_tree', 'trees', 3, 'Snowy Tree', '눈 쌓인 나무', (1, 1), 28, 2, '❄️'),
    ('apple_tree', 'trees', 4, 'Apple Tree', '사과나무', (1, 1), 25, 1, '🍎'),
    ('orange_tree', 'trees', 5, 'Orange Tree', '귤나무', (1, 1), 25, 1, '🍊'),
    ('pine', 'trees', 6, 'Pine Tree', '소나무', (1, 1), 18, 1, '🌲'),
    ('palm', 'trees', 7, 'Palm Tree', '야자수', (1, 1), 30, 2, '🌴'),
    ('bush', 'trees', 8, 'Daisy Bush', '들꽃 덤불', (1, 1), 10, 1, '🌿'),
    ('pink_bush', 'trees', 9, 'Pink Bush', '분홍 덤불', (1, 1), 12, 1, '🌺'),
    ('hedge_bush', 'trees', 10, 'Green Bush', '초록 덤불', (1, 1), 8, 1, '🌱'),
    ('flower', 'flowers', 0, 'Tulips', '튤립', (1, 1), 8, 1, '🌷'),
    ('sunflower', 'flowers', 1, 'Sunflowers', '해바라기', (1, 1), 10, 1, '🌻'),
    ('hydrangea', 'flowers', 2, 'Hydrangea', '수국', (1, 1), 14, 1, '💠'),
    ('flowerbed', 'flowers', 3, 'Flower Bed', '꽃밭', (1, 1), 14, 1, '💐'),
    ('pink_box', 'flowers', 4, 'Pink Planter', '분홍 화단', (1, 1), 12, 1, '🌸'),
    ('daisybox', 'flowers', 5, 'Daisy Box', '데이지 화단', (1, 1), 12, 1, '🌼'),
    ('lavender', 'flowers', 6, 'Lavender', '라벤더', (1, 1), 12, 1, '🪻'),
    ('pot', 'flowers', 8, 'Flower Pot', '화분', (1, 1), 10, 1, '🪴'),
    ('ivy_box', 'flowers', 10, 'Ivy Planter', '덩굴 화단', (1, 1), 12, 1, '🌿'),
    ('blue_box', 'flowers', 11, 'Blue Planter', '파란 꽃 화단', (1, 1), 12, 1, '🔷'),
    ('bench', 'furniture', 0, 'Bench', '벤치', (1, 1), 20, 1, '🪑'),
    ('heart_bench', 'furniture', 1, 'Heart Bench', '하트 벤치', (1, 1), 28, 2, '💗'),
    ('blue_bench', 'furniture', 2, 'Blue Bench', '파란 벤치', (1, 1), 24, 1, '💺'),
    ('parasol', 'furniture', 3, 'Parasol Table', '파라솔 탁자', (1, 1), 40, 2, '⛱️'),
    ('table', 'furniture', 4, 'Round Table', '둥근 탁자', (1, 1), 30, 2, '🍽️'),
    ('deckchair', 'furniture', 5, 'Deck Chair', '접이식 의자', (1, 1), 22, 1, '🏖️'),
    ('swing_bench', 'furniture', 6, 'Garden Swing', '정원 그네', (1, 1), 45, 2, '🪑'),
    ('hammock', 'furniture', 7, 'Hammock', '해먹', (1, 1), 35, 2, '🛏️'),
    ('lamp', 'street', 0, 'Street Lamp', '가로등', (1, 1), 18, 1, '🏮'),
    ('lamp2', 'street', 1, 'Double Lamp', '쌍둥이 가로등', (1, 1), 24, 1, '💡'),
    ('lamp3', 'street', 2, 'Blue Lamp', '파란 가로등', (1, 1), 22, 1, '💡'),
    ('clock', 'street', 3, 'Town Clock', '시계탑', (1, 1), 50, 2, '🕰️'),
    ('flag_blue', 'street', 4, 'Blue Flag', '파란 깃발', (1, 1), 14, 1, '🏳️'),
    ('flag_red', 'street', 5, 'Red Flag', '빨간 깃발', (1, 1), 14, 1, '🚩'),
    ('sign', 'street', 6, 'Sign', '장식 표지판', (1, 1), 12, 1, '🪧'),
    ('notice', 'street', 7, 'Notice Board', '게시판', (1, 1), 30, 2, '📋'),
    ('fence', 'street', 8, 'Fence', '울타리', (1, 1), 6, 1, '🚧'),
    ('white_fence', 'street', 9, 'White Fence', '흰 울타리', (1, 1), 6, 1, '🏡'),
    ('hedge_fence', 'street', 10, 'Hedge Fence', '풀 울타리', (1, 1), 8, 1, '🌱'),
    ('stone_fence', 'street', 11, 'Stone Fence', '돌 울타리', (1, 1), 8, 1, '🧱'),
    ('fountain', 'structures', 0, 'Fountain', '분수', (2, 2), 60, 2, '⛲'),
    ('fountain2', 'structures', 1, 'Stone Fountain', '돌 분수', (2, 2), 70, 2, '⛲'),
    ('statue', 'structures', 2, 'Small Statue', '작은 조각상', (1, 1), 45, 2, '🗿'),
    ('pond', 'structures', 3, 'Lily Pond', '연못', (2, 2), 50, 2, '🪷'),
    ('arch', 'structures', 4, 'Flower Arch', '꽃 아치', (2, 1), 40, 2, '🌸'),
    ('arch2', 'structures', 5, 'Green Arch', '초록 아치', (2, 1), 40, 2, '🌿'),
    ('gazebo', 'structures', 6, 'Gazebo', '정자', (2, 2), 90, 3, '🛖'),
    ('gate', 'structures', 7, 'Garden Gate', '정원 문', (2, 1), 45, 2, '⛩️'),
    ('bridge', 'structures', 10, 'Wooden Bridge', '나무 다리', (2, 1), 35, 2, '🌉'),
    ('stone_bridge', 'structures', 11, 'Stone Bridge', '돌 다리', (2, 1), 45, 2, '🌉'),
    ('slide', 'playground', 0, 'Slide', '미끄럼틀', (2, 2), 80, 3, '🛝'),
    ('swings', 'playground', 1, 'Swing Set', '그네', (2, 1), 60, 3, '🎠'),
    ('seesaw', 'playground', 2, 'Seesaw', '시소', (1, 1), 35, 3, '⚖️'),
    ('climber', 'playground', 3, 'Climbing Frame', '정글짐', (1, 1), 50, 3, '🧗'),
    ('duck', 'playground', 4, 'Duck Rider', '오리 흔들이', (1, 1), 30, 3, '🦆'),
    ('rabbit', 'playground', 5, 'Rabbit Rider', '토끼 흔들이', (1, 1), 30, 3, '🐰'),
    ('whale', 'playground', 6, 'Whale Rider', '고래 흔들이', (1, 1), 30, 3, '🐳'),
    ('sandbox', 'playground', 7, 'Sandbox', '모래놀이터', (2, 1), 45, 3, '🏖️'),
    ('garden', 'farm', 0, 'Veggie Garden', '텃밭', (1, 1), 25, 1, '🥕'),
    ('cabbage', 'farm', 1, 'Cabbage Patch', '양배추 밭', (1, 1), 25, 1, '🥬'),
    ('tomato_garden', 'farm', 2, 'Tomato Garden', '토마토 밭', (1, 1), 25, 1, '🍅'),
    ('corn', 'farm', 3, 'Corn Field', '옥수수 밭', (1, 1), 25, 1, '🌽'),
    ('apple_box', 'farm', 4, 'Apple Basket', '사과 바구니', (1, 1), 18, 1, '🍎'),
    ('potato_box', 'farm', 5, 'Potato Basket', '감자 바구니', (1, 1), 18, 1, '🥔'),
    ('pumpkin', 'farm', 6, 'Pumpkin Basket', '호박 바구니', (1, 1), 18, 1, '🎃'),
    ('hay', 'farm', 7, 'Hay Bale', '건초', (1, 1), 15, 1, '🌾'),
    ('mailbox', 'misc', 0, 'Mailbox', '우체통', (1, 1), 20, 1, '📮'),
    ('pawsign', 'misc', 1, 'Paw Sign', '발바닥 표지판', (1, 1), 12, 1, '🐾'),
    ('chalkboard', 'misc', 2, 'Chalkboard', '칠판 간판', (1, 1), 16, 1, '📝'),
    ('easel', 'misc', 3, 'Painting Easel', '이젤', (1, 1), 22, 1, '🎨'),
    ('bike', 'misc', 4, 'Bicycle', '자전거', (1, 1), 28, 1, '🚲'),
    ('vending', 'misc', 5, 'Vending Machine', '자판기', (1, 1), 40, 2, '🥤'),
    ('gumball', 'misc', 6, 'Gumball Machine', '뽑기 기계', (1, 1), 30, 2, '🍬'),
    ('bin', 'misc', 7, 'Trash Bin', '쓰레기통', (1, 1), 10, 1, '🗑️'),
]
CATEGORY = {'trees': 'plants', 'flowers': 'flowers', 'furniture': 'furniture', 'street': 'street', 'structures': 'structures', 'playground': 'play', 'farm': 'farm', 'misc': 'misc'}
PANELS = {
    'trees': (12, 135, 366, 428), 'flowers': (388, 135, 744, 428), 'furniture': (764, 135, 1114, 428), 'street': (1134, 135, 1490, 428),
    'structures': (12, 478, 430, 742), 'playground': (446, 478, 798, 742), 'farm': (814, 478, 1150, 742), 'misc': (1170, 478, 1492, 742),
}


def drop_specks(img, keep=0.06):
    a = np.array(img)
    lab, n = ndi.label(a[:, :, 3] > 0, structure=np.ones((3, 3)))
    if n > 1:
        sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1))
        for i, sz in enumerate(sizes):
            if sz < keep * sizes.max():
                a[lab == i + 1] = 0
    return Image.fromarray(a)


def trim(img):
    img = drop_specks(img)
    c = img.crop(img.getbbox())
    out = Image.new('RGBA', (c.size[0] + 4, c.size[1] + 4))
    out.paste(c, (2, 2))
    return out


def panel_items(rgb, box, thr=48):
    """Every prop of a panel as a whole piece. Small detached bits (petals, sparkles) join the nearest prop; underlines are dropped."""
    x0, y0, x1, y1 = box
    reg = rgb[y0:y1, x0:x1]
    border = np.concatenate([reg[0], reg[-1], reg[:, 0], reg[:, -1]])
    bg = np.median(border, axis=0)
    mask = ndi.binary_closing(np.abs(reg - bg).sum(axis=2) > thr, iterations=1)
    lab, _ = ndi.label(mask, structure=np.ones((3, 3)))
    comps = [{'i': i + 1, 'sl': sl, 'area': int((lab[sl] == i + 1).sum())} for i, sl in enumerate(ndi.find_objects(lab))]
    comps = [c for c in comps if c['area'] >= 60]
    big = [c for c in comps if c['area'] > 700]
    for c in comps:
        if c in big:
            continue
        cy = (c['sl'][0].start + c['sl'][0].stop) / 2
        cx = (c['sl'][1].start + c['sl'][1].stop) / 2
        best, bd = None, 1e9
        for b in big:
            dy = max(b['sl'][0].start - cy, 0, cy - b['sl'][0].stop)
            dx = max(b['sl'][1].start - cx, 0, cx - b['sl'][1].stop)
            d = (dx * dx + dy * dy) ** 0.5
            if d < bd:
                best, bd = b, d
        if best is not None and bd < 14:
            lab[lab == c['i']] = best['i']
    out = []
    for b in big:
        ys, xs = np.where(lab == b['i'])
        by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        w, h = bx1 - bx0, by1 - by0
        if h < 14 or w / h > 8:
            continue
        fg = ndi.binary_erosion(ndi.binary_fill_holes(lab[by0:by1, bx0:bx1] == b['i']), iterations=1)
        rgba = np.zeros((h, w, 4), np.uint8)
        rgba[:, :, :3] = reg[by0:by1, bx0:bx1]
        rgba[:, :, 3] = fg * 255
        out.append(((bx0 + bx1) / 2 + x0, (by0 + by1) / 2 + y0, Image.fromarray(rgba, 'RGBA')))
    out.sort(key=lambda t: (round(t[1] / 60), t[0]))
    return [t[2] for t in out]


def decorations(manifest, report, review, write_defs=False):
    rgb = np.array(load('decorations-sheet').convert('RGB')).astype(int)
    found = {name: panel_items(rgb, box) for name, box in PANELS.items()}
    out, items, defs = {}, [], []
    for (did, panel, k, name, ko, fp, cost, lvl, emoji) in DECOR:
        lst = found[panel]
        if k >= len(lst):
            report['skipped'].append(f'decoration {did}: panel {panel} has only {len(lst)} props (wanted #{k})')
            continue
        img = trim(lst[k])
        scale = round(min(1.6, max(1.25, fp[0] * 64 * 0.95 / img.size[0])), 2)
        rel = f'decorations/{CATEGORY[panel]}/{did}.png'
        (OUT / rel).parent.mkdir(parents=True, exist_ok=True)
        img.save(OUT / rel, optimize=True)
        out[did] = {'file': rel, 'w': img.size[0], 'h': img.size[1], 'ox': 0.5, 'oy': 1.0, 'scale': scale}
        items.append(img)
        defs.append({'id': did, 'name': name, 'ko': ko, 'category': CATEGORY[panel], 'footprint': {'w': fp[0], 'h': fp[1]}, 'cost': cost, 'townLevel': lvl, 'emoji': emoji})
    manifest['decorations'] = out
    contact(items, 12, 100, review / 'decorations.png', bg=(70, 90, 110, 255))
    report['ok'].append(f'decorations: {len(out)} whole-piece sprites')
    if write_defs:
        p = ROOT / 'src' / 'content' / 'decorations.json'
        p.write_text(json.dumps(defs, ensure_ascii=False, indent=1), encoding='utf-8')
        report['ok'].append(f'decorations.json rewritten with {len(defs)} entries')
