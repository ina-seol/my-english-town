import { useSyncExternalStore } from 'react';
import type { Grade, SaveData } from '../types';
import { createNewSave } from '../systems/progression/newGame';
import { acceptQuest, evaluateQuests, setQuestFlag } from '../systems/quests';
import { buildBuilding, buyDecor, moveInstance, pickUpDecor, placeDecorFromInventory, canPlace, upgradeBuilding } from '../systems/building';
import { recordActivityResult, type ActivityResultInput } from '../systems/learning';
import { QUESTS, getBuilding, getDecor, getPack, validateGameData, validatePack, type QuestDef } from '../content';
import { deleteProfile, exportSave, getSave, listProfiles, parseImport, putSave, type ProfileSummary } from '../storage/db';
import { uid } from '../utils/rng';

export type Screen = 'start' | 'setup' | 'town';
export type Modal =
  | null
  | { type: 'dialogue'; npcId: string }
  | { type: 'minigame'; gameId: string; runId: string }
  | { type: 'build' } | { type: 'shop' } | { type: 'quests' } | { type: 'bag' } | { type: 'settings' } | { type: 'progress' };

export interface Placement {
  kind: 'building' | 'decor';
  defId: string;
  /** set when moving an already placed instance */
  instanceId?: string;
  tile: { x: number; y: number };
  valid: boolean;
}
export interface RewardPopup { id: string; title: string; coins: number; exp: number; levelUp?: number; quest?: QuestDef }

export interface AppState {
  screen: Screen;
  save: SaveData | null;
  modal: Modal;
  placement: Placement | null;
  rewards: RewardPopup[];
  toast: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saveError: string | null;
  profiles: ProfileSummary[];
  contentErrors: string[];
  /** bumped when the scene should re-sync with the save */
  worldVersion: number;
  justBuilt: string | null;
}

let state: AppState = {
  screen: 'start', save: null, modal: null, placement: null, rewards: [], toast: null,
  saveStatus: 'idle', saveError: null, profiles: [], contentErrors: [], worldVersion: 0, justBuilt: null,
};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export const getState = () => state;
export function subscribeStore(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
function set(patch: Partial<AppState>) { state = { ...state, ...patch }; emit(); }
export function useApp(): AppState { return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state); }

// ---------- persistence ----------
let saving = false, dirty = false, debounceTimer: ReturnType<typeof setTimeout> | undefined;
export async function flushSave(): Promise<void> {
  if (saving) { dirty = true; return; }
  const s = state.save;
  if (!s) return;
  saving = true; dirty = false;
  set({ saveStatus: 'saving' });
  try {
    const out = { ...s, savedAt: Date.now() };
    await putSave(out);
    set({ saveStatus: 'saved', saveError: null });
  } catch (e) {
    set({ saveStatus: 'error', saveError: (e as Error).message || 'Save failed' });
  } finally {
    saving = false;
    if (dirty) void flushSave();
  }
}
function scheduleSave(delay = 1500) { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => void flushSave(), delay); }

/** Apply a new save: bump revision, evaluate quests, queue reward popups, persist immediately. */
function commit(next: SaveData, opts: { completed?: QuestDef[]; levelUp?: number; coins?: number; exp?: number; immediate?: boolean; world?: boolean } = {}): SaveData {
  const ev = evaluateQuests(next);
  const popups: RewardPopup[] = ev.completed.concat(opts.completed ?? []).map((q) => ({ id: uid('r'), title: q.title.en, coins: q.reward.coins, exp: q.reward.exp, quest: q }));
  const lvl = ev.levelUp ?? opts.levelUp;
  if (lvl) popups.push({ id: uid('r'), title: `Town Level ${lvl}!`, coins: 0, exp: 0, levelUp: lvl });
  const save = { ...ev.save, revision: next.revision + 1 };
  set({ save, rewards: state.rewards.concat(popups), worldVersion: opts.world ? state.worldVersion + 1 : state.worldVersion });
  if (opts.immediate === false) scheduleSave(); else void flushSave();
  return save;
}

