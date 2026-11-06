import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';

/** Mounts the Phaser game (lazy import) and shows a loading screen until the town is ready. */
export function GameCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let game: Phaser.Game | null = null;
    let cancelled = false;
    void import('../game/createGame').then(({ createGame }) => {
      if (cancelled || !ref.current) return;
      game = createGame(ref.current);
      game.events.on('load-progress', (v: number) => setProgress(v));
      game.events.once('town-ready', () => setReady(true));
    });
    return () => { cancelled = true; game?.destroy(true); game = null; };
  }, []);
  return (
    <>
      <div ref={ref} className="game" data-testid="game" />
      {!ready && (
        <div className="loading" role="status" aria-live="polite">
          <div className="loading-box">
            <b>Loading your town… <span className="kr">마을을 불러오는 중</span></b>
            <div className="progress"><i style={{ transform: `scaleX(${Math.max(0.08, progress)})` }} /></div>
          </div>
        </div>
      )}
    </>
  );
}
