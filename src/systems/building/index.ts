import type { PlacedBuilding, PlacedDecor, SaveData } from '../../types';
import { getBuilding, getDecor } from '../../content';
import { MAP_H, MAP_W, terrainAt } from './world';
import { spend } from '../economy';

export type PlaceReason = 'OUT_OF_BOUNDS' | 'WATER' | 'OVERLAP';
export interface Footprint { w: number; h: number }

export function occupiedTiles(save: SaveData, ignoreId?: string): Set<string> {
  const set = new Set<string>();
  for (const b of save.buildings) {
    if (b.id === ignoreId) continue;
    const d = getBuilding(b.defId);
    if (!d) continue;
    for (let dx = 0; dx < d.footprint.w; dx++) for (let dy = 0; dy < d.footprint.h; dy++) set.add(`${b.x + dx},${b.y + dy}`);
  }
  for (const c of save.decorations) {
    if (c.id === ignoreId) continue;
    const d = getDecor(c.defId);
    if (!d) continue;
    for (let dx = 0; dx < d.footprint.w; dx++) for (let dy = 0; dy < d.footprint.h; dy++) set.add(`${c.x + dx},${c.y + dy}`);
  }
  return set;
}

/** Can a footprint be placed with its top-left tile at (x,y)? */
export function canPlace(save: SaveData, fp: Footprint, x: number, y: number, ignoreId?: string): { ok: true } | { ok: false; reason: PlaceReason } {
  if (x < 0 || y < 0 || x + fp.w > MAP_W || y + fp.h > MAP_H) return { ok: false, reason: 'OUT_OF_BOUNDS' };
  const occ = occupiedTiles(save, ignoreId);
  for (let dx = 0; dx < fp.w; dx++) {
    for (let dy = 0; dy < fp.h; dy++) {
      if (terrainAt(x + dx, y + dy) === 'water') return { ok: false, reason: 'WATER' };
      if (occ.has(`${x + dx},${y + dy}`)) return { ok: false, reason: 'OVERLAP' };
    }
  }
  return { ok: true };
}

/** Tiles the player cannot walk on. */
export function blockedTiles(save: SaveData): Set<string> {
  const set = occupiedTiles(save);
  for (let x = 0; x < MAP_W; x++) for (let y = 0; y < MAP_H; y++) if (terrainAt(x, y) === 'water') set.add(`${x},${y}`);
  return set;
}

export type BuildError = 'UNKNOWN' | 'LOCKED_LEVEL' | 'LOCKED_QUEST' | 'DISABLED' | 'ALREADY_BUILT' | 'INSUFFICIENT_COINS' | PlaceReason;
export type BuildResult = { ok: true; save: SaveData; instance: PlacedBuilding } | { ok: false; error: BuildError };

export function buildingUnlockState(save: SaveData, defId: string): 'ok' | 'DISABLED' | 'LOCKED_LEVEL' | 'LOCKED_QUEST' | 'ALREADY_BUILT' | 'UNKNOWN' {
  const d = getBuilding(defId);
  if (!d) return 'UNKNOWN';
  if (!d.enabled) return 'DISABLED';
  if (save.buildings.some((b) => b.defId === defId)) return 'ALREADY_BUILT';
  if (save.townLevel < d.townLevel) return 'LOCKED_LEVEL';
  if (d.requiresQuest && save.questProgress[d.requiresQuest]?.status !== 'completed') return 'LOCKED_QUEST';
  return 'ok';
}

/** Buy + place a building atomically: nothing is charged unless placement succeeds. */
export function buildBuilding(save: SaveData, defId: string, x: number, y: number, now = Date.now()): BuildResult {
  const u = buildingUnlockState(save, defId);
  if (u !== 'ok') return { ok: false, error: u };
  const d = getBuilding(defId)!;
  const c = canPlace(save, d.footprint, x, y);
  if (!c.ok) return { ok: false, error: c.reason };
  const paid = spend(save, d.cost, `build:${defId}`, now);
  if (!paid.ok) return { ok: false, error: 'INSUFFICIENT_COINS' };
  const instance: PlacedBuilding = { id: `b${paid.save.nextInstanceId}`, defId, x, y, level: 1, builtAt: now };
  return {
    ok: true,
    instance,
    save: { ...paid.save, nextInstanceId: paid.save.nextInstanceId + 1, buildings: paid.save.buildings.concat(instance) },
  };
}

export function moveInstance(save: SaveData, instanceId: string, x: number, y: number): { ok: true; save: SaveData } | { ok: false; error: PlaceReason | 'UNKNOWN' } {
  const b = save.buildings.find((i) => i.id === instanceId);
  const c = save.decorations.find((i) => i.id === instanceId);
  const def = b ? getBuilding(b.defId) : c ? getDecor(c.defId) : undefined;
  if (!def) return { ok: false, error: 'UNKNOWN' };
  const chk = canPlace(save, def.footprint, x, y, instanceId);
  if (!chk.ok) return { ok: false, error: chk.reason };
  if (b) return { ok: true, save: { ...save, buildings: save.buildings.map((i) => (i.id === instanceId ? { ...i, x, y } : i)) } };
  return { ok: true, save: { ...save, decorations: save.decorations.map((i) => (i.id === instanceId ? { ...i, x, y } : i)) } };
}

