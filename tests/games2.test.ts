import { describe, expect, it } from 'vitest';
import { BUILDINGS, NPCS, QUESTS, getPack, validateGameData, validatePack } from '../src/content';
import { arrangeProgress, generateArrangeRounds, generateCountRounds, generateDressRounds, generateMatchSet, generateReviewRounds, generateSpellRounds, judgeDress, spellProgress } from '../src/systems/learning/more';
import { mulberry32 } from '../src/utils/rng';
import { MINIGAMES } from '../src/minigames';

const GRADES = [3, 4, 5, 6] as const;

describe('six new mini-games: every grade is solvable', () => {
  for (const g of GRADES) {
    it(`grade ${g}`, () => {
      const pack = getPack(g);
      expect(validatePack(pack)).toEqual([]);
      for (let seed = 1; seed <= 40; seed++) {
        // restaurant: the word can be spelled from the tiles
        for (const r of generateSpellRounds(pack, mulberry32(seed))) {
          const pool = r.tiles.map((t) => t.ch).sort();
          for (const ch of new Set(r.word)) expect(pool.filter((c) => c === ch).length).toBeGreaterThanOrEqual(r.word.split('').filter((c) => c === ch).length);
          expect(spellProgress(r.word, r.word.split(''))).toBe('correct');
          expect(spellProgress(r.word, [r.word[0], 'x'.replace(r.word[1], 'q')])).toBe('wrong');
        }
        // library: never starts solved, and the right order is accepted
        for (const r of generateArrangeRounds(pack, mulberry32(seed))) {
          expect(r.shuffled.map((t) => t.ch).join(' ')).not.toBe(r.en);
          expect([...r.shuffled.map((t) => t.ch)].sort()).toEqual([...r.words].sort());
          expect(arrangeProgress(r, r.words)).toBe('correct');
        }
        // hospital: each question has exactly one answer, both columns are permutations
        const m = generateMatchSet(pack, mulberry32(seed));
        expect([...m.left].sort()).toEqual([...m.right].sort());
        expect(new Set(m.pairs.map((p) => p.a)).size).toBe(m.pairs.length);
        // pet shop: the right sentence is offered once, with correct number words
        for (const r of generateCountRounds(pack, mulberry32(seed))) {
          expect(r.choices.filter((c) => c.n === r.n)).toHaveLength(1);
          expect(new Set(r.choices.map((c) => c.n)).size).toBe(3);
          expect(r.choices.every((c) => c.n >= 1)).toBe(true);
          expect(r.answer).not.toMatch(/\{|\}/);
          if (r.n === 1) expect(r.answer).toMatch(/One (cat|dog|rabbit|cow|duck|bear|tiger|monkey)\.$/);
        }
        // clothing: grammar comes from data (a shirt / pants)
        for (const r of generateDressRounds(pack, mulberry32(seed))) {
          expect(r.sentence).not.toMatch(/\{|\}/); expect(r.sentence).not.toMatch(/ a (red|blue|yellow|green|pink|purple) (pants|socks|gloves|shoes)/);
          expect(judgeDress(r, r.clothesId, r.colorId)).toBe('correct');
          expect(judgeDress(r, null, r.colorId)).toBe('incomplete');
        }
        // town hall: one correct option among three, blank present, answer fills it
        for (const r of generateReviewRounds(pack, mulberry32(seed))) {
          expect(r.options).toHaveLength(3); expect(new Set(r.options).size).toBe(3);
          expect(r.options.filter((o) => o === r.answer)).toHaveLength(1);
          expect(r.clue.length).toBeGreaterThan(0); // every blank has something that decides the answer
          expect(r.prompt).toContain('_____');
          expect(r.prompt.replace('_____', r.answer)).toBe(r.full);
        }
      }
    });
  }
});

describe('buildings, residents and missions for all 11 games', () => {
  it('every enabled building has a game, a resident and three missions', () => {
    expect(validateGameData()).toEqual([]);
    const games = BUILDINGS.filter((b) => b.minigame);
    expect(games).toHaveLength(11);
    for (const b of games) {
      expect(b.enabled, b.id).toBe(true);
      expect(MINIGAMES[b.minigame!], b.id).toBeDefined();
      if (b.id !== 'bakery') {
        expect(NPCS.some((n) => n.building === b.id), `npc for ${b.id}`).toBe(true);
        expect(QUESTS.filter((q) => q.id.includes(`_${b.id}`) || q.id === `q_open_${b.id}`).length, `quests ${b.id}`).toBeGreaterThanOrEqual(3);
      }
    }
    expect(QUESTS.length).toBeGreaterThanOrEqual(38);
  });
  it('the open-a-building chain is linear and ends at the town hall', () => {
    const order = ['market', 'school', 'post', 'park', 'restaurant', 'library', 'hospital', 'petshop', 'clothing', 'townhall'];
    order.forEach((b, i) => {
      const q = QUESTS.find((x) => x.id === `q_open_${b}`)!;
      expect(q.prerequisites).toEqual([i === 0 ? 'q_decorate' : `q_open_${order[i - 1]}`]);
    });
  });
});
