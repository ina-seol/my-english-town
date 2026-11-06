import sys; sys.path.insert(0, 'tools')
from common import *
im = load('character-select').convert('RGB'); a = np.array(im).astype(int)
Y0, Y1 = 528, 692
strip = a[Y0:Y1]
white = strip.min(axis=2) > 232            # sticker outline + clouds are near-white
# background = connected to the strip border without crossing a white barrier
free = ~white
lab, n = ndi.label(free, structure=np.ones((3, 3)))
border_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(border_labels))
fg = ~bg
fg = ndi.binary_opening(fg, iterations=1)
comps = components(fg, 3000)
print(len(comps), [(c['x'], c['w'], c['h'], c['area']) for c in comps])
vis = np.array(im.crop((0, Y0, im.size[0], Y1))).copy()
vis[bg] = (40, 70, 90)
Image.fromarray(vis.astype(np.uint8)).save('tools/_portraits_probe.png')
