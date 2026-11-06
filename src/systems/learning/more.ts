import type { GradePack } from '../../content';
import { shuffle, type Rng } from '../../utils/rng';
import { numberWords, priceDistractors } from './games';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ============ Restaurant: spell the dish ============ */
export interface Tile { id: number; ch: string }
export interface SpellRound { word: string; ko: string; emoji: string; say: string; tiles: Tile[]; customer: { name: string; emoji: string } }

export function generateSpellRounds(pack: GradePack, rng: Rng): SpellRound[] {
  const cfg = pack.restaurant!;
  const dishes = shuffle(cfg.dishes, rng).slice(0, cfg.rounds);
  return dishes.map((d, i) => {
    const letters = d.word.split('');
    const pool = 'abcdefghijklmnopqrstuvwxyz'.split('').filter((c) => !letters.includes(c));
    const extras = shuffle(pool, rng).slice(0, cfg.extra);
    const tiles = shuffle([...letters, ...extras], rng).map((ch, id) => ({ id, ch }));
    return { word: d.word, ko: d.ko, emoji: d.emoji, say: d.say, tiles, customer: pack.bakery.customers[i % pack.bakery.customers.length] };
  });
}

/** Letters picked so far must be the start of the word (order matters). */
export function spellProgress(word: string, picked: string[]): 'correct' | 'partial' | 'wrong' {
  if (picked.length > word.length) return 'wrong';
  for (let i = 0; i < picked.length; i++) if (picked[i] !== word[i]) return 'wrong';
  return picked.length === word.length ? 'correct' : 'partial';
}

/* ============ Library: put the words in order ============ */
export interface ArrangeRound { en: string; ko: string; words: string[]; shuffled: Tile[] }

export function generateArrangeRounds(pack: GradePack, rng: Rng): ArrangeRound[] {
  const cfg = pack.library!;
  return shuffle(cfg.sentences, rng).slice(0, cfg.rounds).map((s) => {
    const words = s.en.split(' ');
    let order = shuffle(words.map((w, id) => ({ id, ch: w })), rng);
    for (let k = 0; k < 6 && order.map((t) => t.ch).join(' ') === s.en; k++) order = shuffle(order, rng); // never start solved
    return { en: s.en, ko: s.ko, words, shuffled: order };
  });
}
export function arrangeProgress(round: ArrangeRound, picked: string[]): 'correct' | 'partial' | 'wrong' {
  if (picked.length > round.words.length) return 'wrong';
  for (let i = 0; i < picked.length; i++) if (picked[i] !== round.words[i]) return 'wrong';
  return picked.length === round.words.length ? 'correct' : 'partial';
}

/* ============ Hospital: match questions with answers ============ */
export interface MatchSet { pairs: { q: string; a: string; qko: string; ako: string }[]; left: number[]; right: number[] }

export function generateMatchSet(pack: GradePack, rng: Rng): MatchSet {
  const pairs = pack.hospital!.pairs.slice(0, pack.hospital!.rounds);
  const idx = pairs.map((_, i) => i);
  return { pairs, left: shuffle(idx, rng), right: shuffle(idx, rng) };
}

/* ============ Pet shop: count the animals ============ */
export interface CountRound { animalId: string; n: number; question: string; choices: { n: number; text: string }[]; answer: string }

export function generateCountRounds(pack: GradePack, rng: Rng): CountRound[] {
  const cfg = pack.petshop!;
  const animals = shuffle(cfg.animals, rng).slice(0, cfg.rounds);
  const fmt = (tpl: string, n: number, a: { one: string; many: string }) => cap(tpl.replace('{number}', numberWords(n)).replace('{many}', n === 1 ? a.one : a.many));
  return animals.map((a) => {
    const n = cfg.min + Math.floor(rng() * (cfg.max - cfg.min + 1));
    const wrong = shuffle([n + 1, n - 1, n + 2, n - 2].filter((x) => x >= 1 && x !== n), rng).slice(0, 2);
    const choices = shuffle([n, ...wrong], rng).map((x) => ({ n: x, text: fmt(cfg.a, x, a) }));
    return { animalId: a.id, n, question: cap(cfg.q.replace('{many}', a.many)), choices, answer: fmt(cfg.a, n, a) };
  });
}

/* ============ Clothing shop: dress the customer ============ */
export interface DressRound { clothesId: string; colorId: string; sentence: string }

