import { TICKS_PER_SECOND } from '../time';
import type { HarmDef } from '../types';
import type { System, World } from '../world';

/**
 * Meters that follow another: a signal with `risesWith` gains `perPoint` for every point the
 * player released this tick into the signal it follows (for example inflammation from cytokines).
 */
export function createCoupling(world: World): System {
  const followers = world.signalDefs.filter(([, def]) => def.risesWith);
  return (events) => {
    if (followers.length === 0) return;
    for (const event of events) {
      if (event.type !== 'signal_released') continue;
      for (const [name, def] of followers) {
        if (def.risesWith!.signal === event.signal) world.raise(name, event.amount * def.risesWith!.perPoint);
      }
    }
  };
}

/** Damage per second of the highest harm tier a signal level has reached, or 0 below them all. */
export function harmPercentAt(tiers: readonly HarmDef[], fraction: number): number {
  let reached: HarmDef | undefined;
  for (const tier of tiers) {
    if (fraction >= tier.from && (!reached || tier.from > reached.from)) reached = tier;
  }
  return reached?.hpPercentPerSecond ?? 0;
}

/**
 * Collateral damage: while a signal with `harm` tiers is at or above the first one, every own
 * unit loses a share of its max hit points each tick, at the rate of the highest tier reached.
 * Units brought to zero are removed as killed.
 */
export function createHarm(world: World): System {
  const { state } = world;
  const harmful = world.signalDefs.filter(([, def]) => def.harm);
  return (events) => {
    let percentPerSecond = 0;
    for (const [name, def] of harmful) {
      percentPerSecond += harmPercentAt(def.harm!, world.signalFraction(name));
    }
    if (percentPerSecond === 0) return;
    for (const unit of state.units) {
      unit.hp -= (world.unitDef(unit.defId).hp * percentPerSecond) / 100 / TICKS_PER_SECOND;
    }
    world.removeDeadUnits(events);
  };
}