export type DecorError = 'UNKNOWN' | 'LOCKED_LEVEL' | 'INSUFFICIENT_COINS' | 'NOT_OWNED' | PlaceReason;

export function buyDecor(save: SaveData, defId: string, now = Date.now()): { ok: true; save: SaveData } | { ok: false; error: DecorError } {
  const d = getDecor(defId);
  if (!d) return { ok: false, error: 'UNKNOWN' };
  if (save.townLevel < d.townLevel) return { ok: false, error: 'LOCKED_LEVEL' };
  const paid = spend(save, d.cost, `buy:${defId}`, now);
  if (!paid.ok) return { ok: false, error: 'INSUFFICIENT_COINS' };
  const s = paid.save;
  return { ok: true, save: { ...s, inventory: { ...s.inventory, [defId]: (s.inventory[defId] ?? 0) + 1 } } };
}

export function placeDecorFromInventory(
  save: SaveData, defId: string, x: number, y: number,
): { ok: true; save: SaveData; instance: PlacedDecor } | { ok: false; error: DecorError } {
  const d = getDecor(defId);
  if (!d) return { ok: false, error: 'UNKNOWN' };
  if ((save.inventory[defId] ?? 0) < 1) return { ok: false, error: 'NOT_OWNED' };
  const c = canPlace(save, d.footprint, x, y);
  if (!c.ok) return { ok: false, error: c.reason };
  const instance: PlacedDecor = { id: `d${save.nextInstanceId}`, defId, x, y };
  const inv = { ...save.inventory, [defId]: save.inventory[defId] - 1 };
  if (inv[defId] <= 0) delete inv[defId];
  return { ok: true, instance, save: { ...save, inventory: inv, nextInstanceId: save.nextInstanceId + 1, decorations: save.decorations.concat(instance) } };
}

export function pickUpDecor(save: SaveData, instanceId: string): SaveData {
  const c = save.decorations.find((i) => i.id === instanceId);
  if (!c) return save;
  return {
    ...save,
    decorations: save.decorations.filter((i) => i.id !== instanceId),
    inventory: { ...save.inventory, [c.defId]: (save.inventory[c.defId] ?? 0) + 1 },
  };
}

/** A free tile next to a building, for an NPC to stand on. Prefers the tile in front of the door. */
export function findStandTile(save: SaveData, b: PlacedBuilding): { x: number; y: number } {
  const d = getBuilding(b.defId)!;
  const blocked = blockedTiles(save);
  const frontY = b.y + d.footprint.h;
  const mid = b.x + Math.floor(d.footprint.w / 2) + 1;
  const cand: { x: number; y: number }[] = [];
  for (let dx = -1; dx <= d.footprint.w; dx++) cand.push({ x: b.x + dx, y: frontY });
  for (let dy = d.footprint.h - 1; dy >= -1; dy--) {
    cand.push({ x: b.x - 1, y: b.y + dy });
    cand.push({ x: b.x + d.footprint.w, y: b.y + dy });
  }
  const dist = (t: { x: number; y: number }) => Math.abs(t.x - mid) + Math.abs(t.y - frontY);
  cand.sort((a, c) => dist(a) - dist(c));
  const ok = cand.find((t) => t.x >= 0 && t.y >= 0 && t.x < MAP_W && t.y < MAP_H && !blocked.has(`${t.x},${t.y}`));
  return ok ?? { x: b.x, y: Math.min(MAP_H - 1, frontY) };
}

/** BFS path on the tile grid (4-neighbour). Returns tiles excluding the start, or null. */
export function findPath(blocked: Set<string>, from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number }[] | null {
  const key = (x: number, y: number) => `${x},${y}`;
  if (blocked.has(key(to.x, to.y))) return null;
  const prev = new Map<string, string | null>([[key(from.x, from.y), null]]);
  const q = [from];
  while (q.length) {
    const cur = q.shift()!;
    if (cur.x === to.x && cur.y === to.y) {
      const out: { x: number; y: number }[] = [];
      let k: string | null = key(cur.x, cur.y);
      while (k && k !== key(from.x, from.y)) {
        const [x, y] = k.split(',').map(Number);
        out.unshift({ x, y });
        k = prev.get(k) ?? null;
      }
      return out;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const k = key(nx, ny);
      if (prev.has(k) || blocked.has(k)) continue;
      prev.set(k, key(cur.x, cur.y));
      q.push({ x: nx, y: ny });
    }
  }
  return null;
}
