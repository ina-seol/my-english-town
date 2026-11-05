import type { SaveData, Transaction } from '../../types';
import { levelForExp } from '../progression';

const MAX_TX = 300;

export interface GrantResult { save: SaveData; granted: boolean; levelUp?: number }

function pushTx(save: SaveData, tx: Transaction): SaveData {
  const list = save.transactions.concat(tx);
  return { ...save, transactions: list.length > MAX_TX ? list.slice(-MAX_TX) : list };
}

/**
 * Grants coins/EXP exactly once per `key`. A second call with the same key is a no-op,
 * which is how duplicate quest/activity rewards are prevented.
 */
export function grantReward(save: SaveData, key: string, reward: { coins?: number; exp?: number }, reason: string, now = Date.now()): GrantResult {
  if (save.claimedRewards.includes(key)) return { save, granted: false };
  let s: SaveData = { ...save, claimedRewards: save.claimedRewards.concat(key) };
  const coins = Math.max(0, Math.floor(reward.coins ?? 0));
  const exp = Math.max(0, Math.floor(reward.exp ?? 0));
  if (coins) { s = { ...s, coins: s.coins + coins }; s = pushTx(s, { id: `${key}:coin`, at: now, kind: 'coin', amount: coins, reason, balanceAfter: s.coins }); }
  if (exp) { s = { ...s, exp: s.exp + exp }; s = pushTx(s, { id: `${key}:exp`, at: now, kind: 'exp', amount: exp, reason }); }
  const newLevel = levelForExp(s.exp);
  let levelUp: number | undefined;
  if (newLevel > s.townLevel) { levelUp = newLevel; s = { ...s, townLevel: newLevel }; }
  return { save: s, granted: true, levelUp };
}

export type SpendResult = { ok: true; save: SaveData } | { ok: false; error: 'INSUFFICIENT_COINS' | 'INVALID_AMOUNT' };

export function spend(save: SaveData, amount: number, reason: string, now = Date.now()): SpendResult {
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: 'INVALID_AMOUNT' };
  if (save.coins < amount) return { ok: false, error: 'INSUFFICIENT_COINS' };
  if (amount === 0) return { ok: true, save };
  const s = { ...save, coins: save.coins - amount };
  return { ok: true, save: pushTx(s, { id: `spend:${now}:${save.transactions.length}`, at: now, kind: 'coin', amount: -amount, reason, balanceAfter: s.coins }) };
}
