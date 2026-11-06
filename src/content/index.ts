import economy from './economy.json';
import buildingsJson from './buildings.json';
import decorationsJson from './decorations.json';
import npcsJson from './npcs.json';
import questsJson from './quests.json';
import g3 from './grade3/town.json';
import g4 from './grade4/town.json';
import g5 from './grade5/town.json';
import g6 from './grade6/town.json';
import type { Bilingual, Grade } from '../types';

/** `plural` is the form used after "I like ..."; `a` (optional) is the form with its article, e.g. "a cake". */
export interface Food { id: string; word: string; plural: string; a?: string; ko: string; emoji: string }
export type OrderKind = 'text' | 'two' | 'listen';
export interface DialogueChoice { en: string; ko: string; correct?: boolean }
export interface QuestScript {
  offer: Bilingual[];
  dialogue?: { prompt: Bilingual; choices: DialogueChoice[]; hint: Bilingual; explain: Bilingual; success: Bilingual };
  remind: Bilingual;
  done: Bilingual;
}
export interface SchoolCfg { days: { id: string; en: string; ko: string; short: string }[]; subjects: { id: string; en: string; ko: string; emoji: string }[]; rounds: number; templates: { read: string; listen: string } }
export interface MarketItem { id: string; emoji: string; ko: string; name: string; verb: string; price: number; pron: string; pron2?: string }
export interface MarketCfg { unit: string; rounds: number; shelfSize: number; templates: { ask: string; answer: string }; items: MarketItem[] }
export interface PostCfg {
  rounds: number; things: Record<string, { en: string; ko: string; emoji: string }>; colors: Record<string, string>;
  residents: { id: string; name: string; emoji: string; color: string; thing: string; ko: string }[];
  templates: { clue: string; ask: string; yes: string; no: string };
}
export interface ParkCfg { rounds: number; actions: { id: string; base: string; ing: string; ko: string; emoji: string; anim: string }[]; mode: 'choose' | 'build'; actor: string; q: string; a: string; tokens: string[] }

export interface RestaurantCfg { rounds: number; extra: number; dishes: { word: string; ko: string; emoji: string; say: string }[] }
export interface LibraryCfg { rounds: number; sentences: { en: string; ko: string }[] }
export interface HospitalCfg { rounds: number; pairs: { q: string; a: string; qko: string; ako: string }[] }
export interface PetshopCfg { rounds: number; min: number; max: number; q: string; a: string; animals: { id: string; emoji: string; one: string; many: string; ko: string }[] }
export interface ClothingCfg { rounds: number; template: string; clothes: { id: string; emoji: string; art: string; noun: string; ko: string }[]; colors: { id: string; ko: string; hex: string }[] }
export interface TownhallCfg { rounds: number }

export interface GradePack {
  grade: Grade; packId: string; topic: string;
  foods: Food[];
  bakery: { plan: OrderKind[]; shelfSize: number; templates: Record<string, string>; customers: { name: string; emoji: string }[] };
  scripts: Record<string, QuestScript>;
  idle: Record<string, Bilingual[]>;
  school?: SchoolCfg; market?: MarketCfg; post?: PostCfg; park?: ParkCfg;
  restaurant?: RestaurantCfg; library?: LibraryCfg; hospital?: HospitalCfg; petshop?: PetshopCfg; clothing?: ClothingCfg; townhall?: TownhallCfg;
}
export interface BuildingDef {
  id: string; name: string; ko: string; footprint: { w: number; h: number }; render: { w: number; h: number };
  cost: number; townLevel: number; enabled: boolean; starter?: boolean; color: string; roof: string;
  minigame: string | null; requiresQuest?: string; npc?: string;
  /** cost + required Town Level to reach level 2 and 3 */
  upgrades?: { cost: number; townLevel: number }[];
  /** extra coins per activity reward for each level above 1 */
  levelBonusCoins?: number;
}
export interface DecorDef { id: string; name: string; ko: string; category?: string; footprint: { w: number; h: number }; cost: number; townLevel: number; emoji: string }
export interface NpcDef { id: string; name: string; ko: string; home?: { x: number; y: number }; building?: string; color: string; emoji: string }
export type Requirement =
  | { type: 'flag'; flag: string }
  | { type: 'build'; buildingId: string }
  | { type: 'activity'; activityId: string; count: number }
  | { type: 'decor'; count: number }
  | { type: 'upgrade'; buildingId: string; level: number }
  | { type: 'upgradeCount'; level: number; count: number }
  | { type: 'townLevel'; level: number };
