"""Character-select portraits: public/assets/original/character-portraits.png holds the six playable characters
(Jun, Minseo, Jiho, Sua, Harin, Doyun, left to right) on a transparent background; each one is a single connected piece.
(An older approach cut them out of character-select.png with GrabCut; the clean sheet replaces it.)"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import *  # noqa: E402,F403

IDS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']
HEIGHT = 240  # portraits are shown at most ~120px tall; keep 2x for sharp tablets


def run(manifest, report, review, out_root):
    im = load('character-portraits')
    comps = components(np.array(im)[:, :, 3] > 40, 8000)
    if len(comps) != 6:
        report['skipped'].append(f'character portraits: found {len(comps)} figures, expected 6')
        return []
    comps.sort(key=lambda c: c['x'])
    por, items = {}, []
    for cid, c in zip(IDS, comps):
        x0, y0, x1, y1 = c['box']
        crop = np.array(im.crop(c['box']))
        crop[:, :, 3] = np.where(c['lab'][y0:y1, x0:x1] == c['label'], crop[:, :, 3], 0)
        img = Image.fromarray(crop)
        img = img.crop(img.getbbox())
        w = max(1, round(img.size[0] * HEIGHT / img.size[1]))
        img = img.resize((w, HEIGHT), Image.LANCZOS)
        rel = f'characters/players/{cid}/portrait.png'
        p = out_root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        img.save(p, optimize=True)
        por[cid] = {'file': rel, 'w': img.size[0], 'h': img.size[1], 'ox': 0.5, 'oy': 1.0}
        items.append(img)
    manifest['playerPortraits'] = por
    report['ok'].append(f'player portraits: {len(por)}')
    return items