export const actions = {
  async init() {
    const errs = [...validateGameData(), ...validatePack(getPack(3)), ...validatePack(getPack(4))];
    set({ contentErrors: errs });
    try { set({ profiles: await listProfiles() }); } catch (e) { set({ saveStatus: 'error', saveError: (e as Error).message }); }
  },
  goto(screen: Screen) { set({ screen }); },

  async newGame(o: { nickname: string; grade: Grade; townName: string; character: string }) {
    const save = createNewSave(o);
    set({ save, screen: 'town', modal: null, placement: null, rewards: [], worldVersion: state.worldVersion + 1 });
    await flushSave();
  },
  async continueProfile(playerId: string): Promise<string | null> {
    try {
      const r = await getSave(playerId);
      if (!r) return 'Save not found.';
      set({ save: r.save, screen: 'town', modal: null, placement: null, rewards: [], worldVersion: state.worldVersion + 1, toast: r.recovered ? 'Your latest save was damaged. We restored the previous backup.' : null });
      return null;
    } catch (e) { return (e as Error).message; }
  },
  async importText(text: string, overwriteConfirmed = false): Promise<{ ok: boolean; message: string; needsConfirm?: boolean }> {
    const r = parseImport(text);
    if (!r.ok) return { ok: false, message: r.error };
    const exists = state.profiles.some((p) => p.playerId === r.save.playerId);
    if (exists && !overwriteConfirmed) return { ok: false, needsConfirm: true, message: `A town for "${r.save.nickname}" already exists on this device. Replace it?` };
    set({ save: { ...r.save, revision: r.save.revision + 1 }, screen: 'town', modal: null, placement: null, worldVersion: state.worldVersion + 1 });
    await flushSave();
    set({ profiles: await listProfiles() });
    return { ok: true, message: 'Backup loaded.' };
  },
  exportCurrent(): string | null { return state.save ? exportSave(state.save) : null; },
  async deleteProfile(playerId: string) { await deleteProfile(playerId); set({ profiles: await listProfiles() }); },
  async backToStart() {
    await flushSave();
    try { set({ profiles: await listProfiles() }); } catch { /* ignore */ }
    set({ screen: 'start', save: null, modal: null, placement: null });
  },

  openModal(m: Modal) { set({ modal: m, placement: null }); },
  closeModal() { set({ modal: null }); },
  dismissReward() { set({ rewards: state.rewards.slice(1) }); },
  setToast(t: string | null) { set({ toast: t }); },
  updateSettings(p: Partial<SaveData['settings']>) {
    const s = state.save; if (!s) return;
    commit({ ...s, settings: { ...s.settings, ...p } }, { immediate: false });
  },

  /** Called by the scene; no re-render, saved lazily. */
  syncPlayer(pos: SaveData['playerPosition'], moved: boolean) {
    const s = state.save; if (!s) return;
    const tutorial = moved && !s.tutorial.moved ? { moved: true } : s.tutorial;
    state = { ...state, save: { ...s, playerPosition: pos, tutorial } };
    if (tutorial !== s.tutorial) emit();
    scheduleSave(4000);
  },

  // ---- quests / dialogue ----
  acceptQuest(id: string) { const s = state.save; if (s) commit(acceptQuest(s, id)); },
  passDialogue(questId: string) { const s = state.save; if (s) commit(setQuestFlag(s, questId, 'dialogue')); },

  // ---- building ----
  startPlacement(kind: 'building' | 'decor', defId: string, instanceId?: string) {
    const s = state.save; if (!s) return;
    const def = kind === 'building' ? getBuilding(defId) : getDecor(defId);
    if (!def) return;
    const inst = instanceId ? [...s.buildings, ...s.decorations].find((i) => i.id === instanceId) : undefined;
    const tile = inst ? { x: inst.x, y: inst.y } : { x: 12, y: 5 };
    const valid = canPlace(s, def.footprint, tile.x, tile.y, instanceId).ok;
    set({ modal: null, placement: { kind, defId, instanceId, tile, valid } });
  },
  movePlacement(tile: { x: number; y: number }) {
    const s = state.save, p = state.placement; if (!s || !p) return;
    const def = p.kind === 'building' ? getBuilding(p.defId) : getDecor(p.defId);
    if (!def) return;
    set({ placement: { ...p, tile, valid: canPlace(s, def.footprint, tile.x, tile.y, p.instanceId).ok } });
  },
  cancelPlacement() { set({ placement: null }); },
  confirmPlacement(): { ok: boolean; message: string } {
    const s = state.save, p = state.placement;
    if (!s || !p) return { ok: false, message: 'Nothing to place.' };
    const { x, y } = p.tile;
    if (p.instanceId) {
      const r = moveInstance(s, p.instanceId, x, y);
      if (!r.ok) return { ok: false, message: placeMessage(r.error) };
      commit(r.save, { world: true });
      set({ placement: null, justBuilt: null });
      return { ok: true, message: 'Moved!' };
    }
    if (p.kind === 'building') {
      const r = buildBuilding(s, p.defId, x, y);
      if (!r.ok) return { ok: false, message: placeMessage(r.error) };
      // Doing the thing a building quest asks for counts as accepting it, so students are never stuck waiting to "accept".
      let built = r.save;
      for (const q of QUESTS) if (q.requirements.some((rq) => rq.type === 'build' && rq.buildingId === p.defId)) built = acceptQuest(built, q.id);
      commit(built, { world: true });
      set({ placement: null, justBuilt: r.instance.id });
      return { ok: true, message: 'Built!' };
    }
    const r = placeDecorFromInventory(s, p.defId, x, y);
    if (!r.ok) return { ok: false, message: placeMessage(r.error) };
    commit(r.save, { world: true });
    set({ placement: null, justBuilt: r.instance.id });
    return { ok: true, message: 'Placed!' };
  },
  buyDecor(defId: string): { ok: boolean; message: string } {
    const s = state.save; if (!s) return { ok: false, message: '' };
    const r = buyDecor(s, defId);
    if (!r.ok) return { ok: false, message: placeMessage(r.error) };
    commit(r.save);
    return { ok: true, message: 'Bought! It is in your Bag.' };
  },
  upgradeBuilding(instanceId: string): { ok: boolean; message: string } {
    const s = state.save; if (!s) return { ok: false, message: '' };
    const r = upgradeBuilding(s, instanceId);
    if (!r.ok) return { ok: false, message: placeMessage(r.error) };
    commit(r.save, { world: true });
    set({ justBuilt: instanceId });
    return { ok: true, message: 'Upgraded!' };
  },
  pickUpDecor(instanceId: string) { const s = state.save; if (s) commit(pickUpDecor(s, instanceId), { world: true }); },

  // ---- minigames ----
  startMinigame(gameId: string) {
    // Playing the activity a quest asks for counts as accepting it (the baseline is taken now, so this run counts).
    const s = state.save;
    if (s) {
      let next = s;
      for (const q of QUESTS) if (q.requirements.some((rq) => rq.type === 'activity' && rq.activityId === gameId)) next = acceptQuest(next, q.id);
      if (next !== s) commit(next, { immediate: false });
    }
    set({ modal: { type: 'minigame', gameId, runId: uid('run') }, placement: null });
  },
  finishMinigame(gameId: string, r: ActivityResultInput) {
    const s = state.save; if (!s) return null;
    const out = recordActivityResult(s, gameId, r);
    if (out.duplicate) return out;
    // activity popup first; quest / level-up popups are appended by commit()
    set({ rewards: state.rewards.concat({ id: uid('r'), title: 'Orders done!', coins: out.reward.coins, exp: out.reward.exp }) });
    commit(out.save, { levelUp: out.levelUp, completed: out.completed });
    return out;
  },
};

function placeMessage(e: string): string {
  switch (e) {
    case 'INSUFFICIENT_COINS': return 'Not enough coins.';
    case 'OVERLAP': return 'Something is already there.';
    case 'WATER': return 'You cannot build on water.';
    case 'OUT_OF_BOUNDS': return 'That is outside the town.';
    case 'LOCKED_LEVEL': return 'Reach a higher Town Level first.';
    case 'LOCKED_QUEST': return 'Finish the quest first.';
    case 'ALREADY_BUILT': return 'You already built this.';
    case 'DISABLED': return 'Coming soon!';
    case 'MAX_LEVEL': return 'Already at the highest level.';
    case 'NO_UPGRADE': return 'This building cannot be upgraded yet.';
    case 'NOT_OWNED': return 'You do not have this item.';
    default: return 'Cannot do that.';
  }
}

/** Test hook. */
export function __resetStore() {
  state = { ...state, screen: 'start', save: null, modal: null, placement: null, rewards: [], toast: null, saveStatus: 'idle', saveError: null, worldVersion: 0, justBuilt: null };
}
export function __setSave(s: SaveData) { state = { ...state, save: s }; }
