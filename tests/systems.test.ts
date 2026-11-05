import { describe, expect, it } from 'vitest';
import { createNewSave } from '../src/systems/progression/newGame';
import { grantReward, spend } from '../src/systems/economy';
import { buildBuilding, buyDecor, canPlace, findPath, blockedTiles, moveInstance, nextUpgrade, pickUpDecor, placeDecorFromInventory, upgradeBuilding } from '../src/systems/building';
import { acceptQuest, evaluateQuests, npcQuest, setQuestFlag } from '../src/systems/quests';
import { generateBakeryOrders, judgeTray, recordActivityResult, starsFor, fillTemplate } from '../src/systems/learning';
import { getPack, validateGameData, validatePack, ECONOMY } from '../src/content';
import { mulberry32 } from '../src/utils/rng';
import { levelForExp } from '../src/systems/progression';
import type { SaveData } from '../src/types';

const fresh = (grade: 3 | 4 | 5 | 6 = 3): SaveData => createNewSave({ nickname: 'Amy', grade, townName: 'Test', character: 'c1' });

/** Plays the tutorial up to a built bakery. */
function toBakery(): SaveData {
  let s = fresh();
  s = acceptQuest(s, 'q_hello_mia');
  s = setQuestFlag(s, 'q_hello_mia', 'dialogue');
  s = evaluateQuests(s).save;
  s = acceptQuest(s, 'q_build_bakery');
  const r = buildBuilding(s, 'bakery', 13, 4);
  if (!r.ok) throw new Error('build failed ' + r.error);
  return evaluateQuests(r.save).save;
}

describe('economy', () => {
  it('pays a keyed reward exactly once', () => {
    const s = fresh();
    const a = grantReward(s, 'k1', { coins: 10, exp: 5 }, 't');
    const b = grantReward(a.save, 'k1', { coins: 10, exp: 5 }, 't');
    expect(a.granted).toBe(true);
    expect(b.granted).toBe(false);
    expect(b.save.coins).toBe(s.coins + 10);
    expect(b.save.exp).toBe(5);
  });
  it('records transactions and refuses overspending', () => {
    const s = fresh();
    expect(spend(s, s.coins + 1, 'x')).toEqual({ ok: false, error: 'INSUFFICIENT_COINS' });
    const r = spend(s, 30, 'x');
    expect(r.ok && r.save.coins).toBe(s.coins - 30);
    expect(r.ok && r.save.transactions.at(-1)?.amount).toBe(-30);
  });
  it('levels up from exp thresholds', () => {
    const s = fresh();
    expect(levelForExp(0)).toBe(1);
    const g = grantReward(s, 'big', { exp: ECONOMY.levelThresholds[1] }, 't');
    expect(g.levelUp).toBe(2);
    expect(g.save.townLevel).toBe(2);
  });
});

