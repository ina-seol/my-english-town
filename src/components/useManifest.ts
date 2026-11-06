import { useEffect, useState } from 'react';
import { assetUrl, fetchManifest, type Dir, type Manifest } from '../game/assetManager/manifest';

let cache: Promise<Manifest | null> | null = null;
export function loadManifestOnce() {
  return (cache ??= fetchManifest());
}

export function useManifest(): Manifest | null {
  const [m, setM] = useState<Manifest | null>(null);
  useEffect(() => {
    let on = true;
    void loadManifestOnce().then((x) => on && setM(x));
    return () => { on = false; };
  }, []);
  return m;
}

/** URL of the first frame of a character/npc facing `dir`, if real art exists. */
export function spriteUrl(m: Manifest | null, kind: 'p' | 'n', id: string, dir: Dir = 'down'): string | null {
  const g = kind === 'p' ? m?.players : m?.npcs;
  const r = g?.[id]?.[dir]?.[0];
  return r ? assetUrl(r.file) : null;
}
export function portraitUrl(m: Manifest | null, id: string): string | null {
  const r = m?.portraits?.[id];
  return r ? assetUrl(r.file) : null;
}
export function decorUrl(m: Manifest | null, id: string): string | null {
  const r = m?.decorations?.[id];
  return r ? assetUrl(r.file) : null;
}
export function buildingUrl(m: Manifest | null, id: string, level = 1): string | null {
  const r = m?.buildings?.[id]?.[String(level)];
  return r ? assetUrl(r.file) : null;
}

/** Face portrait of a playable character (character select, HUD); falls back to the standing sprite. */
export function playerPortraitUrl(m: Manifest | null, id: string): string | null {
  const r = m?.playerPortraits?.[id];
  return r ? assetUrl(r.file) : spriteUrl(m, 'p', id);
}
