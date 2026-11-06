import { describe, expect, it } from 'vitest';
import { NPCS, QUESTS, getBuilding, getPack, validateGameData, validatePack } from '../src/content';
import { pickWanderPath } from '../src/game/wander';
import { createNewSave } from '../src/systems/progression/newGame';
import { acceptQuest, evaluateQuests, npcQuest, setQuestFlag } from '../src/systems/quests';
import { buildBuilding } from '../src/systems/building';
import { recordActivityResult } from '../src/systems/learning';
import { mulberry32 } from '../src/utils/rng';

describe('wandering residents', () => {
  const rand = mulberry32(5);
  it('only walks to free, reachable tiles near home', () => {
    const blocked = new Set(['5,5', '5,6', '6,5']);
    for (let i = 0; i < 200; i++) {
      const p = pickWanderPath({ x: 6, y: 6 }, { x: 6, y: 6 }, blocked, new Set(), rand);
      if (!p) continue;
      for (const t of p) expect(blocked.has(`${t.x},${t.y}`)).toBe(false);
      const end = p[p.length - 1];
      expect(Math.abs(end.x - 6)).toBeLessThanOrEqual(2); expect(Math.abs(end.y - 6)).toBeLessThanOrEqual(2);
      expect(p.length).toBeLessThanOrEqual(7);
    }
  });
  it('stays put when fenced in or when every nearby tile is taken', () => {
    const fenced = new Set<string>();
    for (let x = 0; x < 24; x++) for (let y = 0; y < 18; y++) if (!(x === 6 && y === 6)) fenced.add(`${x},${y}`);
    expect(pickWanderPath({ x: 6, y: 6 }, { x: 6, y: 6 }, fenced, new Set(), rand)).toBeNull();
  });
  it('never targets a tile another resident occupies', () => {
    const occupied = new Set<string>();
    for (let x = 4; x <= 8; x++) for (let y = 4; y <= 8; y++) if (!(x === 6 && y === 6)) occupied.add(`${x},${y}`);
    expect(pickWanderPath({ x: 6, y: 6 }, { x: 6, y: 6 }, new Set(), occupied, rand)).toBeNull();
  });
});

describe('open-a-building quest chain', () => {
  it('data is consistent for every grade', () => {
    expect(validateGameData()).toEqual([]);
    for (const g of [3, 4, 5, 6] as const) expect(validatePack(getPack(g))).toEqual([]);
    for (const id of ['grocer', 'teacher', 'postman', 'ranger']) {
      const n = NPCS.find((x) => x.id === id)!;
      expect(getBuilding(n.building!)?.minigame).toBeTruthy();
    }
    expect(QUESTS.filter((q) => q.id.startsWith('q_open_')).map((q) => q.id)).toEqual(['q_open_market', 'q_open_school', 'q_open_post', 'q_open_park']);
  });
  it('unlocks after decorating and completes on build + one play, paying once', () => {
    let s = createNewSave({ nickname: 'A', grade: 5, townName: 'T', character: 'c1' });
    s = { ...s, coins: 2000, townLevel: 5, questProgress: { ...s.questProgress } };
    for (const id of ['q_hello_mia', 'q_build_bakery', 'q_first_orders', 'q_decorate']) s = { ...s, questProgress: { ...s.questProgress, [id]: { status: 'completed', baseline: {}, rewardClaimed: true, flags: {} } } };
    s = evaluateQuests(s).save;
    expect(npcQuest(s, 'mia')?.quest.id).toBe('q_open_market');
    s = acceptQuest(s, 'q_open_market');
    const b = buildBuilding(s, 'market', 13, 4); expect(b.ok).toBe(true); if (!b.ok) return;
    expect(evaluateQuests(b.save).completed).toHaveLength(0); // built, not yet played
    const played = recordActivityResult(b.save, 'market', { runId: 'r1', stars: 3, correct: 3, wrong: 0, wordIds: [] });
    expect(played.completed.map((q) => q.id)).toContain('q_open_market');
    const again = recordActivityResult(played.save, 'market', { runId: 'r2', stars: 3, correct: 3, wrong: 0, wordIds: [] });
    expect(again.completed).toHaveLength(0);
    expect(evaluateQuests(again.save).save.questProgress.q_open_school.status).toBe('available');
    void setQuestFlag;
  });
});