describe('building', () => {
  it('starts with a house and free land', () => {
    const s = fresh();
    expect(s.buildings).toHaveLength(1);
    expect(canPlace(s, { w: 3, h: 2 }, 13, 4).ok).toBe(true);
  });
  it('rejects overlap, water and out-of-bounds', () => {
    const s = fresh();
    expect(canPlace(s, { w: 3, h: 2 }, 2, 3)).toEqual({ ok: false, reason: 'OVERLAP' });
    expect(canPlace(s, { w: 3, h: 2 }, 19, 2)).toEqual({ ok: false, reason: 'WATER' });
    expect(canPlace(s, { w: 3, h: 2 }, 22, 16)).toEqual({ ok: false, reason: 'OUT_OF_BOUNDS' });
  });
  it('locks the bakery until the first quest is done, then charges 120 coins', () => {
    const s = fresh();
    const locked = buildBuilding(s, 'bakery', 13, 4);
    expect(locked).toEqual({ ok: false, error: 'LOCKED_QUEST' });
    const b = toBakery();
    expect(b.buildings.some((x) => x.defId === 'bakery')).toBe(true);
    expect(b.coins).toBe(ECONOMY.startCoins + 40 - 120 + 20); // + hello reward, - cost, + build quest reward
  });
  it('does not double-place or charge on a bad spot', () => {
    let s = fresh();
    s = acceptQuest(s, 'q_hello_mia'); s = setQuestFlag(s, 'q_hello_mia', 'dialogue'); s = evaluateQuests(s).save;
    const bad = buildBuilding(s, 'bakery', 2, 3);
    expect(bad).toEqual({ ok: false, error: 'OVERLAP' });
    expect(s.coins).toBe(ECONOMY.startCoins + 40);
    const ok = buildBuilding(s, 'bakery', 13, 4);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(buildBuilding(ok.save, 'bakery', 13, 8)).toEqual({ ok: false, error: 'ALREADY_BUILT' });
  });
  it('refuses to build with too few coins', () => {
    let s = fresh(); s = acceptQuest(s, 'q_hello_mia'); s = setQuestFlag(s, 'q_hello_mia', 'dialogue');
    s = { ...evaluateQuests(s).save, coins: 50 };
    expect(buildBuilding(s, 'bakery', 13, 4)).toEqual({ ok: false, error: 'INSUFFICIENT_COINS' });
  });
  it('moves buildings only to valid tiles', () => {
    const s = fresh();
    expect(moveInstance(s, 'b1', 8, 12).ok).toBe(true);
    expect(moveInstance(s, 'b1', 19, 2)).toEqual({ ok: false, error: 'WATER' });
    expect(moveInstance(s, 'b1', 3, 3).ok).toBe(true); // overlapping itself is fine
  });
  it('decor: buy -> place -> pick up round trip', () => {
    let s = fresh();
    const bought = buyDecor(s, 'tree');
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    s = bought.save;
    expect(s.inventory.tree).toBe(1);
    const placed = placeDecorFromInventory(s, 'tree', 8, 12);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(placed.save.inventory.tree).toBeUndefined();
    expect(placeDecorFromInventory(placed.save, 'tree', 9, 12)).toEqual({ ok: false, error: 'NOT_OWNED' });
    const back = pickUpDecor(placed.save, placed.instance.id);
    expect(back.inventory.tree).toBe(1);
    expect(back.decorations).toHaveLength(0);
  });
  it('locks level-2 decor and blocks pathing through buildings', () => {
    const s = fresh();
    expect(buyDecor(s, 'fountain')).toEqual({ ok: false, error: 'LOCKED_LEVEL' });
    const blocked = blockedTiles(s);
    expect(blocked.has('2,3')).toBe(true);
    const p = findPath(blocked, { x: 4, y: 7 }, { x: 11, y: 12 });
    expect(p && p.length).toBeGreaterThan(5);
    expect(findPath(blocked, { x: 4, y: 7 }, { x: 2, y: 3 })).toBeNull();
  });
});

describe('building upgrades', () => {
  it('upgrades 1 -> 2 -> 3 for the listed cost, keeping position', () => {
    let s = { ...fresh(), coins: 1000, townLevel: 3 };
    const before = s.buildings[0];
    expect(nextUpgrade(s, 'b1')).toMatchObject({ cost: 100, toLevel: 2 });
    const r1 = upgradeBuilding(s, 'b1'); expect(r1.ok).toBe(true); if (!r1.ok) return;
    expect(r1.save.coins).toBe(900); expect(r1.save.buildings[0]).toMatchObject({ level: 2, x: before.x, y: before.y });
    const r2 = upgradeBuilding(r1.save, 'b1'); expect(r2.ok).toBe(true); if (!r2.ok) return;
    expect(r2.save.coins).toBe(700); expect(r2.save.buildings[0].level).toBe(3);
    expect(upgradeBuilding(r2.save, 'b1')).toEqual({ ok: false, error: 'MAX_LEVEL' });
    expect(nextUpgrade(r2.save, 'b1')).toBeNull();
  });
  it('refuses when poor or when the town level is too low, charging nothing', () => {
    const poor = { ...fresh(), coins: 50, townLevel: 3 };
    expect(upgradeBuilding(poor, 'b1')).toEqual({ ok: false, error: 'INSUFFICIENT_COINS' });
    const low = { ...fresh(), coins: 1000, townLevel: 1 };
    expect(upgradeBuilding(low, 'b1')).toEqual({ ok: false, error: 'LOCKED_LEVEL' });
    expect(upgradeBuilding(low, 'nope')).toEqual({ ok: false, error: 'UNKNOWN' });
  });
  it('a higher-level bakery pays a bonus on activity rewards', () => {
    let s = toBakery();
    s = acceptQuest(s, 'q_first_orders');
    const run = (save: SaveData, id: string) => recordActivityResult(save, 'bakery', { runId: id, stars: 1, correct: 3, wrong: 5, wordIds: [] });
    const lvl1 = run(s, 'a');
    const up = { ...s, buildings: s.buildings.map((b) => (b.defId === 'bakery' ? { ...b, level: 3 } : b)) };
    const lvl3 = run(up, 'a');
    expect(lvl3.reward.coins - lvl1.reward.coins).toBe(10); // 2 levels x 5 coins
  });
});

