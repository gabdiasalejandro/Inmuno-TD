import { TICKS_PER_SECOND } from '../time';
import { MILLI, type System, type World } from '../world';

/**
 * Global meters (for example cytokines) decay every tick. They only rise while the player holds
 * the release and stored charge flows into them (see `sources.ts`).
 */
export function createSignals(world: World): System {
  const { state, signalDefs } = world;
  const perTick = (perSecond: number): number => Math.round((perSecond * MILLI) / TICKS_PER_SECOND);

  return () => {
    for (const [name, def] of signalDefs) {
      const floor = state.signalFloors[name] ?? 0;
      state.signals[name] = Math.max(Math.min(floor, state.signals[name] ?? 0), (state.signals[name] ?? 0) - perTick(def.decayPerSecond));
    }
  };
}
