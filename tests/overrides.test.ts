import { afterEach, describe, expect, it } from 'vitest';
import { PACKS, getPack } from '../src/content';
import { applyPack, loadOverrides } from '../src/content/overrides';

const original = { ...PACKS };
afterEach(() => { Object.assign(PACKS, original); });
const copy = () => JSON.parse(JSON.stringify(getPack(4)));

describe('content overrides', () => {
  it('applies a valid replacement pack', () => {
    const p = copy();
    p.foods[0].ko = '바꾼 뜻';
    expect(applyPack(4, p)).toEqual([]);
    expect(getPack(4).foods[0].ko).toBe('바꾼 뜻');
  });
  it('ignores an invalid pack and keeps the built-in one', () => {
    const p = copy();
    p.foods = [];
    const errs = applyPack(4, p);
    expect(errs.length).toBeGreaterThan(0);
    expect(getPack(4).foods.length).toBeGreaterThan(3);
  });
  it('rejects a pack uploaded for the wrong grade', () => {
    const p = copy();
    expect(applyPack(5, p).join()).toMatch(/grade/);
    expect(getPack(5).grade).toBe(5);
  });
  it('loads files from public/content and survives missing files', async () => {
    const good = copy(); good.foods[1].ko = '파일에서 온 뜻';
    const bad = copy(); bad.bakery.plan = ['teleport'];
    const fake = (async (url: string) => {
      if (url.includes('grade4')) return { ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => good } as Response;
      if (url.includes('grade6')) return { ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ ...getPack(6), bakery: bad.bakery }) } as Response;
      return { ok: false, headers: new Headers(), json: async () => ({}) } as Response; // 404
    }) as unknown as typeof fetch;
    const notes = await loadOverrides(fake);
    expect(getPack(4).foods[1].ko).toBe('파일에서 온 뜻');
    expect(notes.join()).toMatch(/grade6.json ignored/);
    expect(getPack(6).bakery.plan).not.toContain('teleport');
  });
});
