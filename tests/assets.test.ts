import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILDINGS, DECORATIONS, NPCS } from '../src/content';
import characters from '../src/content/characters.json';
import { getBuildingVisual, listImages, type Manifest } from '../src/game/assetManager/manifest';

const ASSETS = path.resolve(__dirname, '../public/assets');
const manifest: Manifest = JSON.parse(readFileSync(path.join(ASSETS, 'manifest.json'), 'utf-8'));

describe('art manifest', () => {
  it('every referenced image file exists', () => {
    const missing = listImages(manifest).filter(([, f]) => !existsSync(path.join(ASSETS, f)));
    expect(missing).toEqual([]);
    for (const r of [...Object.values(manifest.ui ?? {}), ...Object.values(manifest.portraits ?? {}), manifest.title!]) {
      expect(existsSync(path.join(ASSETS, r.file))).toBe(true);
    }
  });

  it('atlases exist and contain every runtime key', () => {
    const frames = new Set<string>();
    for (const a of manifest.atlases ?? []) {
      expect(existsSync(path.join(ASSETS, a.image))).toBe(true);
      const data = JSON.parse(readFileSync(path.join(ASSETS, a.data), 'utf-8'));
      const { w, h } = data.meta.size;
      expect(Math.max(w, h)).toBeLessThanOrEqual(2048); // safe texture size for low-end Chromebooks
      for (const [name, f] of Object.entries<{ frame: { x: number; y: number; w: number; h: number } }>(data.frames)) {
        frames.add(name);
        expect(f.frame.x + f.frame.w).toBeLessThanOrEqual(w);
        expect(f.frame.y + f.frame.h).toBeLessThanOrEqual(h);
      }
    }
    const keys = listImages(manifest).map(([k]) => k);
    expect(keys.filter((k) => !frames.has(k))).toEqual([]);
  });

  it('has 3 visual levels for each of the 12 buildings', () => {
    expect(Object.keys(manifest.buildings!)).toHaveLength(12);
    for (const [id, lv] of Object.entries(manifest.buildings!)) expect(Object.keys(lv).sort(), id).toEqual(['1', '2', '3']);
    for (const b of BUILDINGS) expect(manifest.buildings![b.id], `building ${b.id}`).toBeDefined();
  });

  it('has art for every decoration, every player direction and every game NPC', () => {
    for (const d of DECORATIONS) expect(manifest.decorations![d.id], `decor ${d.id}`).toBeDefined();
    for (const c of characters) for (const dir of ['down', 'left', 'right', 'up'] as const) expect(manifest.players![c.id][dir]!.length, `${c.id} ${dir}`).toBeGreaterThan(0);
    for (const n of NPCS) expect(manifest.npcs![n.id]?.down?.length, `npc ${n.id}`).toBeGreaterThan(0);
  });

  it('has the road pieces the starter map needs', () => {
    for (const mask of ['0101', '1010', '1111', '0111', '1101', '1011', '1110']) expect(manifest.terrain!.dirt![mask], `dirt ${mask}`).toBeDefined();
    expect(manifest.terrain!.grass!.length).toBeGreaterThan(0);
    expect(manifest.terrain!.water!.length).toBeGreaterThan(0);
  });

  it('building visuals keep footprint separate from image size and fall back safely', () => {
    const v = getBuildingVisual(manifest, 'bakery', 3, { w: 3, h: 2 });
    expect(v).toMatchObject({ buildingId: 'bakery', level: 3, textureKey: 'b:bakery:3', footprintWidth: 3, footprintHeight: 2 });
    expect(v.renderScale).toBeGreaterThan(0);
    // out-of-range levels clamp; no art at all falls back to level-1 key (placeholder)
    expect(getBuildingVisual(manifest, 'bakery', 9, { w: 3, h: 2 }).level).toBe(3);
    expect(getBuildingVisual(null, 'bakery', 2, { w: 3, h: 2 }).textureKey).toBe('b:bakery:1');
  });
});
