import type { Grade, SaveData } from '../../types';
import { ECONOMY } from '../../content';
import { PLAYER_START } from '../building/world';
import { refreshAvailability } from '../quests';
import { uid } from '../../utils/rng';

export const SCHEMA_VERSION = 1;

export interface NewGameOptions { nickname: string; grade: Grade; townName: string; character: string }

export function createNewSave(o: NewGameOptions, now = Date.now()): SaveData {
  const save: SaveData = {
    schemaVersion: SCHEMA_VERSION,
    playerId: uid('p'),
    nickname: o.nickname.trim().slice(0, 12),
    grade: o.grade,
    townName: o.townName.trim().slice(0, 20) || 'Sunny Village',
    selectedCharacter: o.character,
    playerPosition: { x: PLAYER_START.x * 32 + 16, y: PLAYER_START.y * 32 + 16, dir: 'down' },
    townLevel: 1,
    coins: ECONOMY.startCoins,
    exp: 0,
    buildings: [{ id: 'b1', defId: 'house', x: 2, y: 3, level: 1, builtAt: now }],
    decorations: [],
    inventory: {},
    questProgress: {},
    npcRelationships: {},
    learningProgress: { activities: {}, wordsSeen: {} },
    settings: { speech: true, koreanHelp: true, sound: true },
    tutorial: { moved: false },
    transactions: [],
    claimedRewards: [],
    nextInstanceId: 2,
    savedAt: now,
    revision: 0,
  };
  return refreshAvailability(save);
}
