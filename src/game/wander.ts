import { findPath } from '../systems/building';

export interface Tile { x: number; y: number }

/**
 * Pick a short walk for a resident: a free tile near its home that it can really reach (never inside a building,
 * water, or another resident). Returns the path to walk, or null if it should just stay put this time.
 * `rand` is injected so tests are deterministic.
 */
export function pickWanderPath(home: Tile, from: Tile, blocked: Set<string>, occupied: Set<string>, rand: () => number = Math.random, radius = 2, maxLen = 7): Tile[] | null {
  for (let attempt = 0; attempt < 8; attempt++) {
    const t = { x: home.x + Math.round((rand() * 2 - 1) * radius), y: home.y + Math.round((rand() * 2 - 1) * radius) };
    const key = `${t.x},${t.y}`;
    if ((t.x === from.x && t.y === from.y) || blocked.has(key) || occupied.has(key)) continue;
    const path = findPath(blocked, from, t);
    if (path && path.length > 0 && path.length <= maxLen) return path;
  }
  return null;
}
