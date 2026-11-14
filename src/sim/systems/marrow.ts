import { secondsToTicks } from '../time';
import { MILLI, type System, type World } from '../world';

/** Bone marrow: charges every tick, faster under boosting signals, and releases energy in batches. */
export function createMarrow(world: World): { produce: System; fraction(): number } {
  const { level, state } = world;
  const threshold = Math.max(1, secondsToTicks(level.marrow.interval)) * MILLI;

  return {
    produce(events) {
      state.marrowCharge += MILLI + Math.round(MILLI * world.boostFrom((def) => def.marrowBoost));
      if (state.marrowCharge < threshold) return;
      state.marrowCharge -= threshold;
      state.energy += level.marrow.amount;
      events.push({ type: 'energy_gained', amount: level.marrow.amount });
    },
    fraction: () => state.marrowCharge / threshold,
  };
}
