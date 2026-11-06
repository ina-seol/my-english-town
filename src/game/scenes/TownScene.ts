import Phaser from 'phaser';
import { actions, getState, subscribeStore } from '../../app/store';
import { BUILDINGS, DECORATIONS, NPCS, getBuilding, getDecor, getNpc, type NpcDef } from '../../content';
import { MAP_H, MAP_W, LOT_MARKER, TILE, terrainAt } from '../../systems/building/world';
import { blockedTiles, canPlace, findPath, findStandTile } from '../../systems/building';
import { npcQuest } from '../../systems/quests';
import { bridge } from '../bridge';
import { bKey, dKey, getBuildingVisual, pKey, tKey, type Dir, type Manifest, type SpriteRef } from '../assetManager/manifest';
import { addImage, hasKey, setImageKey } from '../assetManager/frames';
import { frameCount } from '../assetManager/placeholders';
import { facingFromMove } from '../facing';
import { pickWanderPath } from '../wander';
import type { SaveData } from '../../types';

const SPEED = 104;
const W = MAP_W * TILE, H = MAP_H * TILE;
type Tile = { x: number; y: number };
interface NpcView { def: NpcDef; tile: Tile; home: Tile; path: Tile[]; wait: number; dir: Dir; scale: number; sprite: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Text }
const NPC_SPEED = 38;

const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

export class TownScene extends Phaser.Scene {
  private px = 0; private py = 0; private dir: Dir = 'down';
  private player!: Phaser.GameObjects.Image;
  private charId = 'c1';
  private blocked = new Set<string>();
  private dyn: Phaser.GameObjects.GameObject[] = [];
  private npcViews: NpcView[] = [];
  private path: Tile[] = [];
  private pending: { type: 'npc' | 'building'; id: string } | null = null;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private lastWorld = -1;
  private placementGfx!: Phaser.GameObjects.Graphics;
  private ghost?: Phaser.GameObjects.Image;
  private lotGfx!: Phaser.GameObjects.Graphics;
  private userZoom = 1;
  private travelled = 0;
  private lastSync = 0;
  private unsub?: () => void;
  private px2t = 64;
  private manifest: Manifest | null = null;
  private dragging = false;

  constructor() { super('Town'); }

  create() {
    this.manifest = this.registry.get('manifest') ?? null;
    this.px2t = this.registry.get('pxPerTile') ?? 64;
    const save = getState().save!;
    this.charId = save.selectedCharacter;
    this.px = save.playerPosition.x; this.py = save.playerPosition.y; this.dir = save.playerPosition.dir;
    this.cameras.main.setBackgroundColor('#cfe9f2');
    this.drawTerrain();
    this.lotGfx = this.add.graphics().setDepth(1);
    this.placementGfx = this.add.graphics().setDepth(9000);
    this.player = addImage(this, this.px, this.py, this.playerTexture(0)).setOrigin(...this.originOf('p', this.charId, this.dir));
    this.player.setScale(this.charScale('p', this.charId));
    this.keys = this.input.keyboard!.addKeys({ up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', w: 'W', a: 'A', s: 'S', d: 'D', e: 'E', space: 'SPACE' }, false) as never;
    this.rebuildWorld(save, false);
    this.lastWorld = getState().worldVersion;
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', () => { this.dragging = false; });
    this.scale.on('resize', () => this.applyZoom());
    bridge.zoomBy = (d) => { this.userZoom = Phaser.Math.Clamp(this.userZoom + d, 1, 2.4); this.applyZoom(); };
    bridge.interact = () => this.interactNearest();
    bridge.recenter = () => { this.userZoom = 1; this.applyZoom(); };
    this.applyZoom();
    this.unsub = subscribeStore(() => this.onState());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
    this.onState();
    this.game.events.emit('town-ready');
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__scene = this; // dev-only: inspect from the console
  }

  private cleanup() {
    this.unsub?.(); this.unsub = undefined;
    bridge.dir = { x: 0, y: 0 };
    bridge.zoomBy = () => {}; bridge.interact = () => {}; bridge.recenter = () => {};
  }

  // ---------------- terrain ----------------
  private tex(key: string) { return hasKey(this, key); }

  private pickGround(x: number, y: number): string {
    const h = hash(x, y);
    const flowers = (this.manifest?.terrain?.flowerGrass?.length ?? 0) > 0 && h % 9 === 0;
    if (flowers) { const k = tKey('flower', h % (this.manifest!.terrain!.flowerGrass!.length)); if (this.tex(k)) return k; }
    const n = this.manifest?.terrain?.grass?.length ?? 0;
    if (n) { const k = tKey('grass', h % n); if (this.tex(k)) return k; }
    return 'ph:grass:' + (h % 9 === 0 ? 2 : h % 3 === 0 ? 1 : 0);
  }

  private pathKey(x: number, y: number): string {
    // Off-map neighbours count as road so roads run cleanly off the edge of the map.
    const isP = (a: number, b: number) => a < 0 || b < 0 || a >= MAP_W || b >= MAP_H || terrainAt(a, b) === 'path';
    const bits = [isP(x, y - 1), isP(x + 1, y), isP(x, y + 1), isP(x - 1, y)].map((v) => (v ? 1 : 0));
    let mask = bits.join('');
    if (!this.tex(`t:dirt:${mask}`)) {
      // dead ends / isolated tiles have no art: use a straight piece along the open axis
      mask = bits[1] || bits[3] ? '0101' : bits[0] || bits[2] ? '1010' : '1111';
    }
    const k = `t:dirt:${mask}`;
    return this.tex(k) ? k : 'ph:path';
  }

  private drawTerrain() {
    const stamp = (key: string, x: number, y: number, depth: number) =>
      addImage(this, x * TILE, y * TILE, key).setOrigin(0, 0).setDisplaySize(TILE, TILE).setDepth(depth);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = terrainAt(x, y);
        if (t === 'water') {
          const n = this.manifest?.terrain?.water?.length ?? 0;
          const k = n ? tKey('water', hash(x, y) % n) : 'ph:water:' + ((x + y) % 2);
          stamp(this.tex(k) ? k : 'ph:water:0', x, y, 0);
        } else {
          stamp(this.pickGround(x, y), x, y, 0);
          if (t === 'path') stamp(this.pathKey(x, y), x, y, 0.5);
        }
      }
    }
  }

