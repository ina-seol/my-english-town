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
    let observer: ResizeObserver | null = null;
    void import('../game/createGame').then(({ createGame }) => {
      if (cancelled || !ref.current) return;
      game = createGame(ref.current);
      // Phaser only listens to window resizes. Full screen, rotating a tablet or the browser UI appearing change the size of
      // THIS box without a reliable window event, which left the canvas at its old size and the map off to one side.
      const g = game;
      observer = new ResizeObserver(() => { if (!cancelled) g.scale.refresh(); });
      observer.observe(ref.current);
      game.events.on('load-progress', (v: number) => setProgress(v));
      game.events.once('town-ready', () => setReady(true));
    });
    return () => { cancelled = true; observer?.disconnect(); game?.destroy(true); game = null; };
  }, []);
  return (
    <>
      <div ref={ref} className="world" data-testid="game" />
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
