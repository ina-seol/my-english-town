import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ORIG = ROOT / 'public' / 'assets' / 'original'
OUT = ROOT / 'public' / 'assets'

def load(name):
    return Image.open(ORIG / f'{name}.png').convert('RGBA')

def components(mask, min_area=200, dilate=0):
    m = ndi.binary_dilation(mask, iterations=dilate) if dilate else mask
    lab, n = ndi.label(m, structure=np.ones((3, 3)))
    out = []
    for i, sl in enumerate(ndi.find_objects(lab)):
        area = int((lab[sl] == i + 1).sum())
        if area < min_area:
            continue
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        out.append({'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0, 'area': area, 'label': i + 1, 'lab': lab, 'box': (x0, y0, x1, y1)})
    return out

def cluster_rows(comps, tol=40):
    comps = sorted(comps, key=lambda c: c['y'])
    rows, cur = [], []
    for c in comps:
        if cur and abs(c['y'] - np.mean([k['y'] for k in cur])) > tol:
            rows.append(sorted(cur, key=lambda k: k['x'])); cur = []
        cur.append(c)
    if cur: rows.append(sorted(cur, key=lambda k: k['x']))
    return rows

def contact(items, cols, cell, path, labels=None, bg=(200, 200, 215, 255)):
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cell, rows * cell), bg)
    d = ImageDraw.Draw(sheet)
    for i, im in enumerate(items):
        t = im.copy(); t.thumbnail((cell - 6, cell - 18), Image.NEAREST)
        x, y = (i % cols) * cell, (i // cols) * cell
        sheet.alpha_composite(t, (x + 3, y + 14))
        d.text((x + 3, y + 1), str(labels[i] if labels else i), fill=(0, 0, 0, 255))
    sheet.convert('RGB').save(path)


def cutout(img_rgb, box, thr=36, dil=2, min_area=300, erode=1, pad=2, keep='largest'):
    """Cut sprites out of an opaque panel: background colour = median of the region border.
    Returns list of (RGBA image, bbox_in_sheet). Light interior parts are kept by hole filling."""
    x0, y0, x1, y1 = box
    a = np.array(img_rgb.convert('RGB')).astype(int)
    reg = a[y0:y1, x0:x1]
    border = np.concatenate([reg[0], reg[-1], reg[:, 0], reg[:, -1]])
    bg = np.median(border, axis=0)
    d = np.abs(reg - bg).sum(axis=2)
    mask = d > thr
    mask = ndi.binary_closing(mask, iterations=1)
    cs = components(mask, min_area, dilate=dil)
    out = []
    for c in cs:
        cx0, cy0, cx1, cy1 = c['box']
        comp = ndi.binary_dilation(c['lab'] == c['label'], iterations=0) if False else (c['lab'] == c['label'])
        comp = ndi.binary_fill_holes(comp)
        # restore only pixels that were really foreground or interior holes
        fg = comp & (mask | ndi.binary_fill_holes(mask & comp))
        if erode:
            fg = ndi.binary_erosion(fg, iterations=erode)
        ys, xs = np.where(fg)
        if len(ys) == 0:
            continue
        by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        rgba = np.zeros((by1 - by0 + 2 * pad, bx1 - bx0 + 2 * pad, 4), np.uint8)
        sub = reg[by0:by1, bx0:bx1]
        rgba[pad:pad + by1 - by0, pad:pad + bx1 - bx0, :3] = sub
        rgba[pad:pad + by1 - by0, pad:pad + bx1 - bx0, 3] = np.where(fg[by0:by1, bx0:bx1], 255, 0)
        out.append((Image.fromarray(rgba, 'RGBA'), (x0 + bx0, y0 + by0, x0 + bx1, y0 + by1)))
    return out
