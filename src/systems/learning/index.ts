import type { ActivityStats, SaveData } from '../../types';
import { BUILDINGS, ECONOMY, type Food, type GradePack, type OrderKind } from '../../content';
import { shuffle, type Rng } from '../../utils/rng';
import { grantReward } from '../economy';
import { evaluateQuests, type EvalResult } from '../quests';

export interface BakeryOrder {
  index: number;
  kind: OrderKind;
  answer: Food[];
  sentence: string;
  customer: { name: string; emoji: string };
  shelf: Food[];
}

export function fillTemplate(tpl: string, items: Food[]): string {
  // {0} -> plural form ("apples"); {0:a} -> form with article ("a cake"). Forms come from the data, never guessed.
  return tpl.replace(/\{(\d)(:a)?\}/g, (_, i, art) => { const f = items[Number(i)]; return f ? (art ? f.a ?? f.plural : f.plural) : ''; });
}

/** Build one run of orders: varied kinds, no answer food repeated within a run. */
export function generateBakeryOrders(pack: GradePack, rng: Rng): BakeryOrder[] {
  const { plan, shelfSize, templates, customers } = pack.bakery;
  const pool = shuffle(pack.foods, rng);
  const used = new Set<string>();
  const orders: BakeryOrder[] = [];
  plan.forEach((kind, index) => {
    const need = kind === 'two' ? 2 : 1;
    const answer = pool.filter((f) => !used.has(f.id)).slice(0, need);
    if (answer.length < need) throw new Error('Not enough foods in content pack');
    answer.forEach((f) => used.add(f.id));
    const distract = shuffle(pack.foods.filter((f) => !answer.includes(f)), rng).slice(0, Math.max(0, shelfSize - need));
    orders.push({
      index, kind, answer,
      sentence: fillTemplate(templates[kind], answer),
      customer: customers[index % customers.length],
      shelf: shuffle([...answer, ...distract], rng),
    });
  });
  return orders;
}

export type TrayJudgement = 'correct' | 'partial' | 'wrong';

/** Judge the tray: exact set = correct; subset of the answer = partial (not an error); any extra = wrong. */
export function judgeTray(order: BakeryOrder, trayIds: string[]): TrayJudgement {
  const ans = new Set(order.answer.map((f) => f.id));
  if (trayIds.some((id) => !ans.has(id))) return 'wrong';
  if (new Set(trayIds).size === ans.size) return 'correct';
  return 'partial';
}

/** 0 = no hint, 1 = clue, 2 = narrowed shelf + sentence, 3 = explained answer. */
export function hintLevel(wrongAttempts: number): 0 | 1 | 2 | 3 {
  return Math.min(3, Math.max(0, wrongAttempts)) as 0 | 1 | 2 | 3;
}

export function narrowShelf(order: BakeryOrder, rng: Rng): Food[] {
  const wrong = order.shelf.filter((f) => !order.answer.includes(f));
  return shuffle([...order.answer, ...shuffle(wrong, rng).slice(0, 2)], rng);
}

export function starsFor(totalWrong: number): 1 | 2 | 3 {
  return totalWrong === 0 ? 3 : totalWrong <= 2 ? 2 : 1;
}

export const emptyStats = (): ActivityStats => ({ plays: 0, completions: 0, bestStars: 0, repeatRewards: 0, correct: 0, wrong: 0 });

export interface ActivityResultInput { runId: string; stars: number; correct: number; wrong: number; wordIds: string[] }
export interface ActivityOutcome extends EvalResult {
  duplicate: boolean;
  reward: { coins: number; exp: number };
  firstTime: boolean;
  activityLevelUp?: number;
}

/**
 * Records a finished mini-game run: first completion pays the "first" reward, later runs pay a
 * smaller repeat reward until the cap, then a token reward. Each runId pays at most once.
 */
export function recordActivityResult(save: SaveData, activityId: string, r: ActivityResultInput, now = Date.now()): ActivityOutcome {
  const key = `activity:${activityId}:${r.runId}`;
  if (save.claimedRewards.includes(key)) return { save, completed: [], duplicate: true, reward: { coins: 0, exp: 0 }, firstTime: false };
  const stats = save.learningProgress.activities[activityId] ?? emptyStats();
  const firstTime = stats.completions === 0;
  const rw = ECONOMY.rewards;
  let base = firstTime ? rw.activityFirst : stats.repeatRewards < rw.activityRepeat.cap ? rw.activityRepeat : rw.activityAfterCap;
  const bonus = rw.starBonus[String(r.stars)] ?? 0;
  // an upgraded building pays a little more for the activity it hosts
  const host = save.buildings.find((b) => BUILDINGS.find((d) => d.id === b.defId)?.minigame === activityId);
  const levelBonus = host ? Math.max(0, host.level - 1) * (BUILDINGS.find((d) => d.id === host.defId)?.levelBonusCoins ?? 0) : 0;
  const reward = { coins: base.coins + bonus + levelBonus, exp: base.exp };
  const g = grantReward(save, key, reward, `activity:${activityId}`, now);
  const wordsSeen = { ...save.learningProgress.wordsSeen };
  for (const w of r.wordIds) wordsSeen[w] = (wordsSeen[w] ?? 0) + 1;
  const next: ActivityStats = {
    plays: stats.plays + 1,
    completions: stats.completions + 1,
    bestStars: Math.max(stats.bestStars, r.stars),
    repeatRewards: stats.repeatRewards + (firstTime ? 0 : 1),
    correct: stats.correct + r.correct,
    wrong: stats.wrong + r.wrong,
    firstCompletedAt: stats.firstCompletedAt ?? now,
  };
  let s: SaveData = { ...g.save, learningProgress: { activities: { ...g.save.learningProgress.activities, [activityId]: next }, wordsSeen } };
  const ev = evaluateQuests(s, now);
  return { ...ev, levelUp: ev.levelUp ?? g.levelUp, duplicate: false, reward, firstTime };
}