export interface QuestDef {
  id: string; type: 'story' | 'daily' | 'building' | 'collection' | 'special';
  title: Bilingual; npc: string; description: Bilingual; /** shown in the top bar while this is the next thing to do */ goal?: Bilingual; /** bonus mission: never blocks the building chain and is shown after the main goals */ optional?: boolean; buildingId?: string;
  prerequisites: string[]; requirements: Requirement[]; reward: { coins: number; exp: number };
}
export interface Economy {
  startCoins: number; levelThresholds: number[];
  rewards: {
    activityFirst: { coins: number; exp: number };
    activityRepeat: { coins: number; exp: number; cap: number };
    activityAfterCap: { coins: number; exp: number };
    starBonus: Record<string, number>;
  };
}

export const ECONOMY = economy as Economy;
export const BUILDINGS = buildingsJson as BuildingDef[];
export const DECORATIONS = decorationsJson as DecorDef[];
export const NPCS = npcsJson as NpcDef[];
export const QUESTS = questsJson as QuestDef[];
export const PACKS: Record<number, GradePack> = {
  3: g3 as unknown as GradePack, 4: g4 as unknown as GradePack, 5: g5 as unknown as GradePack, 6: g6 as unknown as GradePack,
};
export const GRADES: Grade[] = [3, 4, 5, 6];

export const getBuilding = (id: string) => BUILDINGS.find((b) => b.id === id);
export const getDecor = (id: string) => DECORATIONS.find((d) => d.id === id);
export const getNpc = (id: string) => NPCS.find((n) => n.id === id);
export const getQuest = (id: string) => QUESTS.find((q) => q.id === id);
export const getPack = (grade: Grade): GradePack => PACKS[grade] ?? PACKS[3];

export const SUPPORTED_ORDER_KINDS: OrderKind[] = ['text', 'two', 'listen'];

