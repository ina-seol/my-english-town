export type Grade = 3 | 4 | 5 | 6;
export type QuestStatus = 'locked' | 'available' | 'active' | 'completed';

export interface PlacedBuilding { id: string; defId: string; x: number; y: number; level: number; builtAt: number }
export interface PlacedDecor { id: string; defId: string; x: number; y: number }
export interface QuestProgress {
  status: QuestStatus;
  acceptedAt?: number;
  completedAt?: number;
  baseline: Record<string, number>;
  rewardClaimed: boolean;
  /** quest-internal flags, e.g. dialogue passed */
  flags: Record<string, boolean>;
}
export interface ActivityStats {
  plays: number; completions: number; bestStars: number; repeatRewards: number;
  correct: number; wrong: number; firstCompletedAt?: number;
}
export interface Transaction { id: string; at: number; kind: 'coin' | 'exp'; amount: number; reason: string; balanceAfter?: number }

export interface SaveData {
  schemaVersion: number;
  playerId: string;
  nickname: string;
  grade: Grade;
  townName: string;
  selectedCharacter: string;
  playerPosition: { x: number; y: number; dir: 'down' | 'up' | 'left' | 'right' };
  townLevel: number;
  coins: number;
  exp: number;
  buildings: PlacedBuilding[];
  decorations: PlacedDecor[];
  /** owned-but-unplaced decorations: defId -> count */
  inventory: Record<string, number>;
  questProgress: Record<string, QuestProgress>;
  npcRelationships: Record<string, number>;
  learningProgress: { activities: Record<string, ActivityStats>; wordsSeen: Record<string, number> };
  settings: { speech: boolean; koreanHelp: boolean; sound: boolean };
  tutorial: { moved: boolean };
  transactions: Transaction[];
  claimedRewards: string[];
  nextInstanceId: number;
  savedAt: number;
  revision: number;
}

export interface Bilingual { en: string; ko: string }
