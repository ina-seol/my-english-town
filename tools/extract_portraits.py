"""Character-select portraits: cut each character out of the bottom strip of character-select.png with GrabCut."""
import sys
from pathlib import Path

import cv2

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *  # noqa: E402,F403

# x range of each portrait in the 1125x750 sheet (neighbours overlap by a few pixels), y 530..692 keeps the bust and drops the name plate
BOXES = {'c1': (192, 340), 'c2': (322, 480), 'c3': (470, 622), 'c4': (606, 764), 'c5': (746, 900), 'c6': (880, 1060)}
Y0, Y1 = 530, 694


def cut(img_rgb, x0, x1):
    crop = img_rgb[Y0:Y1, x0:x1].copy()
    h, w = crop.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    rect = (3, 3, w - 6, h - 4)
    bgd = np.zeros((1, 65), np.float64); fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(crop, mask, rect, bgd, fgd, 8, cv2.GC_INIT_WITH_RECT)
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 1, 0).astype(bool)
    fg = ndi.binary_fill_holes(ndi.binary_closing(fg, iterations=2))
    lab, n = ndi.label(fg)
    if n > 1:  # keep the biggest piece (drops slivers of the neighbouring character)
        sizes = ndi.sum(fg, lab, range(1, n + 1))
        fg = lab == (1 + int(np.argmax(sizes)))
    fg = ndi.binary_erosion(fg, iterations=1)
    rgba = np.dstack([crop, (fg * 255).astype(np.uint8)])
    img = Image.fromarray(rgba, 'RGBA')
    return img.crop(img.getbbox())


def run(manifest, report, review, out_root):
    sheet = np.array(load('character-select').convert('RGB'))
    por, items = {}, []
    for cid, (x0, x1) in BOXES.items():
        img = cut(sheet, x0, x1)
        rel = f'characters/players/{cid}/portrait.png'
        p = out_root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        img.save(p, optimize=True)
        por[cid] = {'file': rel, 'w': img.size[0], 'h': img.size[1], 'ox': 0.5, 'oy': 1.0}
        items.append(img)
    manifest['playerPortraits'] = por
    report['ok'].append(f'player portraits: {len(por)}')
    return items
