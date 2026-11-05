"""Packs the individual runtime sprites into a few atlases (Phaser JSON-hash format).
Fewer, larger files = fewer requests when 24 tablets load the game at once."""
import json
from pathlib import Path

from PIL import Image

PAD = 2


def pack(entries, max_w=1024):
    """entries: [(frame_names[list], PIL.Image)] -> (atlas image, frames dict). Simple shelf packer.
    Several names may point at one image (aliases), it is stored once."""
    order = sorted(entries, key=lambda e: -e[1].size[1])
    x = y = shelf_h = 0
    placed = []
    width = max_w
    for names, im in order:
        w, h = im.size
        if x + w + PAD > width:
            x, y, shelf_h = 0, y + shelf_h + PAD, 0
        placed.append((names, im, x, y))
        x += w + PAD
        shelf_h = max(shelf_h, h)
    height = 1
    while height < y + shelf_h + PAD:
        height *= 2
    atlas = Image.new('RGBA', (width, height))
    frames = {}
    for names, im, px, py in placed:
        atlas.alpha_composite(im, (px, py))
        w, h = im.size
        for name in names:
            frames[name] = {'frame': {'x': px, 'y': py, 'w': w, 'h': h}, 'rotated': False, 'trimmed': False,
                            'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': h}, 'sourceSize': {'w': w, 'h': h}}
    return atlas, frames


def write_atlas(out_dir: Path, name, entries):
    atlas, frames = pack(entries)
    (out_dir / 'atlas').mkdir(parents=True, exist_ok=True)
    # 256-colour palette keeps the look but cuts the file by ~75% (matters when 24 tablets load at once)
    atlas.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(out_dir / 'atlas' / f'{name}.png', optimize=True)
    data = {'frames': frames, 'meta': {'image': f'{name}.png', 'size': {'w': atlas.size[0], 'h': atlas.size[1]}, 'scale': '1'}}
    (out_dir / 'atlas' / f'{name}.json').write_text(json.dumps(data), encoding='utf-8')
    return {'key': f'atlas-{name}', 'image': f'atlas/{name}.png', 'data': f'atlas/{name}.json', 'frames': len(frames), 'size': atlas.size}
