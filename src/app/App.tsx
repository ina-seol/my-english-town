import { useEffect } from 'react';
import { actions, flushSave, useApp } from './store';
import { StartScreen } from '../screens/StartScreen';
import { loadManifestOnce } from '../components/useManifest';
import { assetUrl } from '../game/assetManager/manifest';
import { SetupScreen } from '../screens/SetupScreen';
import { prefetchGame } from './prefetch';
import { TownScreen } from '../screens/TownScreen';

export function App() {
  const { screen, saveStatus, saveError, toast } = useApp();
  useEffect(() => { void actions.init(); prefetchGame(); }, []);
  useEffect(() => {
    // Decorative 9-slice panel frames come from the art manifest; without art the CSS panels stay as they are.
    void loadManifestOnce().then((m) => {
      const f = m?.ui?.frame_wood;
      if (!f) return;
      const img = new Image();
      img.onload = () => { document.documentElement.style.setProperty('--frame-wood', `url(${assetUrl(f.file)})`); document.body.dataset.art = '1'; };
      img.src = assetUrl(f.file);
    });
  }, []);
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden') void flushSave(); };
    const hide = () => void flushSave();
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', hide);
    return () => { document.removeEventListener('visibilitychange', flush); window.removeEventListener('pagehide', hide); };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => actions.setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <>
      {screen === 'start' && <StartScreen />}
      {screen === 'setup' && <SetupScreen />}
      {screen === 'town' && <TownScreen />}
      {saveStatus === 'error' && (
        <div className="banner" role="alert">
          ⚠ Could not save: {saveError}. Your town is still on screen — export a backup in Settings.
          <button className="btn small" onClick={() => void flushSave()}>Try again</button>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
