import type { SaveData } from '../types';
import { SCHEMA_VERSION } from '../systems/progression/newGame';
import { refreshAvailability } from '../systems/quests';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Returns a list of problems that make a save unusable. Empty list = usable. */
export function validateSave(raw: unknown): string[] {
  const e: string[] = [];
  if (!isObj(raw)) return ['save is not an object'];
  if (typeof raw.playerId !== 'string' || !raw.playerId) e.push('playerId missing');
  if (typeof raw.nickname !== 'string') e.push('nickname missing');
  if (![3, 4, 5, 6].includes(raw.grade as number)) e.push('grade must be 3, 4, 5 or 6');
  if (typeof raw.coins !== 'number' || raw.coins < 0 || !Number.isFinite(raw.coins)) e.push('coins invalid');
  if (typeof raw.exp !== 'number' || raw.exp < 0 || !Number.isFinite(raw.exp)) e.push('exp invalid');
  if (!Array.isArray(raw.buildings)) e.push('buildings missing');
  if (!Array.isArray(raw.decorations)) e.push('decorations missing');
  if (!isObj(raw.questProgress)) e.push('questProgress missing');
  if (typeof raw.schemaVersion === 'number' && raw.schemaVersion > SCHEMA_VERSION) e.push(`save is from a newer version (${raw.schemaVersion})`);
  return e;
}

/**
 * Migrates any older/partial save to the current schema. Throws if the save is unusable.
 * Add a `if (v < N)` block per schema change.
 */
export function migrateSave(raw: unknown): SaveData {
  const errs = validateSave(raw);
  if (errs.length) throw new Error('Invalid save: ' + errs.join(', '));
  const r = raw as Record<string, any>;
  const v = num(r.schemaVersion, 0);
  const pos: Record<string, any> = isObj(r.playerPosition) ? r.playerPosition : {};
  const s: SaveData = {
    schemaVersion: SCHEMA_VERSION,
    playerId: r.playerId,
    nickname: String(r.nickname).slice(0, 12),
    grade: r.grade,
    townName: typeof r.townName === 'string' ? r.townName : 'Sunny Village',
    selectedCharacter: typeof r.selectedCharacter === 'string' ? r.selectedCharacter : 'c1',
    playerPosition: { x: num(pos.x, 144), y: num(pos.y, 240), dir: (['up', 'down', 'left', 'right'].includes(pos.dir) ? pos.dir : 'down') },
    townLevel: Math.max(1, num(r.townLevel, 1)),
    coins: r.coins,
    exp: r.exp,
    buildings: r.buildings,
    decorations: r.decorations,
    inventory: isObj(r.inventory) ? (r.inventory as Record<string, number>) : {},
    questProgress: r.questProgress,
    npcRelationships: isObj(r.npcRelationships) ? (r.npcRelationships as Record<string, number>) : {},
    learningProgress: isObj(r.learningProgress)
      ? { activities: (isObj(r.learningProgress.activities) ? r.learningProgress.activities : {}) as SaveData['learningProgress']['activities'], wordsSeen: (isObj(r.learningProgress.wordsSeen) ? r.learningProgress.wordsSeen : {}) as Record<string, number> }
      : { activities: {}, wordsSeen: {} },
    settings: { speech: true, koreanHelp: true, sound: true, ...(isObj(r.settings) ? r.settings : {}) } as SaveData['settings'],
    tutorial: { moved: !!(isObj(r.tutorial) && r.tutorial.moved) },
    transactions: Array.isArray(r.transactions) ? r.transactions : [],
    claimedRewards: Array.isArray(r.claimedRewards) ? r.claimedRewards : [],
    nextInstanceId: num(r.nextInstanceId, 1000),
    savedAt: num(r.savedAt, Date.now()),
    revision: num(r.revision, 0),
  };
  // v0 -> v1 example: older drafts had no claimedRewards; rebuild from completed quests so rewards never re-pay.
  if (v < 1) {
    for (const [id, p] of Object.entries(s.questProgress ?? {})) if ((p as any)?.status === 'completed') s.claimedRewards.push(`quest:${id}`);
  }
  // keep instance counter ahead of existing ids
  const maxId = [...s.buildings, ...s.decorations].map((i) => Number(String(i.id).slice(1))).filter(Number.isFinite);
  s.nextInstanceId = Math.max(s.nextInstanceId, (maxId.length ? Math.max(...maxId) : 0) + 1);
  return refreshAvailability(s);
}
