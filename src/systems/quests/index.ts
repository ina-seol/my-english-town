import type { QuestProgress, SaveData } from '../../types';
import { QUESTS, getQuest, type QuestDef, type Requirement } from '../../content';
import { grantReward } from '../economy';

export const emptyProgress = (): QuestProgress => ({ status: 'locked', baseline: {}, rewardClaimed: false, flags: {} });

export function questState(save: SaveData, id: string): QuestProgress {
  return save.questProgress[id] ?? emptyProgress();
}

/** Unlock quests whose prerequisites are all completed. Also creates missing entries. */
export function refreshAvailability(save: SaveData): SaveData {
  let changed = false;
  const qp = { ...save.questProgress };
  for (const q of QUESTS) {
    const cur = qp[q.id] ?? emptyProgress();
    if (!qp[q.id]) { qp[q.id] = cur; changed = true; }
    if (cur.status === 'locked' && q.prerequisites.every((p) => qp[p]?.status === 'completed')) {
      qp[q.id] = { ...cur, status: 'available' };
      changed = true;
    }
  }
  return changed ? { ...save, questProgress: qp } : save;
}

export function activityCompletions(save: SaveData, activityId: string): number {
  return save.learningProgress.activities[activityId]?.completions ?? 0;
}

export function requirementProgress(save: SaveData, quest: QuestDef, req: Requirement): { current: number; target: number } {
  const st = questState(save, quest.id);
  switch (req.type) {
    case 'flag': return { current: st.flags[req.flag] ? 1 : 0, target: 1 };
    case 'build': return { current: save.buildings.some((b) => b.defId === req.buildingId) ? 1 : 0, target: 1 };
    case 'activity': {
      const base = st.baseline[req.activityId] ?? 0;
      return { current: Math.max(0, activityCompletions(save, req.activityId) - base), target: req.count };
    }
    case 'decor': return { current: save.decorations.length, target: req.count };
    case 'upgradeCount': return { current: save.buildings.filter((b) => b.level >= req.level).length, target: req.count };
    case 'upgrade': return { current: Math.max(0, ...save.buildings.filter((b) => b.defId === req.buildingId).map((b) => b.level)), target: req.level };
  }
}

export function isQuestSatisfied(save: SaveData, quest: QuestDef): boolean {
  return quest.requirements.every((r) => {
    const p = requirementProgress(save, quest, r);
    return p.current >= p.target;
  });
}

export function acceptQuest(save: SaveData, id: string, now = Date.now()): SaveData {
  const q = getQuest(id);
  const st = questState(save, id);
  if (!q || st.status !== 'available') return save;
  const baseline: Record<string, number> = {};
  for (const r of q.requirements) if (r.type === 'activity') baseline[r.activityId] = activityCompletions(save, r.activityId);
  return { ...save, questProgress: { ...save.questProgress, [id]: { ...st, status: 'active', acceptedAt: now, baseline } } };
}

export function setQuestFlag(save: SaveData, id: string, flag: string): SaveData {
  const st = questState(save, id);
  if (st.flags[flag]) return save;
  return { ...save, questProgress: { ...save.questProgress, [id]: { ...st, flags: { ...st.flags, [flag]: true } } } };
}

export interface EvalResult { save: SaveData; completed: QuestDef[]; levelUp?: number }

/**
 * Completes every active quest whose requirements are met and pays its reward exactly once
 * (guarded by claimedRewards). Repeats because a completion can unlock the next quest.
 */
export function evaluateQuests(input: SaveData, now = Date.now()): EvalResult {
  let save = refreshAvailability(input);
  const completed: QuestDef[] = [];
  let levelUp: number | undefined;
  for (let guard = 0; guard < 10; guard++) {
    let progressed = false;
    for (const q of QUESTS) {
      const st = questState(save, q.id);
      if (st.status !== 'active' || !isQuestSatisfied(save, q)) continue;
      const key = `quest:${q.id}`;
      const g = grantReward(save, key, q.reward, `quest:${q.id}`, now);
      save = g.save;
      if (g.levelUp) levelUp = g.levelUp;
      save = {
        ...save,
        questProgress: { ...save.questProgress, [q.id]: { ...st, status: 'completed', completedAt: now, rewardClaimed: true } },
        npcRelationships: { ...save.npcRelationships, [q.npc]: Math.min(10, (save.npcRelationships[q.npc] ?? 0) + 1) },
      };
      completed.push(q);
      progressed = true;
    }
    save = refreshAvailability(save);
    if (!progressed) break;
  }
  return { save, completed, levelUp };
}

/** The quest an NPC should currently talk about: active first, then available. */
export function npcQuest(save: SaveData, npcId: string): { quest: QuestDef; status: 'available' | 'active' } | null {
  const mine = QUESTS.filter((q) => q.npc === npcId);
  const byPriority = [...mine].sort((a, b) => Number(!!a.optional) - Number(!!b.optional)); // main missions first, bonus ones after
  const active = byPriority.find((q) => questState(save, q.id).status === 'active');
  if (active) return { quest: active, status: 'active' };
  const avail = byPriority.find((q) => questState(save, q.id).status === 'available');
  if (avail) return { quest: avail, status: 'available' };
  return null;
}
