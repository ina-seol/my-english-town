import type Phaser from 'phaser';
import { BUILDINGS, DECORATIONS, NPCS } from '../../content';
import characters from '../../content/characters.json';
import { bKey, dKey, pKey, tKey, type Dir } from './manifest';

/** Placeholder textures are drawn at 2x so they line up with the 64px-per-tile art. */
const S = 2;

function mk(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * S);
  c.height = Math.ceil(h * S);
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.scale(S, S);
  return { c, g };
}
function add(scene: Phaser.Scene, key: string, c: HTMLCanvasElement) {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, c);
}
const has = (scene: Phaser.Scene, key: string) => scene.textures.exists(key);

function rng(seed: number) { let a = seed; return () => ((a = (a * 16807) % 2147483647) / 2147483647); }

export function makeTerrain(scene: Phaser.Scene) {
  for (let v = 0; v < 3; v++) {
    const key = 'ph:grass:' + v;
    if (has(scene, key)) continue;
    const { c, g } = mk(32, 32); const r = rng(11 + v * 7);
    g.fillStyle = '#9ad46b'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#8cc860';
    for (let i = 0; i < 7; i++) g.fillRect(Math.floor(r() * 30), Math.floor(r() * 30), 2, 2);
    g.fillStyle = '#b0e07e';
    for (let i = 0; i < 5; i++) g.fillRect(Math.floor(r() * 30), Math.floor(r() * 30), 2, 1);
    if (v === 2) { g.fillStyle = '#fff'; g.fillRect(8, 9, 2, 2); g.fillStyle = '#ff9ec0'; g.fillRect(21, 20, 2, 2); }
    add(scene, key, c);
  }
  if (!has(scene, 'ph:path')) {
    const { c, g } = mk(32, 32); const r = rng(5);
    g.fillStyle = '#e8c98f'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#d9b678';
    for (let i = 0; i < 8; i++) g.fillRect(Math.floor(r() * 30), Math.floor(r() * 30), 3, 2);
    add(scene, 'ph:path', c);
  }
  for (let v = 0; v < 2; v++) {
    const key = 'ph:water:' + v;
    if (has(scene, key)) continue;
    const { c, g } = mk(32, 32);
    g.fillStyle = '#6ec6f2'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#9ddcff';
    g.fillRect(4 + v * 10, 8, 8, 2); g.fillRect(16 - v * 6, 20, 9, 2);
    add(scene, key, c);
  }
}

function drawBuilding(scene: Phaser.Scene, id: string, level: number) {
  const key = bKey(id, level);
  if (has(scene, key)) return;
  const d = BUILDINGS.find((b) => b.id === id)!;
  const w = d.footprint.w * 32 + 16, h = d.footprint.h * 32 + 44;
  const { c, g } = mk(w, h);
  const bodyTop = 30 + (level - 1) * -2;
  g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(4, h - 8, w - 8, 6);
  g.fillStyle = d.color; g.fillRect(8, bodyTop, w - 16, h - bodyTop - 6);
  g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(8, h - 14, w - 16, 8);
  g.fillStyle = d.roof;
  g.beginPath(); g.moveTo(2, bodyTop + 2); g.lineTo(w / 2, 2 + (3 - level) * 2); g.lineTo(w - 2, bodyTop + 2); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(6, bodyTop - 2, w - 12, 3);
  g.fillStyle = '#7a4b2a'; g.fillRect(w / 2 - 6, h - 28, 12, 22);
  g.fillStyle = '#ffe9a8'; g.fillRect(w / 2 - 5, h - 27, 10, 6);
  g.fillStyle = '#bfe6ff';
  g.fillRect(16, bodyTop + 14, 12, 12); g.fillRect(w - 28, bodyTop + 14, 12, 12);
  g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(16, bodyTop + 14, 12, 12); g.strokeRect(w - 28, bodyTop + 14, 12, 12);
  if (id === 'bakery') { g.fillStyle = '#fff'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText('🍞', w / 2, bodyTop + 10); }
  if (level >= 2) { g.fillStyle = '#d9534f'; g.fillRect(w - 18, 2, 2, 14); g.fillRect(w - 16, 2, 8, 5); }
  add(scene, key, c);
}

