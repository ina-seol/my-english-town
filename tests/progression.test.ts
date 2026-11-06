import { describe, expect, it } from 'vitest';
import { BUILDINGS, DECORATIONS, getBuilding } from '../src/content';
import { buildBuilding, buyDecor, canPlace, placeDecorFromInventory } from '../src/systems/building';
import { MAP_H, MAP_W } from '../src/systems/building/world';
import { recordActivityResult } from '../src/systems/learning';
import { acceptQuest, evaluateQuests, npcQuest, setQuestFlag } from '../src/systems/quests';
import { createNewSave } from '../src/systems/progression/newGame';
import type { SaveData } from '../src/types';

const CHAIN = ['bakery', 'market', 'school', 'post', 'park', 'restaurant', 'library', 'hospital', 'petshop', 'clothing', 'townhall'];

function freeSpot(s: SaveData, w: number, h: number) {
  for (let y = 1; y < MAP_H - 1; y++) for (let x = 0; x < MAP_W - w; x++) if (canPlace(s, { w, h }, x, y).ok) return { x, y };
  throw new Error('town is full');
}

describe('progression is quick: each new building needs about one play', () => {
  it('walking the main chain with ONE play per building never gets stuck for coins or level', () => {
    let s = createNewSave({ nickname: 'A', grade: 4, townName: 'T', character: 'c1' });
    const plays: Record<string, number> = {};
    const play = (id: string) => { plays[id] = (plays[id] ?? 0) + 1; const r = recordActivityResult(s, id, { runId: `${id}-${plays[id]}`, stars: 1, correct: 3, wrong: 5, wordIds: [] }); s = evaluateQuests(r.save).save; };

    // tutorial: say hello, build the bakery, take orders once, place three of the cheapest decorations
    s = acceptQuest(s, 'q_hello_mia'); s = setQuestFlag(s, 'q_hello_mia', 'dialogue'); s = evaluateQuests(s).save;
    for (const id of CHAIN) {
      const def = getBuilding(id)!;
      if (id === 'bakery') s = acceptQuest(s, 'q_build_bakery');
      else if (id === 'market') {
        // decorating comes before the market in the chain
        const cheap = [...DECORATIONS].filter((d) => d.townLevel <= s.townLevel).sort((a, b) => a.cost - b.cost).slice(0, 3);
        for (const d of cheap) {
          const bought = buyDecor(s, d.id); expect(bought.ok, `buy ${d.id}`).toBe(true); if (!bought.ok) return;
          const spot = freeSpot(bought.save, d.footprint.w, d.footprint.h);
          const placed = placeDecorFromInventory(bought.save, d.id, spot.x, spot.y); expect(placed.ok).toBe(true); if (!placed.ok) return;
          s = placed.save;
        }
        s = evaluateQuests(acceptQuest(s, 'q_decorate')).save;
        expect(s.questProgress.q_decorate.status).toBe('completed');
        s = acceptQuest(s, `q_open_${id}`);
      } else s = acceptQuest(s, `q_open_${id}`);

      const spot = freeSpot(s, def.footprint.w, def.footprint.h);
      const built = buildBuilding(s, id, spot.x, spot.y);
      expect(built.ok, `${id}: coins ${s.coins}, level ${s.townLevel}, needs ${def.cost} / Lv.${def.townLevel} -> ${built.ok ? 'ok' : built.error}`).toBe(true);
      if (!built.ok) return;
      s = evaluateQuests(built.save).save;
      if (id === 'bakery') { s = acceptQuest(s, 'q_first_orders'); }
      play(def.minigame!); // one play per building
    }
    // every building was played exactly once to get here
    for (const id of CHAIN) expect(plays[id], id).toBe(1);
    expect(s.buildings.filter((b) => b.defId !== 'house')).toHaveLength(CHAIN.length);
    expect(s.questProgress.q_open_townhall.status).toBe('completed');
  });

  it('keeps prices low: no building costs more than 100 coins, decorations are cheap', () => {
    for (const b of BUILDINGS.filter((x) => x.enabled && !x.starter)) expect(b.cost, b.id).toBeLessThanOrEqual(100);
    expect(Math.max(...DECORATIONS.map((d) => d.cost))).toBeLessThanOrEqual(50);
    expect(DECORATIONS.filter((d) => d.cost <= 10).length).toBeGreaterThanOrEqual(15);
  });

  it('bonus missions never come before main ones', () => {
    let s = createNewSave({ nickname: 'A', grade: 4, townName: 'T', character: 'c1' });
    s = { ...s, questProgress: { ...s.questProgress } };
    for (const id of ['q_hello_mia', 'q_build_bakery', 'q_first_orders']) s.questProgress[id] = { status: 'completed', baseline: {}, rewardClaimed: true, flags: {} };
    s = evaluateQuests(s).save;
    // Ms. Rose has the main "decorate" mission and (later) bonus upgrade_house: the main one must be offered first
    expect(npcQuest(s, 'mia')?.quest.id).toBe('q_decorate');
    expect(npcQuest(s, 'mia')?.quest.optional).toBeFalsy();
  });
});

describe('town levels', () => {
  it('max town level is 20', async () => {
    const { ECONOMY } = await import('../src/content');
    const { levelForExp, expProgress } = await import('../src/systems/progression');
    expect(ECONOMY.levelThresholds).toHaveLength(20);
    expect(levelForExp(999999)).toBe(20);
    expect(expProgress(999999).need).toBe(0);
  });
});
