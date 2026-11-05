import type { GradePack } from '../../content';
import { shuffle, type Rng } from '../../utils/rng';

/* ============ number reading (Market) ============ */
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** English words for 0..999,999 ("twenty thousand", "two thousand five hundred"). */
export function numberWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999999) throw new Error('numberWords: out of range');
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numberWords(n % 100) : '');
  return numberWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numberWords(n % 1000) : '');
}

/** Wrong prices that sound or look like the right one (13/30, 14/40, 2,500/25,000 ...). */
export function priceDistractors(price: number, rng: Rng, count = 2): number[] {
  const cand = new Set<number>();
  const step = price >= 1000 ? 1000 : 10;
  if (price % 10 === 0 && price < 100) cand.add(price / 10 + 10); // 30 -> 13
  if (price >= 13 && price <= 19) cand.add((price - 10) * 10); // 13 -> 30
  if (price >= 1000) { cand.add(price * 10 > 999999 ? price / 10 : price * 10); cand.add(price / 10 >= 100 ? price / 10 : price + step); }
  cand.add(price + step); cand.add(Math.max(step, price - step)); cand.add(price + 2 * step);
  cand.delete(price);
  const ok = [...cand].filter((c) => c > 0 && c <= 999999);
  return shuffle(ok, rng).slice(0, count);
}

/* ============ School timetable ============ */
export interface SchoolRound { dayId: string; subjectId: string; mode: 'read' | 'listen'; sentence: string }

export function generateSchoolRounds(pack: GradePack, rng: Rng): SchoolRound[] {
  const sc = pack.school!;
  const n = Math.min(sc.rounds, sc.days.length, sc.subjects.length);
  const days = shuffle(sc.days, rng).slice(0, n);
  const subjects = shuffle(sc.subjects, rng).slice(0, n);
  return days.map((d, i) => {
    const mode: 'read' | 'listen' = i % 2 === 0 ? 'read' : 'listen';
    const sentence = sc.templates[mode].replace('{subject}', subjects[i].en).replace('{day}', d.en);
    return { dayId: d.id, subjectId: subjects[i].id, mode, sentence };
  });
}

/* ============ Market ============ */
export interface MarketRound { itemId: string; sentence: string; shelf: string[]; priceChoices: number[]; answerSentence: string }

export function generateMarketRounds(pack: GradePack, rng: Rng): MarketRound[] {
  const m = pack.market!;
  const picks = shuffle(m.items, rng).slice(0, m.rounds);
  return picks.map((it) => {
    const others = shuffle(m.items.filter((o) => o.id !== it.id), rng).slice(0, Math.max(0, m.shelfSize - 1));
    const sentence = m.templates.ask.replace('{name}', it.name).replace('{verb}', it.verb).replace('{pron2}', it.pron2 ?? 'it');
    const choices = shuffle([it.price, ...priceDistractors(it.price, rng, 2)], rng);
    const answerSentence = m.templates.answer.replace('{pron}', it.pron).replace('{price}', numberWords(it.price)).replace('{unit}', m.unit);
    return { itemId: it.id, sentence, shelf: shuffle([it.id, ...others.map((o) => o.id)], rng), priceChoices: choices, answerSentence };
  });
}

/** A sale is complete only when BOTH the item and the price are right. */
export function judgeSale(round: MarketRound, price: number, pickedItem: string | null, pickedPrice: number | null): 'correct' | 'wrong-item' | 'wrong-price' | 'incomplete' {
  if (pickedItem === null || pickedPrice === null) return 'incomplete';
  if (pickedItem !== round.itemId) return 'wrong-item';
  return pickedPrice === price ? 'correct' : 'wrong-price';
}

/* ============ Post office ============ */
export interface PostRound { ownerId: string; color: string; thing: string; clue: string; residents: string[] }

export function generatePostRounds(pack: GradePack, rng: Rng): PostRound[] {
  const p = pack.post!;
  const owners = shuffle(p.residents, rng).slice(0, p.rounds);
  return owners.map((o) => ({
    ownerId: o.id, color: o.color, thing: o.thing,
    clue: p.templates.clue.replace(/\{color\}/g, p.colors[o.color] ? o.color : o.color).replace(/\{thing\}/g, p.things[o.thing].en),
    residents: shuffle(p.residents.map((r) => r.id), rng),
  }));
}

/** What a resident answers when you ask "Is this your ...?" */
export function postAnswer(round: PostRound, residentId: string): 'yes' | 'no' {
  return residentId === round.ownerId ? 'yes' : 'no';
}

/* ============ Park ============ */
export interface ParkRound { actionId: string; question: string; answer: string; tokens: string[]; options: string[] }

export function generateParkRounds(pack: GradePack, rng: Rng): ParkRound[] {
  const k = pack.park!;
  const picks = shuffle(k.actions, rng).slice(0, k.rounds);
  return picks.map((a) => {
    const answer = k.a.replace('{ing}', a.ing);
    const wrongIng = shuffle(k.actions.filter((o) => o.id !== a.id), rng).slice(0, 2).map((o) => o.ing);
    // for "choose" mode the options are whole sentences; for "build" mode they are word chips
    const options = k.mode === 'choose'
      ? shuffle([answer, ...wrongIng.map((w) => k.a.replace('{ing}', w))], rng)
      : shuffle([...k.tokens.map((t) => t.replace('{ing}', a.ing)), ...wrongIng, a.base], rng);
    return { actionId: a.id, question: k.q, answer, tokens: k.tokens.map((t) => t.replace('{ing}', a.ing)), options };
  });
}

/** Build mode: the chips picked so far must match the sentence in order. */
export function parkProgress(round: ParkRound, picked: string[]): 'correct' | 'partial' | 'wrong' {
  const t = round.tokens;
  if (picked.length > t.length) return 'wrong';
  for (let i = 0; i < picked.length; i++) if (picked[i] !== t[i]) return 'wrong';
  return picked.length === t.length ? 'correct' : 'partial';
}
