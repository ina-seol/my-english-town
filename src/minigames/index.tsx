import type { ComponentType } from 'react';
import { ArrangeGame } from './ArrangeGame';
import { BakeryGame } from './BakeryGame';
import { CountGame } from './CountGame';
import { DressGame } from './DressGame';
import { MarketGame } from './MarketGame';
import { MatchGame } from './MatchGame';
import { ParkGame } from './ParkGame';
import { PostGame } from './PostGame';
import { ReviewGame } from './ReviewGame';
import { SchoolGame } from './SchoolGame';
import { SpellGame } from './SpellGame';

/** Mini-game id (the building's `minigame` in buildings.json) -> component. */
export const MINIGAMES: Record<string, ComponentType<{ runId: string }>> = {
  bakery: BakeryGame, school: SchoolGame, market: MarketGame, post: PostGame, park: ParkGame,
  restaurant: SpellGame, library: ArrangeGame, hospital: MatchGame, petshop: CountGame, clothing: DressGame, townhall: ReviewGame,
};
