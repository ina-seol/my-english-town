import type { Dir } from './assetManager/manifest';

/**
 * Which way the character should face, from how far it ACTUALLY moved this frame (not from the keys pressed).
 * That keeps the sprite looking where it is going even when it slides along a wall or turns mid-path.
 * Standing still keeps the current direction. When the move is almost diagonal we keep the current axis to avoid flicker.
 */
export function facingFromMove(dx: number, dy: number, current: Dir): Dir {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax + ay < 0.01) return current;
  const horizontal = current === 'left' || current === 'right';
  // prefer the axis we already face unless the other axis is clearly stronger (hysteresis)
  const useHorizontal = horizontal ? ax >= ay * 0.7 : ax > ay * 1.4;
  if (useHorizontal) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}
