export const TILE = 32;
export const MAP_W = 24;
export const MAP_H = 18;
export type Terrain = 'grass' | 'path' | 'water';

/** Static terrain of the starter town (24x18). Pure data so game + tests agree. */
export function terrainAt(x: number, y: number): Terrain {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return 'water';
  // pond, top-right
  if (x >= 18 && x <= 22 && y >= 1 && y <= 4) return 'water';
  // main road + side roads
  if (y === 9) return 'path';
  if (x === 11 && y >= 9) return 'path';
  if (x === 4 && y >= 5 && y <= 9) return 'path';
  return 'grass';
}
export const PLAYER_START = { x: 4, y: 7 };
export const LOT_MARKER = { x: 13, y: 4, w: 3, h: 2 };