export function generateDressRounds(pack: GradePack, rng: Rng): DressRound[] {
  const cfg = pack.clothing!;
  const items = shuffle(cfg.clothes, rng).slice(0, cfg.rounds);
  const colors = shuffle(cfg.colors, rng);
  return items.map((it, i) => {
    const color = colors[i % colors.length];
    return { clothesId: it.id, colorId: color.id, sentence: cfg.template.replace('{art}', it.art).replace('{color}', color.id).replace('{noun}', it.noun) };
  });
}
export function judgeDress(round: DressRound, clothesId: string | null, colorId: string | null): 'correct' | 'wrong-item' | 'wrong-color' | 'incomplete' {
  if (!clothesId || !colorId) return 'incomplete';
  if (clothesId !== round.clothesId) return 'wrong-item';
  return colorId === round.colorId ? 'correct' : 'wrong-color';
}

/* ============ Town hall: mixed review (built from the other sections) ============ */
/** `clue` is what makes exactly one option right: a picture, a calendar day or a price tag. */
export interface ReviewRound { kind: string; prompt: string; full: string; options: string[]; answer: string; clue: string }

export function generateReviewRounds(pack: GradePack, rng: Rng): ReviewRound[] {
  const blank = '_____';
  const makers: (() => ReviewRound | null)[] = [];
  const three = (answer: string, others: string[]) => shuffle([answer, ...shuffle(others.filter((o) => o !== answer), rng).slice(0, 2)], rng);
  const form = (f: { plural: string; a?: string }, art: boolean) => (art ? f.a ?? f.plural : f.plural);
  const tpl = pack.bakery.templates.text;
  const art = /\{0:a\}/.test(tpl);
  makers.push(() => {
    if (pack.foods.length < 3) return null;
    const f = shuffle(pack.foods, rng)[0];
    const full = tpl.replace(/\{0(:a)?\}/, form(f, art));
    return { kind: 'food', prompt: tpl.replace(/\{0(:a)?\}/, blank), full, options: three(form(f, art), pack.foods.map((x) => form(x, art))), answer: form(f, art), clue: f.emoji };
  });
  const sc = pack.school;
  if (sc) {
    makers.push(() => {
      const d = shuffle(sc.days, rng)[0], s = shuffle(sc.subjects, rng)[0];
      const full = sc.templates.read.replace('{subject}', s.en).replace('{day}', d.en);
      return { kind: 'day', prompt: sc.templates.read.replace('{subject}', s.en).replace('{day}', blank), full, options: three(d.en, sc.days.map((x) => x.en)), answer: d.en, clue: `📅 ${d.short}` };
    });
    makers.push(() => {
      const d = shuffle(sc.days, rng)[0], s = shuffle(sc.subjects, rng)[0];
      const full = sc.templates.read.replace('{subject}', s.en).replace('{day}', d.en);
      return { kind: 'subject', prompt: sc.templates.read.replace('{subject}', blank).replace('{day}', d.en), full, options: three(s.en, sc.subjects.map((x) => x.en)), answer: s.en, clue: s.emoji };
    });
  }
  const pk = pack.park;
  if (pk) makers.push(() => {
    const a = shuffle(pk.actions, rng)[0];
    return { kind: 'action', prompt: pk.a.replace('{ing}', blank), full: pk.a.replace('{ing}', a.ing), options: three(a.ing, pk.actions.map((x) => x.ing)), answer: a.ing, clue: a.emoji };
  });
  const mk = pack.market;
  if (mk) makers.push(() => {
    const it = shuffle(mk.items, rng)[0];
    const words = numberWords(it.price);
    const mkText = (price: string) => mk.templates.answer.replace('{pron}', it.pron).replace('{price}', price).replace('{unit}', mk.unit);
    return { kind: 'price', prompt: mkText(blank), full: mkText(words), options: three(words, priceDistractors(it.price, rng, 2).map(numberWords).concat(words)), answer: words, clue: `🏷️ ${it.price.toLocaleString('en-US')} ${mk.unit}` };
  });
  const order = shuffle(makers, rng);
  const total = pack.townhall?.rounds ?? 4;
  const out: ReviewRound[] = [];
  for (let i = 0; out.length < total && i < total * 3; i++) {
    const r = order[i % order.length]();
    if (r && (!out.some((o) => o.full === r.full))) out.push(r);
  }
  return out;
}
