import sys; sys.path.insert(0, 'tools')
from common import *
def comp_img(im, c):
    x0, y0, x1, y1 = c['box']; crop = np.array(im.crop(c['box'])); crop[:, :, 3] = np.where(c['lab'][y0:y1, x0:x1] == c['label'], crop[:, :, 3], 0); return Image.fromarray(crop)
out = {}
for n in ['jun','doyun','sua','jiho','minseo']:
    im = load(f'sheet-{n}'); a = np.array(im)
    comps = components(a[:, :, 3] > 60, 1500); rows = cluster_rows(comps, 60)
    items = []; labels = []
    for ri, r in enumerate(rows[:5]):
        for ci, c in enumerate(r):
            items.append(comp_img(im, c)); labels.append(f'{ri}.{ci}')
    contact(items, 8, 110, f'tools/_sheet_{n}.png', labels, bg=(60, 90, 110, 255))
# harin: opaque grey background -> cut out cell by cell
im = load('sheet-harin').convert('RGB')
res = cutout(im, (0, 0, im.size[0], int(im.size[1] * 0.68)), thr=40, dil=1, min_area=1500, erode=1)
res.sort(key=lambda t: (round(t[1][1] / 130), t[1][0]))
print('harin comps', len(res), [ (t[1][0], t[1][1]) for t in res][:12])
contact([t[0] for t in res], 8, 110, 'tools/_sheet_harin.png', [str(i) for i in range(len(res))], bg=(60, 90, 110, 255))
