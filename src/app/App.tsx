import { useEffect } from 'react';
import { actions, flushSave, useApp } from './store';
import { StartScreen } from '../screens/StartScreen';
import { SetupScreen } from '../screens/SetupScreen';
import { TownScreen } from '../screens/TownScreen';

export function App() {
  const { screen, saveStatus, saveError, toast } = useApp();
  useEffect(() => { void actions.init(); }, []);
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