  // ---------------- textures / sprites ----------------
  private playerTexture(frame: number) { return pKey('p', this.charId, this.dir, frame); }
  private originOf(kind: 'p' | 'n', id: string, dir: Dir): [number, number] {
    const g = kind === 'p' ? this.manifest?.players : this.manifest?.npcs;
    const r = g?.[id]?.[dir]?.[0];
    return [r?.ox ?? 0.5, r?.oy ?? 1];
  }
  private spriteScale(ref?: { scale?: number }) { return (32 / this.px2t) * (ref?.scale ?? 1); }
  private refOf(kind: 'p' | 'n', id: string, dir: Dir = 'down'): SpriteRef | undefined {
    const g = kind === 'p' ? this.manifest?.players : this.manifest?.npcs;
    return g?.[id]?.[dir]?.[0];
  }
  private charScale(kind: 'p' | 'n', id: string) { return this.spriteScale(this.refOf(kind, id)); }

  // ---------------- world (buildings / decor / npcs) ----------------
  private rebuildWorld(save: SaveData, animate: boolean) {
    this.dyn.forEach((o) => o.destroy()); this.dyn = []; this.npcViews = [];
    const justBuilt = getState().justBuilt;
    for (const b of save.buildings) {
      const def = getBuilding(b.defId); if (!def) continue;
      const vis = getBuildingVisual(this.manifest, b.defId, b.level, def.footprint);
      const key = this.tex(vis.textureKey) ? vis.textureKey : bKey(b.defId, 1);
      if (!this.tex(key)) continue;
      const img = addImage(this, (b.x + vis.footprintWidth / 2) * TILE, (b.y + vis.footprintHeight) * TILE + 2, key).setOrigin(vis.originX, vis.originY);
      const sc = (32 / this.px2t) * vis.renderScale;
      img.setScale(sc).setDepth((b.y + def.footprint.h) * TILE);
      this.dyn.push(img);
      if (def.minigame) {
        const icon = this.add.text(img.x, img.y - img.displayHeight - 4, '▶', { fontSize: '14px', color: '#ffffff', backgroundColor: '#ff7aa8', padding: { x: 5, y: 2 }, fontStyle: 'bold' }).setOrigin(0.5, 1).setDepth(8000);
        this.tweens.add({ targets: icon, y: icon.y - 4, yoyo: true, repeat: -1, duration: 600 });
        this.dyn.push(icon);
      }
      if (animate && justBuilt === b.id) this.popIn(img, sc);
    }
    for (const d of save.decorations) {
      const def = getDecor(d.defId); if (!def) continue;
      const key = dKey(d.defId); if (!this.tex(key)) continue;
      const ref = this.manifest?.decorations?.[d.defId];
      const img = addImage(this, (d.x + def.footprint.w / 2) * TILE, (d.y + def.footprint.h) * TILE, key).setOrigin(ref?.ox ?? 0.5, ref?.oy ?? 1);
      const sc = this.spriteScale(ref);
      img.setScale(sc).setDepth((d.y + def.footprint.h) * TILE);
      this.dyn.push(img);
      if (animate && justBuilt === d.id) this.popIn(img, sc);
    }
    // NPCs
    for (const def of NPCS) {
      let tile: Tile | null = null;
      if (def.home) tile = def.home;
      if (def.building) { const b = save.buildings.find((x) => x.defId === def.building); tile = b ? findStandTile(save, b) : null; }
      if (!tile) continue;
      const key = pKey('n', def.id, 'down', 0);
      const sprite = addImage(this, tile.x * TILE + 16, tile.y * TILE + 28, this.tex(key) ? key : pKey('n', def.id, 'down', 0)).setOrigin(...this.originOf('n', def.id, 'down')).setScale(this.charScale('n', def.id));
      sprite.setDepth(sprite.y);
      const icon = this.add.text(sprite.x, sprite.y - sprite.displayHeight - 2, '❗', { fontSize: '16px' }).setOrigin(0.5, 1).setDepth(8000);
      this.dyn.push(sprite, icon);
      this.npcViews.push({ def, tile, home: tile, path: [], wait: 1 + Math.random() * 3, dir: 'down', scale: sprite.scaleX, sprite, icon });
    }
    this.blocked = blockedTiles(save);
    this.drawLot(save);
    this.unstickPlayer();
    this.refreshIcons(save);
  }

