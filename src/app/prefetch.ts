import { assetUrl } from '../game/assetManager/manifest';
import { loadManifestOnce } from '../components/useManifest';

let started = false;

/**
 * While the student is still on the title / setup screen, quietly download the game engine chunk and the
 * art atlases so entering the town is fast. Failures are ignored; the normal loader still works.
 */
export function prefetchGame() {
  if (started) return;
  started = true;
  const run = () => {
    void import('../game/createGame').catch(() => {});
    void loadManifestOnce().then((m) => {
      for (const a of m?.atlases ?? []) {
        for (const f of [a.image, a.data]) void fetch(assetUrl(f)).catch(() => {});
      }
    });
  };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (ric) ric(run, { timeout: 2500 }); else setTimeout(run, 800);
}
