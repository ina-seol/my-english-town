import sys; sys.path.insert(0, 'tools')
from common import *
for n in ['jun','doyun','sua','jiho','minseo']:
    im = load(f'sheet-{n}'); a = np.array(im)
    comps = [c for c in components(a[:, :, 3] > 60, 1500)]
    rows = cluster_rows(comps, 60)
    print(n, im.size, 'rows', [len(r) for r in rows])
