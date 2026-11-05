import { ECONOMY } from '../../content';

/** Town level for a given total EXP, using data-driven thresholds. */
export function levelForExp(exp: number): number {
  const t = ECONOMY.levelThresholds;
  let lv = 1;
  for (let i = 0; i < t.length; i++) if (exp >= t[i]) lv = i + 1;
  return lv;
}
/** [current level progress exp, exp needed for next] ; next=0 at max level. */
export function expProgress(exp: number): { level: number; into: number; need: number } {
  const t = ECONOMY.levelThresholds;
  const level = levelForExp(exp);
  if (level >= t.length) return { level, into: 0, need: 0 };
  return { level, into: exp - t[level - 1], need: t[level] - t[level - 1] };
}