/** Content validation: returns a list of human-readable problems. Never throws. */
export function validatePack(pack: GradePack, quests: QuestDef[] = QUESTS): string[] {
  const errs: string[] = [];
  const tag = `[${pack?.packId ?? 'pack'}]`;
  try {
    if (!pack || ![3, 4, 5, 6].includes(pack.grade)) errs.push(`${tag} grade must be 3, 4, 5 or 6`);
    if (!Array.isArray(pack.foods) || pack.foods.length === 0) { errs.push(`${tag} foods is empty`); return errs; }
    const seen = new Set<string>();
    for (const f of pack.foods) {
      for (const k of ['id', 'word', 'plural', 'ko', 'emoji'] as const) if (!f[k]) errs.push(`${tag} food ${f.id ?? '?'} missing ${k}`);
      if (seen.has(f.id)) errs.push(`${tag} duplicate food id ${f.id}`);
      seen.add(f.id);
    }
    const b = pack.bakery;
    if (!b) errs.push(`${tag} bakery config missing`);
    else {
      if (!Array.isArray(b.plan) || b.plan.length === 0) errs.push(`${tag} bakery.plan empty`);
      for (const k of b.plan ?? []) {
        if (!SUPPORTED_ORDER_KINDS.includes(k)) errs.push(`${tag} unsupported order kind "${k}"`);
        if (!b.templates?.[k] || !/\{0(:a)?\}/.test(b.templates[k])) errs.push(`${tag} template for "${k}" missing or has no {0}`);
        if (k === 'two' && !/\{1(:a)?\}/.test(b.templates?.two ?? '')) errs.push(`${tag} template "two" needs {1}`);
      }
      if (b.shelfSize < 3 || b.shelfSize > pack.foods.length) errs.push(`${tag} shelfSize must be 3..${pack.foods.length}`);
    }
    errs.push(...validateGames(pack, tag));
    for (const q of quests) {
      const s = pack.scripts?.[q.id];
      if (!s) { errs.push(`${tag} missing script for quest ${q.id}`); continue; }
      if (!s.offer?.length || !s.remind || !s.done) errs.push(`${tag} script ${q.id} incomplete`);
      const needsDialogue = q.requirements.some((r) => r.type === 'flag' && r.flag === 'dialogue');
      if (needsDialogue) {
        const d = s.dialogue;
        if (!d) errs.push(`${tag} quest ${q.id} needs a dialogue`);
        else {
          const correct = d.choices.filter((c) => c.correct).length;
          if (correct !== 1) errs.push(`${tag} dialogue of ${q.id} must have exactly 1 correct choice (has ${correct})`);
          if (d.choices.length < 3) errs.push(`${tag} dialogue of ${q.id} needs >= 3 choices`);
        }
      }
    }
  } catch (e) {
    errs.push(`${tag} validation crashed: ${(e as Error).message}`);
  }
  return errs;
}

/** Cross-file checks: quests <-> npcs <-> buildings <-> activities. */
export function validateGameData(): string[] {
  const errs: string[] = [];
  const dup = (arr: { id: string }[], name: string) => {
    const s = new Set<string>();
    for (const x of arr) { if (s.has(x.id)) errs.push(`duplicate ${name} id ${x.id}`); s.add(x.id); }
  };
  dup(BUILDINGS, 'building'); dup(DECORATIONS, 'decoration'); dup(NPCS, 'npc'); dup(QUESTS, 'quest');
  const qIds = new Set(QUESTS.map((q) => q.id));
  for (const q of QUESTS) {
    if (!getNpc(q.npc)) errs.push(`quest ${q.id}: unknown npc ${q.npc}`);
    if (q.buildingId && !getBuilding(q.buildingId)) errs.push(`quest ${q.id}: unknown building ${q.buildingId}`);
    for (const p of q.prerequisites) if (!qIds.has(p)) errs.push(`quest ${q.id}: unknown prerequisite ${p}`);
    for (const r of q.requirements) {
      if (r.type === 'build' && !getBuilding(r.buildingId)) errs.push(`quest ${q.id}: requirement building ${r.buildingId} unknown`);
      if (r.type === 'activity' && !BUILDINGS.some((b) => b.minigame === r.activityId)) errs.push(`quest ${q.id}: activity ${r.activityId} has no building`);
      if (r.type === 'upgrade' && !(getBuilding(r.buildingId)?.upgrades?.length)) errs.push(`quest ${q.id}: building ${r.buildingId} cannot be upgraded`);
      if (r.type === 'upgrade' && (r.level < 2 || r.level > 3)) errs.push(`quest ${q.id}: upgrade level must be 2 or 3`);
      if (r.type === 'townLevel' && (r.level < 2 || r.level > ECONOMY.levelThresholds.length)) errs.push(`quest ${q.id}: townLevel out of range`);
      if (r.type === 'upgradeCount' && (r.level < 2 || r.level > 3 || r.count > BUILDINGS.filter((b) => b.upgrades?.length && b.enabled).length)) errs.push(`quest ${q.id}: upgradeCount needs level 2-3 and at most as many buildings as can be upgraded`);
    }
  }
  for (const b of BUILDINGS) if (b.requiresQuest && !qIds.has(b.requiresQuest)) errs.push(`building ${b.id}: unknown requiresQuest`);
  return errs;
}