describe('quests', () => {
  it('chains story quests and pays each reward once', () => {
    let s = fresh();
    expect(npcQuest(s, 'mia')?.status).toBe('available');
    s = acceptQuest(s, 'q_hello_mia');
    expect(evaluateQuests(s).completed).toHaveLength(0); // needs the dialogue
    s = setQuestFlag(s, 'q_hello_mia', 'dialogue');
    const r = evaluateQuests(s);
    expect(r.completed.map((q) => q.id)).toEqual(['q_hello_mia']);
    expect(r.save.questProgress.q_build_bakery.status).toBe('available');
    const again = evaluateQuests(r.save);
    expect(again.completed).toHaveLength(0);
    expect(again.save.coins).toBe(r.save.coins);
  });
  it('does not count activity plays done before accepting', () => {
    let s = toBakery();
    s = { ...s, learningProgress: { ...s.learningProgress, activities: { bakery: { plays: 1, completions: 1, bestStars: 3, repeatRewards: 0, correct: 3, wrong: 0 } } } };
    s = acceptQuest(s, 'q_first_orders');
    expect(evaluateQuests(s).completed).toHaveLength(0);
  });
});

describe('bakery learning engine', () => {
  for (const grade of [3, 4, 5, 6] as const) {
    it(`generates valid, varied orders for grade ${grade}`, () => {
      const pack = getPack(grade);
      for (let seed = 1; seed <= 40; seed++) {
        const orders = generateBakeryOrders(pack, mulberry32(seed));
        expect(orders).toHaveLength(3);
        const used = orders.flatMap((o) => o.answer.map((f) => f.id));
        expect(new Set(used).size).toBe(used.length);
        for (const o of orders) {
          expect(o.shelf.length).toBe(pack.bakery.shelfSize);
          for (const a of o.answer) expect(o.shelf.map((f) => f.id)).toContain(a.id);
          expect(new Set(o.shelf.map((f) => f.id)).size).toBe(o.shelf.length);
        }
      }
    });
  }
  it('uses correct word forms in sentences', () => {
    const p = getPack(3);
    const f = (id: string) => p.foods.find((x) => x.id === id)!;
    expect(fillTemplate('I like {0}.', [f('apple')])).toBe('I like apples.');
    expect(fillTemplate('I like {0}.', [f('pizza')])).toBe('I like pizza.');
    expect(fillTemplate('I like {0} and {1}.', [f('tomato'), f('egg')])).toBe('I like tomatoes and eggs.');
  });
  it('grade 5 and 6 sentences use correct articles and forms', () => {
    const f5 = (id: string) => getPack(5).foods.find((x) => x.id === id)!;
    expect(fillTemplate("I'd like {0:a} and {1:a}.", [f5('cake'), f5('grape')])).toBe("I'd like a cake and grapes.");
    expect(fillTemplate("I'd like {0:a}.", [f5('spaghetti')])).toBe("I'd like spaghetti.");
    const f6 = (id: string) => getPack(6).foods.find((x) => x.id === id)!;
    expect(fillTemplate("I'm going to eat {0} and {1}.", [f6('hamburger'), f6('sandwich')])).toBe("I'm going to eat hamburgers and sandwiches.");
  });
  it('every grade can play the whole tutorial', () => {
    for (const g of [3, 4, 5, 6] as const) {
      let s = fresh(g);
      s = acceptQuest(s, 'q_hello_mia'); s = setQuestFlag(s, 'q_hello_mia', 'dialogue');
      expect(evaluateQuests(s).completed.map((q) => q.id)).toEqual(['q_hello_mia']);
    }
  });
  it('judges the tray', () => {
    const o = generateBakeryOrders(getPack(4), mulberry32(3)).find((x) => x.kind === 'two')!;
    const [a, b] = o.answer;
    const wrongId = o.shelf.find((f) => !o.answer.includes(f))!.id;
    expect(judgeTray(o, [a.id, b.id])).toBe('correct');
    expect(judgeTray(o, [a.id])).toBe('partial');
    expect(judgeTray(o, [a.id, wrongId])).toBe('wrong');
    expect(judgeTray(o, [wrongId])).toBe('wrong');
    expect(starsFor(0)).toBe(3); expect(starsFor(2)).toBe(2); expect(starsFor(5)).toBe(1);
  });
  it('first run pays more than repeats, repeat is capped, a run pays only once', () => {
    let s = toBakery();
    s = acceptQuest(s, 'q_first_orders');
    const before = s.coins;
    const r1 = recordActivityResult(s, 'bakery', { runId: 'r1', stars: 3, correct: 3, wrong: 0, wordIds: ['apple'] });
    expect(r1.firstTime).toBe(true);
    expect(r1.reward.coins).toBe(ECONOMY.rewards.activityFirst.coins + ECONOMY.rewards.starBonus['3']);
    expect(r1.completed.map((q) => q.id)).toContain('q_first_orders');
    const dup = recordActivityResult(r1.save, 'bakery', { runId: 'r1', stars: 3, correct: 3, wrong: 0, wordIds: [] });
    expect(dup.duplicate).toBe(true);
    expect(dup.save.coins).toBe(r1.save.coins);
    expect(r1.save.coins).toBeGreaterThan(before);
    let cur = r1.save; const gains: number[] = [];
    for (let i = 0; i < ECONOMY.rewards.activityRepeat.cap + 2; i++) {
      const c = cur.coins; cur = recordActivityResult(cur, 'bakery', { runId: 'x' + i, stars: 1, correct: 3, wrong: 5, wordIds: [] }).save; gains.push(cur.coins - c);
    }
    expect(gains[0]).toBe(ECONOMY.rewards.activityRepeat.coins);
    expect(gains.at(-1)).toBe(ECONOMY.rewards.activityAfterCap.coins);
    expect(r1.save.learningProgress.wordsSeen.apple).toBe(1);
  });
});

describe('content validation', () => {
  it('shipped data is valid', () => {
    expect(validateGameData()).toEqual([]);
    expect(validatePack(getPack(3))).toEqual([]);
    expect(validatePack(getPack(4))).toEqual([]);
    expect(validatePack(getPack(5))).toEqual([]);
    expect(validatePack(getPack(6))).toEqual([]);
  });
  it('reports (not throws) on broken packs', () => {
    const bad = JSON.parse(JSON.stringify(getPack(3)));
    bad.foods[1].id = bad.foods[0].id;
    bad.bakery.plan.push('teleport');
    bad.scripts.q_hello_mia.dialogue.choices.forEach((c: { correct?: boolean }) => (c.correct = false));
    delete bad.scripts.q_decorate;
    const errs = validatePack(bad);
    expect(errs.join('|')).toMatch(/duplicate food id/);
    expect(errs.join('|')).toMatch(/unsupported order kind/);
    expect(errs.join('|')).toMatch(/exactly 1 correct/);
    expect(errs.join('|')).toMatch(/missing script for quest q_decorate/);
    expect(() => validatePack(null as never)).not.toThrow();
  });
});
