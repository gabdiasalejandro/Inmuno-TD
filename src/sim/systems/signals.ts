import { TICKS_PER_SECOND } from '../time';
import { MILLI, type System, type World } from '../world';

/**
 * Global meters (for example cytokines): they decay every tick and rise while emitters detect
 * enemies. The rise scales with how many enemies are detected, and each signal has a ceiling per
 * enemy, so a lone bacterium raises a quarter of the bar while a real wave can fill it.
 */
export function createSignals(world: World): System {
  const { state, signalDefs } = world;
  const active = new Map(signalDefs);
  const perTick = (perSecond: number): number => Math.round((perSecond * MILLI) / TICKS_PER_SECOND);

  return () => {
    for (const [name, def] of signalDefs) {
      state.signals[name] = Math.max(0, (state.signals[name] ?? 0) - perTick(def.decayPerSecond));
    }
    // One pass over the units: how many enemies each signal's emitters see, and how fast they pour.
    const detected = new Map<string, number>();
    const rate = new Map<string, number>();
    for (const unit of state.units) {
      const { emits } = world.unitDef(unit.defId);
      const def = emits && active.get(emits.signal);
      if (!emits || !def) {
        unit.alarmed = false;
        continue;
      }
      const count = world.countTargets(unit, emits.range, emits.requires);
      unit.alarmed = count > 0;
      if (count === 0) continue;
      detected.set(emits.signal, (detected.get(emits.signal) ?? 0) + count);
      rate.set(emits.signal, (rate.get(emits.signal) ?? 0) + emits.perSecond * count);
    }
    for (const [name, def] of signalDefs) {
      const count = detected.get(name) ?? 0;
      if (count === 0) continue;
      const target = def.targetByEnemies?.[count] ?? count * (def.targetPerEnemy ?? def.max);
      const ceiling = Math.min(def.max, target) * MILLI;
      const current = state.signals[name] ?? 0;
      if (current >= ceiling) continue;
      const raised = current + perTick(rate.get(name) ?? 0);
      state.signals[name] = Math.min(ceiling, raised);
    }
  };
}
