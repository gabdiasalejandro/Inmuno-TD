import type { Content, EnemyDef, LevelDef, UnitDef } from '../../src/sim';

/**
 * Neutral fixtures: ids are deliberately not immunological so that the engine tests
 * assert engine rules only, never biology.
 */
export const fighter: UnitDef = {
  id: 'fighter',
  cost: 50,
  cooldown: 5,
  hp: 60,
  attack: { type: 'melee', damage: 20, rate: 1, range: 1 },
};

export const wall: UnitDef = { id: 'wall', cost: 25, cooldown: 2, hp: 200 };

export const mayfly: UnitDef = { id: 'mayfly', cost: 10, cooldown: 1, hp: 30, lifespan: 3 };

export const grunt: EnemyDef = {
  id: 'grunt',
  hp: 40,
  speed: 1,
  attack: { damage: 10, rate: 1 },
};

export const content: Content = {
  units: [fighter, wall, mayfly],
  enemies: [grunt],
};

export function level(overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test',
    grid: { rows: 3, cols: 5 },
    startEnergy: 100,
    marrow: { amount: 25, interval: 5 },
    deck: ['fighter', 'wall', 'mayfly'],
    waves: [],
    ...overrides,
  };
}