  private popIn(img: Phaser.GameObjects.Image, sc: number) {
    img.setScale(sc * 0.4, sc * 0.2).setAlpha(0.2);
    this.tweens.add({ targets: img, scaleX: sc, scaleY: sc, alpha: 1, duration: 420, ease: 'Back.easeOut' });
    for (let i = 0; i < 10; i++) {
      const p = this.add.circle(img.x + Phaser.Math.Between(-30, 30), img.y - 4, Phaser.Math.Between(3, 6), 0xffffff, 0.8).setDepth(9500);
      this.tweens.add({ targets: p, x: p.x + Phaser.Math.Between(-24, 24), y: p.y - Phaser.Math.Between(10, 40), alpha: 0, duration: 600, onComplete: () => p.destroy() });
    }
  }

  private drawLot(save: SaveData) {
    this.lotGfx.clear();
    if (save.buildings.some((b) => b.defId === 'bakery')) return;
    if (!canPlace(save, LOT_MARKER, LOT_MARKER.x, LOT_MARKER.y).ok) return;
    this.lotGfx.lineStyle(2, 0xffffff, 0.9);
    for (let i = 0; i < LOT_MARKER.w * TILE; i += 8) {
      this.lotGfx.lineBetween(LOT_MARKER.x * TILE + i, LOT_MARKER.y * TILE, LOT_MARKER.x * TILE + i + 4, LOT_MARKER.y * TILE);
      this.lotGfx.lineBetween(LOT_MARKER.x * TILE + i, (LOT_MARKER.y + LOT_MARKER.h) * TILE, LOT_MARKER.x * TILE + i + 4, (LOT_MARKER.y + LOT_MARKER.h) * TILE);
    }
    for (let j = 0; j < LOT_MARKER.h * TILE; j += 8) {
      this.lotGfx.lineBetween(LOT_MARKER.x * TILE, LOT_MARKER.y * TILE + j, LOT_MARKER.x * TILE, LOT_MARKER.y * TILE + j + 4);
      this.lotGfx.lineBetween((LOT_MARKER.x + LOT_MARKER.w) * TILE, LOT_MARKER.y * TILE + j, (LOT_MARKER.x + LOT_MARKER.w) * TILE, LOT_MARKER.y * TILE + j + 4);
    }
    const t = this.add.text((LOT_MARKER.x + LOT_MARKER.w / 2) * TILE, (LOT_MARKER.y + LOT_MARKER.h / 2) * TILE, 'Empty lot', { fontSize: '11px', fontFamily: 'Paperozi, sans-serif', color: '#ffffff', stroke: '#4a7a3a', strokeThickness: 3 }).setOrigin(0.5).setDepth(2);
    this.dyn.push(t);
  }