function drawPerson(scene: Phaser.Scene, kind: 'p' | 'n', id: string, dir: Dir, frame: number, look: { hair: string; shirt: string; hat: string | null }) {
  const key = pKey(kind, id, dir, frame);
  if (has(scene, key)) return;
  const { c, g } = mk(24, 36);
  const step = frame === 1 ? 2 : frame === 3 ? -2 : 0;
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(4, 32, 16, 3);
  g.fillStyle = '#4a4a6a'; // legs
  g.fillRect(7, 24 + (step > 0 ? 0 : 0), 4, 8 + (step > 0 ? 0 : 0) - Math.max(0, -step) + 0);
  g.fillRect(13, 24, 4, 8 - Math.max(0, step));
  if (step !== 0) { g.fillStyle = '#2f2f4a'; g.fillRect(step > 0 ? 7 : 13, 31, 4, 2); }
  g.fillStyle = look.shirt; g.fillRect(6, 14, 12, 11);
  g.fillStyle = '#ffd9b8'; g.fillRect(4, 15, 3, 7); g.fillRect(17, 15, 3, 7);
  g.fillStyle = '#ffd9b8'; g.fillRect(6, 3, 12, 12);
  g.fillStyle = look.hair;
  if (dir === 'up') g.fillRect(6, 3, 12, 11);
  else { g.fillRect(6, 3, 12, 4); if (dir === 'left') g.fillRect(14, 3, 4, 10); if (dir === 'right') g.fillRect(6, 3, 4, 10); }
  g.fillStyle = '#2b2b3a';
  if (dir === 'down') { g.fillRect(9, 9, 2, 3); g.fillRect(14, 9, 2, 3); }
  if (dir === 'left') g.fillRect(8, 9, 2, 3);
  if (dir === 'right') g.fillRect(15, 9, 2, 3);
  if (look.hat) { g.fillStyle = look.hat; g.fillRect(5, 1, 14, 4); g.fillRect(dir === 'right' ? 9 : 3, 4, 12, 2); }
  add(scene, key, c);
}

/** Create any missing placeholder textures. Real art loaded earlier always wins. */
export function ensurePlaceholders(scene: Phaser.Scene) {
  makeTerrain(scene);
  for (const b of BUILDINGS) for (let l = 1; l <= 3; l++) drawBuilding(scene, b.id, l);
  for (const d of DECORATIONS) {
    const key = dKey(d.id);
    if (has(scene, key)) continue;
    const sz = Math.max(d.footprint.w, d.footprint.h) * 32;
    const { c, g } = mk(sz, sz);
    g.font = `${Math.floor(sz * 0.78)}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(d.emoji, sz / 2, sz / 2 + 2);
    add(scene, key, c);
  }
  for (const ch of characters) for (const dir of ['down', 'left', 'right', 'up'] as Dir[]) for (let f = 0; f < 4; f++) drawPerson(scene, 'p', ch.id, dir, f, ch as never);
  for (const n of NPCS) for (const dir of ['down', 'left', 'right', 'up'] as Dir[]) for (let f = 0; f < 4; f++) drawPerson(scene, 'n', n.id, dir, f, { hair: '#5a3a2a', shirt: n.color, hat: n.id === 'emma' ? '#ffffff' : '#f6a5c0' });
  void tKey;
}

/** Number of frames available for a character in a direction (art may supply fewer than 4). */
export function frameCount(scene: Phaser.Scene, kind: 'p' | 'n', id: string, dir: Dir): number {
  let n = 0;
  while (scene.textures.exists(pKey(kind, id, dir, n))) n++;
  return n;
}
