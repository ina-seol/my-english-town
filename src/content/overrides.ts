import { GRADES, PACKS, validatePack, type GradePack } from './index';
import type { Grade } from '../types';

/** Where the teacher page stores a pack that is being tried on this device only. */
export const overrideKey = (g: Grade) => `met:pack:${g}`;

export function readLocalOverride(g: Grade): GradePack | null {
  try {
    const raw = localStorage.getItem(overrideKey(g));
    return raw ? (JSON.parse(raw) as GradePack) : null;
  } catch {
    return null;
  }
}

/** Replace a bundled pack only if the replacement passes validation. Returns the problems if it does not. */
export function applyPack(g: Grade, pack: unknown): string[] {
  const p = pack as GradePack;
  const errs = validatePack(p);
  if (p?.grade !== g) errs.push(`pack says grade ${p?.grade} but was loaded for grade ${g}`);
  if (errs.length === 0) PACKS[g] = p;
  return errs;
}

/**
 * Teachers can replace a grade's content without touching code:
 *  1. a file public/content/grade{N}.json deployed with the site (applies to every student), or
 *  2. a pack saved by the teacher page on this device (for trying changes out).
 * A broken file is ignored (the built-in content keeps working) and reported.
 */
export async function loadOverrides(fetcher: typeof fetch = fetch): Promise<string[]> {
  const notes: string[] = [];
  for (const g of GRADES) {
    try {
      const r = await fetcher(`content/grade${g}.json`, { cache: 'no-cache' });
      if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) {
        const errs = applyPack(g, await r.json());
        if (errs.length) notes.push(`content/grade${g}.json ignored: ${errs.join('; ')}`);
      }
    } catch { /* no override file: normal */ }
    const local = readLocalOverride(g);
    if (local) {
      const errs = applyPack(g, local);
      if (errs.length) notes.push(`device copy of grade ${g} ignored: ${errs.join('; ')}`);
    }
  }
  return notes;
}
