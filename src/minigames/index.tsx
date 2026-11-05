import type { ComponentType } from 'react';
import { BakeryGame } from './BakeryGame';
import { MarketGame } from './MarketGame';
import { ParkGame } from './ParkGame';
import { PostGame } from './PostGame';
import { SchoolGame } from './SchoolGame';

/** Mini-game id (the building's `minigame` in buildings.json) -> component. */
export const MINIGAMES: Record<string, ComponentType<{ runId: string }>> = {
  bakery: BakeryGame, school: SchoolGame, market: MarketGame, post: PostGame, park: ParkGame,
};