  private refreshIcons(save: SaveData) {
    for (const n of this.npcViews) {
      const q = npcQuest(save, n.def.id);
      n.icon.setText(q ? (q.status === 'available' ? '❗' : '💬') : '').setVisible(!!q);
    }
  }

  private unstickPlayer() {
    const t = { x: Math.floor(this.px / TILE), y: Math.floor(this.py / TILE) };
    if (!this.blocked.has(`${t.x},${t.y}`)) return;
    const seen = new Set([`${t.x},${t.y}`]); const q = [t];
    while (q.length) {
      const c = q.shift()!;
      if (!this.blocked.has(`${c.x},${c.y}`) && c.x >= 0 && c.y >= 0 && c.x < MAP_W && c.y < MAP_H) { this.px = c.x * TILE + 16; this.py = c.y * TILE + 16; return; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${c.x + dx},${c.y + dy}`;
        if (!seen.has(k) && c.x + dx >= 0 && c.y + dy >= 0 && c.x + dx < MAP_W && c.y + dy < MAP_H) { seen.add(k); q.push({ x: c.x + dx, y: c.y + dy }); }
      }
    }
  }

  // ---------------- state sync ----------------
  private onState() {
    const st = getState();
    if (!st.save) return;
    if (st.worldVersion !== this.lastWorld) { this.lastWorld = st.worldVersion; this.rebuildWorld(st.save, true); }
    else this.refreshIcons(st.save);
    this.drawPlacement();
    if (this.input.keyboard) this.input.keyboard.enabled = !st.modal && !st.placement;
  }

  private drawPlacement() {
    const p = getState().placement;
    this.placementGfx.clear();
    if (!p) { this.ghost?.destroy(); this.ghost = undefined; return; }
    const def = p.kind === 'building' ? getBuilding(p.defId) : getDecor(p.defId);
    if (!def) return;
    this.placementGfx.lineStyle(1, 0xffffff, 0.25);
    for (let x = 0; x <= MAP_W; x++) this.placementGfx.lineBetween(x * TILE, 0, x * TILE, H);
    for (let y = 0; y <= MAP_H; y++) this.placementGfx.lineBetween(0, y * TILE, W, y * TILE);
    const save = getState().save!;
    for (let dx = 0; dx < def.footprint.w; dx++) for (let dy = 0; dy < def.footprint.h; dy++) {
      const ok = canPlace(save, { w: 1, h: 1 }, p.tile.x + dx, p.tile.y + dy, p.instanceId).ok;
      this.placementGfx.fillStyle(ok ? 0x4cd964 : 0xff4d4d, 0.45).fillRect((p.tile.x + dx) * TILE, (p.tile.y + dy) * TILE, TILE, TILE);
    }
    this.placementGfx.lineStyle(2, p.valid ? 0x2ea84a : 0xd93030, 1).strokeRect(p.tile.x * TILE, p.tile.y * TILE, def.footprint.w * TILE, def.footprint.h * TILE);
    const lvl = save.buildings.find((b) => b.id === p.instanceId)?.level ?? 1;
    const vis = p.kind === 'building' ? getBuildingVisual(this.manifest, p.defId, lvl, def.footprint) : null;
    const key = vis ? vis.textureKey : dKey(p.defId);
    const ref = p.kind === 'building' ? undefined : this.manifest?.decorations?.[p.defId];
    const useKey = this.tex(key) ? key : bKey(p.defId, 1);
    if (!this.ghost) this.ghost = addImage(this, 0, 0, useKey).setDepth(9100);
    setImageKey(this, this.ghost, useKey).setOrigin(vis?.originX ?? ref?.ox ?? 0.5, vis?.originY ?? ref?.oy ?? 1)
      .setScale(vis ? (32 / this.px2t) * vis.renderScale : this.spriteScale(ref)).setAlpha(0.65)
      .setPosition((p.tile.x + def.footprint.w / 2) * TILE, (p.tile.y + def.footprint.h) * TILE + 2);
  }

  // ---------------- camera ----------------
  private applyZoom() {
    const cam = this.cameras.main;
    const fit = Math.min(this.scale.width / W, this.scale.height / H);
    cam.setZoom(fit * this.userZoom);
    if (this.userZoom <= 1.001) { cam.stopFollow(); cam.removeBounds(); cam.centerOn(W / 2, H / 2); }
    else { cam.setBounds(0, 0, W, H); cam.startFollow(this.player, true, 0.15, 0.15); }
  }

  // ---------------- input ----------------
  private tileOfPointer(p: Phaser.Input.Pointer): Tile { return { x: Math.floor(p.worldX / TILE), y: Math.floor(p.worldY / TILE) }; }

  private placementTile(p: Phaser.Input.Pointer): Tile | null {
    const pl = getState().placement; if (!pl) return null;
    const def = pl.kind === 'building' ? getBuilding(pl.defId) : getDecor(pl.defId);
    if (!def) return null;
    return { x: Math.floor(p.worldX / TILE - def.footprint.w / 2 + 0.5), y: Math.floor(p.worldY / TILE - def.footprint.h / 2 + 0.5) };
  }

  private onPointerMove(p: Phaser.Input.Pointer) {
    if (!getState().placement || !p.isDown) return;
    const t = this.placementTile(p); if (t) actions.movePlacement(t);
  }

  private onPointerDown(p: Phaser.Input.Pointer) {
    const st = getState();
    if (st.modal) return;
    if (st.placement) { this.dragging = true; const t = this.placementTile(p); if (t) actions.movePlacement(t); return; }
    const t = this.tileOfPointer(p);
    const npc = this.npcViews.find((n) => (n.tile.x === t.x && n.tile.y === t.y) || n.sprite.getBounds().contains(p.worldX, p.worldY));
    if (npc) return this.goInteract({ type: 'npc', id: npc.def.id }, npc.tile);
    const b = st.save!.buildings.find((bb) => { const d = getBuilding(bb.defId)!; return t.x >= bb.x && t.x < bb.x + d.footprint.w && t.y >= bb.y && t.y < bb.y + d.footprint.h; });
    if (b) return this.goInteractBuilding(b);
    this.pending = null;
    this.walkTo(t);
  }

  private walkTo(t: Tile): boolean {
    if (this.blocked.has(`${t.x},${t.y}`)) return false;
    const from = { x: Math.floor(this.px / TILE), y: Math.floor(this.py / TILE) };
    const path = findPath(this.blocked, from, t);
    if (!path) return false;
    this.path = path;
    return true;
  }

  private goInteract(target: { type: 'npc' | 'building'; id: string }, near: Tile) {
    if (this.distTo(near) <= 1.9 * TILE) { this.path = []; this.pending = null; return this.interact(target); }
    this.pending = target;
    if (target.type === 'npc') {
      const from = { x: Math.floor(this.px / TILE), y: Math.floor(this.py / TILE) };
      let best: Tile[] | null = null;
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
        const tt = { x: near.x + dx, y: near.y + dy };
        if (this.blocked.has(`${tt.x},${tt.y}`)) continue;
        const p = findPath(this.blocked, from, tt);
        if (p && (!best || p.length < best.length)) best = p;
      }
      this.path = best ?? [];
    } else if (!this.walkTo(near)) this.path = [];
    if (!this.path.length) { this.pending = null; actions.setToast("I can't get there."); }
  }

  private rectDist(b: { x: number; y: number; defId: string }): number {
    const d = getBuilding(b.defId)!;
    const l = b.x * TILE, r = (b.x + d.footprint.w) * TILE, t = b.y * TILE, bt = (b.y + d.footprint.h) * TILE;
    return Math.hypot(Math.max(l - this.px, 0, this.px - r), Math.max(t - this.py, 0, this.py - bt));
  }

  private goInteractBuilding(b: { id: string; x: number; y: number; defId: string }) {
    const target = { type: 'building' as const, id: b.id };
    if (this.rectDist(b) <= 1.3 * TILE) { this.path = []; this.pending = null; return this.interact(target); }
    const d = getBuilding(b.defId)!;
    const from = { x: Math.floor(this.px / TILE), y: Math.floor(this.py / TILE) };
    const cand: Tile[] = [];
    for (let dx = -1; dx <= d.footprint.w; dx++) { cand.push({ x: b.x + dx, y: b.y - 1 }); cand.push({ x: b.x + dx, y: b.y + d.footprint.h }); }
    for (let dy = 0; dy < d.footprint.h; dy++) { cand.push({ x: b.x - 1, y: b.y + dy }); cand.push({ x: b.x + d.footprint.w, y: b.y + dy }); }
    let best: Tile[] | null = null;
    for (const c of cand) {
      if (this.blocked.has(`${c.x},${c.y}`)) continue;
      const p = findPath(this.blocked, from, c);
      if (p && (!best || p.length < best.length)) best = p;
    }
    if (!best) { this.pending = null; this.path = []; actions.setToast("I can't get there."); return; }
    this.pending = target;
    this.path = best;
  }

  private distTo(t: Tile) { return Phaser.Math.Distance.Between(this.px, this.py, t.x * TILE + 16, t.y * TILE + 16); }

  private interactNearest() {
    const st = getState(); if (st.modal || st.placement || !st.save) return;
    let best: { d: number; t: { type: 'npc' | 'building'; id: string } } | null = null;
    for (const n of this.npcViews) { const d = Phaser.Math.Distance.Between(this.px, this.py, n.sprite.x, n.sprite.y - 12); if (d < 2.2 * TILE && (!best || d < best.d)) best = { d, t: { type: 'npc', id: n.def.id } }; }
    for (const b of st.save.buildings) { const d = this.rectDist(b); if (d < 1.3 * TILE && (!best || d < best.d)) best = { d, t: { type: 'building', id: b.id } }; }
    if (best) this.interact(best.t); else actions.setToast('Walk closer to a person or a building.');
  }

  private interact(t: { type: 'npc' | 'building'; id: string }) {
    this.path = []; bridge.dir = { x: 0, y: 0 };
    if (t.type === 'npc') {
      const n = this.npcViews.find((v) => v.def.id === t.id);
      if (n) this.face(n.tile);
      actions.openModal({ type: 'dialogue', npcId: t.id });
    } else {
      const b = getState().save!.buildings.find((x) => x.id === t.id); if (!b) return;
      const def = getBuilding(b.defId)!;
      if (def.minigame) actions.startMinigame(def.minigame);
      else actions.setToast(`${def.name}: this is your home. Sweet home!`);
    }
  }

  private face(t: Tile) {
    const dx = t.x * TILE + 16 - this.px, dy = t.y * TILE + 16 - this.py;
    this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  // ---------------- update loop ----------------
  private npcBlocks(x: number, y: number): boolean {
    return this.npcViews.some((n) => Math.hypot(n.sprite.x - x, n.sprite.y - 12 - y) < 14);
  }

  /** Residents stroll around their home tile; they stand still while a dialogue or game is open. */
  private updateNpcs(time: number, sec: number, frozen: boolean) {
    const occupied = new Set(this.npcViews.map((n) => `${n.tile.x},${n.tile.y}`));
    for (const n of this.npcViews) {
      let hop = 0;
      if (!frozen && n.path.length) {
        const t = n.path[0];
        const tx = t.x * TILE + 16, ty = t.y * TILE + 28;
        const dx = tx - n.sprite.x, dy = ty - n.sprite.y, d = Math.hypot(dx, dy), step = NPC_SPEED * sec;
        if (d <= step) {
          n.sprite.setPosition(tx, ty); n.tile = t; n.path.shift();
          if (!n.path.length) n.wait = 2 + Math.random() * 5;
        } else {
          n.sprite.x += (dx / d) * step; n.sprite.y += (dy / d) * step;
          n.dir = facingFromMove(dx, dy, n.dir);
          hop = Math.abs(Math.sin(time / 110));
        }
        const key = pKey('n', n.def.id, n.dir, 0);
        if (this.tex(key)) setImageKey(this, n.sprite, key); // directional art if the resident has it
      } else if (!frozen) {
        n.wait -= sec;
        if (n.wait <= 0) {
          const me = `${n.tile.x},${n.tile.y}`;
          const others = new Set([...occupied].filter((k) => k !== me));
          const here = { x: Math.floor(this.px / TILE), y: Math.floor(this.py / TILE) };
          others.add(`${here.x},${here.y}`);
          n.path = pickWanderPath(n.home, n.tile, this.blocked, others) ?? [];
          n.wait = n.path.length ? 0 : 1.5;
        }
      }
      n.sprite.setScale(n.scale * (1 + 0.03 * hop), n.scale * (1 - 0.05 * hop)).setAngle(hop ? Math.sin(time / 110) * 3 : 0).setDepth(n.sprite.y);
      n.icon.setPosition(n.sprite.x, n.sprite.y - n.sprite.displayHeight - 2 + Math.sin(time / 250) * 3);
    }
  }

  private isBlockedAt(x: number, y: number): boolean {
    const pts = [[x - 7, y], [x + 7, y], [x - 7, y - 6], [x + 7, y - 6]];
    return pts.some(([a, b]) => {
      const tx = Math.floor(a / TILE), ty = Math.floor(b / TILE);
      return tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || this.blocked.has(`${tx},${ty}`);
    });
  }

  update(time: number, delta: number) {
    const sec = Math.min(delta, 50) / 1000;
    const prevX = this.px, prevY = this.py;
    const st = getState();
    const frozen = !!st.modal || !!st.placement;
    let vx = 0, vy = 0;
    if (!frozen) {
      const k = this.keys;
      vx = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0) + bridge.dir.x;
      vy = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0) + bridge.dir.y;
      if (Phaser.Input.Keyboard.JustDown(k.e) || Phaser.Input.Keyboard.JustDown(k.space)) this.interactNearest();
    }
    let moving = false;
    if (!frozen && (vx || vy)) {
      this.path = []; this.pending = null;
      const len = Math.hypot(vx, vy); vx /= len; vy /= len;
      moving = this.step(vx * SPEED * sec, vy * SPEED * sec);
    } else if (!frozen && this.path.length) {
      const n = this.path[0];
      const tx = n.x * TILE + 16, ty = n.y * TILE + 16;
      const dx = tx - this.px, dy = ty - this.py, d = Math.hypot(dx, dy);
      if (d < 3) { this.px = tx; this.py = ty; this.path.shift(); if (!this.path.length && this.pending) { const p = this.pending; this.pending = null; this.interact(p); } }
      else {
        const sx = (dx / d) * SPEED * sec, sy = (dy / d) * SPEED * sec;
        this.px += Math.abs(sx) > Math.abs(dx) ? dx : sx; this.py += Math.abs(sy) > Math.abs(dy) ? dy : sy;
        moving = true; this.travelled += Math.hypot(sx, sy);
      }
    }
    this.dir = facingFromMove(this.px - prevX, this.py - prevY, this.dir);
    this.updateNpcs(time, sec, frozen);
    this.player.setPosition(this.px, this.py).setDepth(this.py);
    this.animatePlayer(time, moving);
    if (this.travelled > 96 && time - this.lastSync > 1000) {
      this.lastSync = time;
      actions.syncPlayer({ x: Math.round(this.px), y: Math.round(this.py), dir: this.dir }, true);
    } else if (moving && time - this.lastSync > 3000) {
      this.lastSync = time;
      actions.syncPlayer({ x: Math.round(this.px), y: Math.round(this.py), dir: this.dir }, false);
    }
  }

  private step(dx: number, dy: number): boolean {
    let moved = false;
    if (dx && !this.isBlockedAt(this.px + dx, this.py) && !this.npcBlocks(this.px + dx, this.py)) { this.px += dx; moved = true; }
    if (dy && !this.isBlockedAt(this.px, this.py + dy) && !this.npcBlocks(this.px, this.py + dy)) { this.py += dy; moved = true; }
    if (moved) this.travelled += Math.hypot(dx, dy);
    return moved;
  }

  private animatePlayer(time: number, moving: boolean) {
    // The supplied walk frames are not drawn consistently (face/outfit shading changes between frames), so cycling
    // them looks like the character flickering. One steady pose per direction + a smooth bounce/sway reads as walking.
    setImageKey(this, this.player, pKey('p', this.charId, this.dir, 0));
    const [ox, oy] = this.originOf('p', this.charId, this.dir);
    this.player.setOrigin(ox, oy);
    const base = this.charScale('p', this.charId);
    if (moving) {
      const t = time / 95;
      const hop = Math.abs(Math.sin(t));
      this.player.setScale(base * (1 + 0.03 * hop), base * (1 - 0.05 * hop)).setY(this.py - hop * 2.5);
      this.player.setAngle(Math.sin(t) * 3);
    } else {
      this.player.setScale(base).setAngle(0);
    }
  }
}

export { BUILDINGS, DECORATIONS, getNpc };
