import { TICKS_PER_SECOND, secondsToTicks } from '../time';
import { engagedCol, type System, type World } from '../world';

/**
 * Traps left on death (for example NETs): a unit whose definition has `onDeath.trap` lays it on its
 * own cell when it dies, killed or expired. A trap hits the enemies in its cell as soon as it is
 * laid and then at its rate, slows them while it lasts (see `trapSlow`), and may raise a signal.
 */
export function createTraps(world: World): System {
  const { state } = world;
  const interval = (rate: number): number => Math.max(1, Math.round(TICKS_PER_SECOND / rate));

  return (events) => {
    state.traps = state.traps.filter((trap) => state.tick < trap.until);
    for (const event of [...events]) {
      if (event.type !== 'unit_died') continue;
      const trap = world.unitDef(event.defId).onDeath?.trap;
      if (!trap) continue;
      const laid = {
        uid: state.nextUid++,
        defId: trap.id,
        row: event.row,
        col: event.col,
        laidAt: state.tick,
        until: state.tick + secondsToTicks(trap.duration),
      };
      state.traps.push(laid);
      events.push({ type: 'trap_laid', uid: laid.uid, defId: laid.defId, row: laid.row, col: laid.col });
      if (trap.raises) world.raise(trap.raises.signal, trap.raises.amount);
    }
    for (const trap of state.traps) {
      const def = world.trapDef(trap.defId);
      if ((state.tick - trap.laidAt) % interval(def.rate) !== 0) continue;
      for (const enemy of state.enemies) {
        if (!world.rowsOf(enemy).includes(trap.row) || enemy.hp <= 0 || !world.enemyHas(enemy, def.requires)) continue;
        if (engagedCol(enemy.pos) !== trap.col) continue;
        world.damageEnemy(enemy, def.damage);
        events.push({ type: 'trap_hit', uid: trap.uid, target: enemy.uid, damage: def.damage });
      }
    }
    state.enemies = state.enemies.filter((enemy) => {
      if (enemy.hp > 0) return true;
      events.push({ type: 'enemy_died', uid: enemy.uid });
      return false;
    });
  };
}
