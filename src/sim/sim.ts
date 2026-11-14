import { createEnemyActions, createExpiry, createUnitAttacks } from './systems/combat';
import { createMarrow } from './systems/marrow';
import { createOutcome } from './systems/outcome';
import { createPlacement } from './systems/placement';
import { createSignals } from './systems/signals';
import { createSpawning } from './systems/spawning';
import type { Content, LevelDef, Sim, SimEvent } from './types';
import { createWorld, type System } from './world';

/**
 * Builds a simulation of one level. Each concern lives in its own system under `systems/`;
 * this file only fixes the order they run in, which is part of the rules.
 */
export function createSim(level: LevelDef, content: Content, seed: number): Sim {
  const world = createWorld(level, content, seed);
  const { state } = world;
  const spawning = createSpawning(world);
  const marrow = createMarrow(world);

  // What arrives during a tick is decided on the tick it starts...
  const beforeTick: System[] = [spawning.openWounds, spawning.spawnDue];
  // ...and everything else resolves once the tick has elapsed.
  const afterTick: System[] = [
    createSignals(world),
    marrow.produce,
    createExpiry(world),
    createUnitAttacks(world),
    createEnemyActions(world),
    createOutcome(world, spawning.allSpawned),
  ];

  return {
    state,
    signal: world.signalFraction,
    marrowFraction: marrow.fraction,
    placeUnit: createPlacement(world),

    step() {
      if (state.status !== 'playing') return [];
      const events: SimEvent[] = [];
      for (const system of beforeTick) system(events);
      state.tick++;
      for (const system of afterTick) system(events);
      return events;
    },
  };
}
