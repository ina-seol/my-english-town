import { describe, expect, it } from 'vitest';
import { getPack, validatePack, BUILDINGS } from '../src/content';
import { generateMarketRounds, generateParkRounds, generatePostRounds, generateSchoolRounds, judgeSale, numberWords, parkProgress, postAnswer, priceDistractors } from '../src/systems/learning/games';
import { mulberry32 } from '../src/utils/rng';
import { createNewSave } from '../src/systems/progression/newGame';
import { recordActivityResult } from '../src/systems/learning';

const GRADES = [3, 4, 5, 6] as const;

describe('numberWords', () => {
  it('reads numbers the way students must say them', () => {
    expect(numberWords(13)).toBe('thirteen');
    expect(numberWords(30)).toBe('thirty');
    expect(numberWords(45)).toBe('forty-five');
    expect(numberWords(100)).toBe('one hundred');
    expect(numberWords(2500)).toBe('two thousand five hundred');
    expect(numberWords(20000)).toBe('twenty thousand');
    expect(() => numberWords(-1)).toThrow();
  });
  it('distractors are different, positive and sound-alikes where possible', () => {
    for (const p of [13, 14, 30, 40, 2500, 3000, 20000]) {
      const d = priceDistractors(p, mulberry32(p), 2);
      expect(d).toHaveLength(2);
      for (const x of d) { expect(x).not.toBe(p); expect(x).toBeGreaterThan(0); }
      expect(new Set(d).size).toBe(2);
    }
    expect(priceDistractors(30, mulberry32(1), 5)).toContain(13);
    expect(priceDistractors(13, mulberry32(1), 5)).toContain(30);
  });
});

describe('every grade has valid data for the four extra games', () => {
  for (const g of GRADES) {
    it(`grade ${g}: pack validates and all rounds are solvable`, () => {
      const pack = getPack(g);
      expect(validatePack(pack)).toEqual([]);
      for (let seed = 1; seed <= 30; seed++) {
        const rng = () => mulberry32(seed * 7 + g)();
        // school: one round per day, subjects distinct, sentence mentions both
        const sc = generateSchoolRounds(pack, mulberry32(seed));
        expect(new Set(sc.map((r) => r.dayId)).size).toBe(sc.length);
        expect(new Set(sc.map((r) => r.subjectId)).size).toBe(sc.length);
        for (const r of sc) {
          const day = pack.school!.days.find((d) => d.id === r.dayId)!, sub = pack.school!.subjects.find((s) => s.id === r.subjectId)!;
          expect(r.sentence).toContain(day.en); expect(r.sentence).toContain(sub.en);
        }
        // market: the right item is on the shelf, the right price is among the choices
        for (const r of generateMarketRounds(pack, mulberry32(seed))) {
          const item = pack.market!.items.find((i) => i.id === r.itemId)!;
          expect(r.shelf).toContain(r.itemId);
          expect(r.priceChoices).toContain(item.price);
          expect(new Set(r.priceChoices).size).toBe(r.priceChoices.length);
          expect(r.sentence).not.toMatch(/\{|\}/);
          expect(judgeSale(r, item.price, r.itemId, item.price)).toBe('correct');
        }
        // post: exactly one resident owns the parcel
        for (const r of generatePostRounds(pack, mulberry32(seed))) {
          expect(r.residents.filter((id) => postAnswer(r, id) === 'yes')).toHaveLength(1);
          const owners = pack.post!.residents.filter((x) => x.color === r.color && x.thing === r.thing);
          expect(owners).toHaveLength(1);
          expect(r.clue).not.toMatch(/\{|\}/);
        }
        // park: the correct sentence can be built from the offered options
        for (const r of generateParkRounds(pack, mulberry32(seed))) {
          if (pack.park!.mode === 'choose') { expect(r.options).toContain(r.answer); expect(new Set(r.options).size).toBe(r.options.length); }
          else for (const t of r.tokens) expect(r.options).toContain(t);
          expect(r.answer).not.toMatch(/\{|\}/);
        }
        void rng;
      }
    });
  }
});

describe('judging', () => {
  it('market needs both item and price', () => {
    const pack = getPack(5);
    const r = generateMarketRounds(pack, mulberry32(2))[0];
    const price = pack.market!.items.find((i) => i.id === r.itemId)!.price;
    expect(judgeSale(r, price, null, price)).toBe('incomplete');
    expect(judgeSale(r, price, r.itemId, null)).toBe('incomplete');
    expect(judgeSale(r, price, 'nope', price)).toBe('wrong-item');
    expect(judgeSale(r, price, r.itemId, price + 1)).toBe('wrong-price');
  });
  it('park chips must be picked in order', () => {
    const pack = getPack(4);
    const r = generateParkRounds(pack, mulberry32(5))[0];
    expect(parkProgress(r, [])).toBe('partial');
    expect(parkProgress(r, [r.tokens[0]])).toBe('partial');
    expect(parkProgress(r, [...r.tokens])).toBe('correct');
    expect(parkProgress(r, [r.tokens[1]])).toBe('wrong');
    expect(parkProgress(r, [...r.tokens, 'x'])).toBe('wrong');
  });
  it('grade-specific sentences use the right grammar', () => {
    const p5 = generateParkRounds(getPack(5), mulberry32(1))[0];
    expect(p5.question).toBe('What is he doing?'); expect(p5.answer).toMatch(/^He's /);
    const p6 = generateParkRounds(getPack(6), mulberry32(1))[0];
    expect(p6.answer).toMatch(/^They're /);
    const m5 = generateMarketRounds(getPack(5), mulberry32(3));
    expect(m5.map((r) => r.answerSentence).join(' ')).toMatch(/won\./);
    for (const r of m5) expect(r.answerSentence).toMatch(/^(It's|They're) .* won\.$/);
  });
});

describe('the four buildings are playable and pay rewards', () => {
  it('each building maps to a game and the first run pays the first-time reward', () => {
    for (const id of ['school', 'market', 'post', 'park']) {
      const b = BUILDINGS.find((x) => x.id === id)!;
      expect(b.enabled).toBe(true);
      expect(b.minigame).toBe(id);
      const s = createNewSave({ nickname: 'A', grade: 4, townName: 'T', character: 'c1' });
      const out = recordActivityResult(s, id, { runId: 'r1', stars: 3, correct: 3, wrong: 0, wordIds: ['x'] });
      expect(out.firstTime).toBe(true);
      expect(out.save.coins).toBeGreaterThan(s.coins);
      expect(recordActivityResult(out.save, id, { runId: 'r1', stars: 3, correct: 3, wrong: 0, wordIds: [] }).duplicate).toBe(true);
    }
  });
});