export function substitute(text: string, nick: string): string {
  return text.replace(/\{nick\}/g, nick);
}

function validateGames(pack: GradePack, tag: string): string[] {
  const e: string[] = [];
  const need = (cond: boolean, msg: string) => { if (!cond) e.push(`${tag} ${msg}`); };
  const { school: sc, market: mk, post: po, park: pk } = pack;
  need(!!sc && !!mk && !!po && !!pk, 'needs school, market, post and park sections');
  const { restaurant: rs, library: lb, hospital: hp, petshop: ps, clothing: cl, townhall: th } = pack;
  need(!!rs && !!lb && !!hp && !!ps && !!cl && !!th, 'needs restaurant, library, hospital, petshop, clothing and townhall sections');
  if (rs) {
    need(rs.dishes.length >= rs.rounds, 'restaurant: not enough dishes');
    need(rs.dishes.every((d) => /^[a-z]+$/.test(d.word)), 'restaurant: dish words must be lowercase letters only');
    need(rs.dishes.every((d) => d.say.length > 0), 'restaurant: every dish needs a spoken sentence');
  }
  if (lb) need(lb.sentences.length >= lb.rounds && lb.sentences.every((x) => x.en.split(' ').length >= 3), 'library: needs enough sentences of 3+ words');
  if (hp) need(hp.pairs.length >= hp.rounds && new Set(hp.pairs.map((x) => x.q)).size === hp.pairs.length && new Set(hp.pairs.map((x) => x.a)).size === hp.pairs.length, 'hospital: pairs must be unique questions with unique answers');
  if (ps) need(ps.animals.length >= ps.rounds && ps.min >= 1 && ps.max > ps.min && ps.max <= 99 && /\{number\}/.test(ps.a) && /\{many\}/.test(ps.q), 'petshop: bad counts or templates');
  if (cl) need(cl.clothes.length >= cl.rounds && cl.colors.length >= cl.rounds && /\{color\}/.test(cl.template) && /\{noun\}/.test(cl.template), 'clothing: not enough items/colours or template needs {color} and {noun}');
  if (th) need(th.rounds >= 3 && th.rounds <= 8, 'townhall: rounds must be 3..8');
  if (sc) {
    need(sc.days.length >= sc.rounds && sc.subjects.length >= sc.rounds, 'school: not enough days/subjects for the rounds');
    need(/\{day\}/.test(sc.templates.read) && /\{subject\}/.test(sc.templates.read), 'school: read template needs {day} and {subject}');
    need(/\{day\}/.test(sc.templates.listen) && /\{subject\}/.test(sc.templates.listen), 'school: listen template needs {day} and {subject}');
  }
  if (mk) {
    need(mk.items.length >= mk.shelfSize && mk.shelfSize >= mk.rounds, 'market: shelfSize must be <= items and >= rounds');
    need(mk.items.every((i) => Number.isInteger(i.price) && i.price > 0), 'market: every price must be a positive whole number');
    need(new Set(mk.items.map((i) => i.id)).size === mk.items.length, 'market: duplicate item id');
  }
  if (po) {
    need(po.residents.length >= po.rounds, 'post: not enough residents');
    const pairs = po.residents.map((r) => `${r.color}/${r.thing}`);
    need(new Set(pairs).size === pairs.length, 'post: two residents have the same colour+thing (owner would be ambiguous)');
    need(po.residents.every((r) => !!po.things[r.thing] && !!po.colors[r.color]), 'post: resident uses an unknown thing or colour');
  }
  if (pk) {
    need(pk.actions.length >= pk.rounds + 2, 'park: needs at least rounds+2 actions (for wrong choices)');
    need(pk.a.includes('{ing}') && pk.tokens.some((t) => t.includes('{ing}')), 'park: answer and tokens need {ing}');
    need(pk.mode === 'choose' || pk.mode === 'build', 'park: mode must be choose or build');
  }
  return e;
}
