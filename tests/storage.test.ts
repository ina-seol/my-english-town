import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteProfile, exportSave, getSave, listProfiles, parseImport, putSave, resetDbHandle } from '../src/storage/db';
import { migrateSave, validateSave } from '../src/storage/schema';
import { createNewSave } from '../src/systems/progression/newGame';
import { buildBuilding } from '../src/systems/building';
import { acceptQuest, evaluateQuests, setQuestFlag } from '../src/systems/quests';

const mk = (nick = 'Amy') => createNewSave({ nickname: nick, grade: 3, townName: 'T', character: 'c2' });

beforeEach(async () => {
  await resetDbHandle();
  await new Promise<void>((res) => { const r = indexedDB.deleteDatabase('my-english-town'); r.onsuccess = () => res(); r.onerror = () => res(); });
});

describe('IndexedDB storage', () => {
  it('saves and loads a town with buildings, coins and quests intact', async () => {
    let s = mk();
    s = acceptQuest(s, 'q_hello_mia'); s = setQuestFlag(s, 'q_hello_mia', 'dialogue'); s = evaluateQuests(s).save;
    const b = buildBuilding(s, 'bakery', 13, 4);
    if (!b.ok) throw new Error('build');
    s = { ...b.save, revision: 5 };
    await putSave(s);
    const r = await getSave(s.playerId);
    expect(r?.recovered).toBe(false);
    expect(r?.save.buildings.find((x) => x.defId === 'bakery')).toMatchObject({ x: 13, y: 4 });
    expect(r?.save.coins).toBe(s.coins);
    expect(r?.save.questProgress.q_hello_mia.status).toBe('completed');
    expect(r?.save.claimedRewards).toContain('quest:q_hello_mia');
    expect(r?.save.selectedCharacter).toBe('c2');
  });
  it('supports several student profiles', async () => {
    await putSave(mk('A')); await putSave(mk('B'));
    const list = await listProfiles();
    expect(list.map((p) => p.nickname).sort()).toEqual(['A', 'B']);
  });
  it('recovers from a corrupted latest save using the backup', async () => {
    const s = mk();
    await putSave({ ...s, coins: 111, revision: 1 });
    await putSave({ ...s, coins: 222, revision: 2 });
    // corrupt "current" directly
    const db: IDBDatabase = await new Promise((res) => { const q = indexedDB.open('my-english-town', 1); q.onsuccess = () => res(q.result); });
    await new Promise<void>((res) => {
      const tx = db.transaction('saves', 'readwrite'); const st = tx.objectStore('saves');
      const g = st.get(s.playerId);
      g.onsuccess = () => { const rec = g.result; rec.currentJson = rec.currentJson.slice(0, 40); st.put(rec); };
      tx.oncomplete = () => res();
    });
    db.close();
    await resetDbHandle();
    const r = await getSave(s.playerId);
    expect(r?.recovered).toBe(true);
    expect(r?.save.coins).toBe(111);
  });
  it('deletes only the requested profile', async () => {
    const a = mk('A'), b = mk('B');
    await putSave(a); await putSave(b);
    await deleteProfile(a.playerId);
    expect((await listProfiles()).map((p) => p.nickname)).toEqual(['B']);
  });
});

describe('export / import', () => {
  it('round-trips a save through JSON', () => {
    const s = { ...mk(), coins: 345, revision: 9 };
    const r = parseImport(exportSave(s));
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.save.coins).toBe(345); expect(r.save.playerId).toBe(s.playerId); }
  });
  it('rejects foreign, tampered and broken files without throwing', () => {
    expect(parseImport('not json').ok).toBe(false);
    expect(parseImport('{"app":"other"}').ok).toBe(false);
    const text = exportSave(mk());
    expect(parseImport(text.replace('"coins": 80', '"coins": 99999')).ok).toBe(false);
  });
});

describe('migration', () => {
  it('upgrades an old partial save and keeps completed-quest rewards claimed', () => {
    const old = { playerId: 'p1', nickname: 'Old', grade: 4, coins: 10, exp: 3, buildings: [{ id: 'b7', defId: 'house', x: 2, y: 3, level: 1, builtAt: 0 }], decorations: [], questProgress: { q_hello_mia: { status: 'completed', baseline: {}, flags: {}, rewardClaimed: true } } };
    const s = migrateSave(old);
    expect(s.schemaVersion).toBe(1);
    expect(s.claimedRewards).toContain('quest:q_hello_mia');
    expect(s.nextInstanceId).toBeGreaterThan(7);
    expect(s.questProgress.q_build_bakery.status).toBe('available');
  });
  it('rejects unusable and future saves', () => {
    expect(validateSave({})).not.toEqual([]);
    expect(validateSave({ ...mk(), schemaVersion: 99 }).join()).toMatch(/newer/);
    expect(() => migrateSave(null)).toThrow();
  });
});
