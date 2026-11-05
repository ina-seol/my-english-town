import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';

/** Mounts the Phaser game. Phaser is imported lazily so the start screen loads fast. */
export function GameCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let game: Phaser.Game | null = null;
    let cancelled = false;
    void import('../game/createGame').then(({ createGame }) => {
      if (cancelled || !ref.current) return;
      game = createGame(ref.current);
    });
    return () => { cancelled = true; game?.destroy(true); game = null; };
  }, []);
  return <div ref={ref} className="game" data-testid="game" />;
}
