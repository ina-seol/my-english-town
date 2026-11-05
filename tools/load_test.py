"""Simulates N students opening the game at the same moment (static-hosting load check).

Each simulated student downloads what a real first visit downloads: index.html, the JS/CSS bundles, the art manifest,
the title image, the engine chunk, the 4 atlases (+json) and the web fonts. It measures time per student and failures.
It does NOT measure device performance (CPU/GPU) - only the network/hosting side.

  python tools/load_test.py https://ina-seol.github.io/my-english-town/ 24
"""
import json
import re
import statistics
import sys
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://ina-seol.github.io/my-english-town/').rstrip('/') + '/'
N = int(sys.argv[2]) if len(sys.argv) > 2 else 24
UA = {'User-Agent': 'Mozilla/5.0 (X11; CrOS x86_64) load-test', 'Accept-Encoding': 'gzip'}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    t = time.time()
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
        return data, time.time() - t, r.status, r.headers.get('Content-Encoding', '')


def discover():
    """Build the real file list the way a browser would, from the deployed site itself."""
    html, *_ = get(BASE)
    html = html.decode('utf-8', 'ignore')
    urls = [BASE]
    for m in re.findall(r'(?:src|href)="(\./assets/[^"]+|/[^"]*assets/[^"]+)"', html):
        urls.append(urljoin(BASE, m))
    js = [u for u in urls if u.endswith('.js')]
    for u in js:  # dynamic chunk (engine) referenced from the main bundle
        body, *_ = get(u)
        for m in re.findall(r'assets/(createGame-[A-Za-z0-9_-]+\.js)', body.decode('utf-8', 'ignore')):
            urls.append(urljoin(BASE, 'assets/' + m))
    man, *_ = get(urljoin(BASE, 'assets/manifest.json'))
    manifest = json.loads(man)
    urls.append(urljoin(BASE, 'assets/manifest.json'))
    urls.append(urljoin(BASE, 'assets/' + manifest['title']['file']))
    for a in manifest.get('atlases', []):
        urls += [urljoin(BASE, 'assets/' + a['image']), urljoin(BASE, 'assets/' + a['data'])]
    return list(dict.fromkeys(urls))


def student(i, urls, gate):
    gate.wait()  # everybody starts together
    t0 = time.time()
    fails, nbytes = [], 0
    for u in urls:
        try:
            data, _, status, _ = get(u)
            nbytes += len(data)
            if status != 200:
                fails.append((u, status))
        except Exception as e:  # noqa: BLE001
            fails.append((u, str(e)[:60]))
    return time.time() - t0, nbytes, fails


def main():
    urls = discover()
    print(f'{len(urls)} files per student:')
    for u in urls:
        print('  ', u.replace(BASE, ''))
    gate = threading.Event()
    with ThreadPoolExecutor(N) as ex:
        futs = [ex.submit(student, i, urls, gate) for i in range(N)]
        time.sleep(0.5)
        gate.set()
        res = [f.result() for f in futs]
    times = sorted(r[0] for r in res)
    fails = [f for r in res for f in r[2]]
    print(f'\n{N} students at once: total download per student ~{res[0][1] / 1024 / 1024:.2f} MB (decoded, before gzip)')
    print(f'time to download everything: fastest {times[0]:.1f}s, median {statistics.median(times):.1f}s, p90 {times[int(N * 0.9) - 1]:.1f}s, slowest {times[-1]:.1f}s')
    print(f'failed requests: {len(fails)}', fails[:5])


if __name__ == '__main__':
    main()
