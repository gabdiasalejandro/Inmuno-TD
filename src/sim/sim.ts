import { createCoupling, createHarm } from './systems/collateral';
import { createEnemyActions, createExpiry, createUnitAttacks } from './systems/combat';
import { createAntigen } from './systems/antigen';
import { createMarrow } from './systems/marrow';
import { createOutcome } from './systems/outcome';
import { createPowers } from './systems/power';
import { createPlacement } from './systems/placement';
import { createSignals } from './systems/signals';
import { createSources } from './systems/sources';
import { createSpawning } from './systems/spawning';
import { createStatuses } from './systems/statuses';
import { createTraps } from './systems/traps';
import type { Content, LevelDef, Sim, SimEvent } from './types';
import { createWorld, type System } from './world';

/**
 * Builds a simulation of one level. Each concern lives in its own system under `systems/`;
 * this file only fixes the order they run in, which is part of the rules.
 */
export function createSim(level: LevelDef, content: Content, seed: number): Sim {
  const world = createWorld(level, content, seed);
  const { state } = world;
  const antigen = createAntigen(world);
  const win = level.win;
  const spawning = createSpawning(world, () => win?.type === 'antigen' && antigen.committed() < win.count);
  const marrow = createMarrow(world);
  const sources = createSources(world);
  const statuses = createStatuses(world);
  const powers = createPowers(world);

  // What arrives during a tick is decided on the tick it starts...
  const beforeTick: System[] = [spawning.openWounds, spawning.comeBack, spawning.spawnDue];
  // ...and everything else resolves once the tick has elapsed.
  const afterTick: System[] = [
    createSignals(world),
    sources.charge,
    sources.release,
    createCoupling(world),
    marrow.produce,
    createExpiry(world),
    createUnitAttacks(world),
    createEnemyActions(world),
    statuses.expire,
    powers.system,
    createHarm(world),
    createTraps(world),
    sources.chargeFromDamage,
    antigen.system,
    createOutcome(world, spawning.allSpawned, statuses.pendingBurst),
  ];

  return {
    state,
    signal: world.signalFraction,
    marrowFraction: marrow.fraction,
    placeUnit: createPlacement(world),
    playPower: powers.play,
    setReleasing: sources.setReleasing,
    charge: sources.chargeOf,
    stored: sources.stored,

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
