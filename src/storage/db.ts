import type { SaveData } from '../types';
import { migrateSave } from './schema';

const DB_NAME = 'my-english-town';
const STORE = 'saves';

export interface ProfileSummary { playerId: string; nickname: string; grade: number; townName: string; savedAt: number; revision: number; townLevel: number }
interface SaveRecord extends ProfileSummary {
  currentJson: string; currentSum: string;
  previousJson?: string; previousSum?: string;
}

export function checksum(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16) + ':' + s.length;
}

let dbPromise: Promise<IDBDatabase> | null = null;
/** Closes the cached connection (used by tests and before reopening). */
export async function resetDbHandle() {
  const p = dbPromise;
  dbPromise = null;
  try { (await p)?.close(); } catch { /* nothing open */ }
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is not available in this browser'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'playerId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error ?? new Error('Could not open the save database')); };
    req.onblocked = () => { dbPromise = null; reject(new Error('Save database is blocked by another tab')); };
  });
  return dbPromise;
}

function summary(s: SaveData): ProfileSummary {
  return { playerId: s.playerId, nickname: s.nickname, grade: s.grade, townName: s.townName, savedAt: s.savedAt, revision: s.revision, townLevel: s.townLevel };
}

const wrap = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

/** Atomic write: the previous good state is kept as a backup in the same record. */
export async function putSave(save: SaveData): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const done = new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error ?? new Error('save aborted')); });
  const old = (await wrap(store.get(save.playerId))) as SaveRecord | undefined;
  const json = JSON.stringify(save);
  const rec: SaveRecord = { ...summary(save), currentJson: json, currentSum: checksum(json) };
  if (old && old.currentSum === checksum(old.currentJson)) { rec.previousJson = old.currentJson; rec.previousSum = old.currentSum; }
  else if (old?.previousJson) { rec.previousJson = old.previousJson; rec.previousSum = old.previousSum; }
  store.put(rec);
  await done;
}

export interface LoadResult { save: SaveData; recovered: boolean }

function tryParse(json?: string, sum?: string): SaveData | null {
  if (!json || checksum(json) !== sum) return null;
  try { return migrateSave(JSON.parse(json)); } catch { return null; }
}

/** Loads a profile; falls back to the backup copy if the current one is corrupt. Never wipes anything. */
export async function getSave(playerId: string): Promise<LoadResult | null> {
  const db = await openDb();
  const rec = (await wrap(db.transaction(STORE).objectStore(STORE).get(playerId))) as SaveRecord | undefined;
  if (!rec) return null;
  const cur = tryParse(rec.currentJson, rec.currentSum);
  if (cur) return { save: cur, recovered: false };
  const prev = tryParse(rec.previousJson, rec.previousSum);
  if (prev) return { save: prev, recovered: true };
  throw new Error('Both the save and its backup are damaged. Use "Load backup file".');
}

export async function listProfiles(): Promise<ProfileSummary[]> {
  const db = await openDb();
  const all = (await wrap(db.transaction(STORE).objectStore(STORE).getAll())) as SaveRecord[];
  return all
    .map(({ playerId, nickname, grade, townName, savedAt, revision, townLevel }) => ({ playerId, nickname, grade, townName, savedAt, revision, townLevel }))
    .sort((a, b) => b.savedAt - a.savedAt);
}

/** Only ever called after an explicit confirmation in the UI. */
export async function deleteProfile(playerId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(playerId);
  await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

// ---- JSON export / import ----
const APP = 'my-english-town';

export function exportSave(save: SaveData): string {
  const body = JSON.stringify(save);
  return JSON.stringify({ app: APP, exportVersion: 1, exportedAt: Date.now(), checksum: checksum(body), save }, null, 1);
}

export function parseImport(text: string): { ok: true; save: SaveData } | { ok: false; error: string } {
  try {
    const o = JSON.parse(text);
    if (!o || o.app !== APP || !o.save) return { ok: false, error: 'This file is not a My English Town backup.' };
    if (o.checksum && o.checksum !== checksum(JSON.stringify(o.save))) return { ok: false, error: 'The backup file is damaged (checksum mismatch).' };
    return { ok: true, save: migrateSave(o.save) };
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'Could not read the file.' };
  }
}
