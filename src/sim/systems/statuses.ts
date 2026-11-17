import type { EnemyState, UnitState } from '../types';
import { CELL, type System, type World } from '../world';

/**
 * Unit statuses run out here. A status with `burst` kills its unit when it runs out and releases
 * new enemies: the first in the unit's own cell, the rest in the same column of the neighbouring
 * lanes (in an order picked with the level's seeded RNG). They appear in the middle of the cell,
 * so they meet whatever stands there at once.
 */
export function createStatuses(world: World): { expire: System; pendingBurst(): boolean } {
  const { state, level } = world;

  /** Own lane first, then the neighbour lanes inside the grid in a seeded order. */
  const releaseLanes = (row: number): number[] => {
    const neighbours = [row - 1, row + 1].filter((lane) => lane >= 0 && lane < level.grid.rows);
    if (neighbours.length === 2 && world.random() < 0.5) neighbours.reverse();
    return [row, ...neighbours];
  };

  const release = (unit: UnitState, enemyId: string, count: number): EnemyState[] => {
    const def = world.enemyDef(enemyId);
    const lanes = releaseLanes(unit.row);
    return Array.from({ length: count }, (_, i) => ({
      uid: state.nextUid++,
      defId: def.id,
      lane: lanes[i % lanes.length]!,
      pos: unit.col * CELL + CELL / 2,
      hp: def.hp,
      attackReadyAt: 0,
      switches: 0,
    }));
  };

  return {
    expire(events) {
      const bursts: Array<{ unit: UnitState; status: string }> = [];
      for (const unit of state.units) {
        for (const [name, until] of Object.entries(unit.statuses)) {
          if (until > state.tick) continue;
          delete unit.statuses[name];
          if (unit.hp > 0 && world.statusDef(name)?.burst) bursts.push({ unit, status: name });
        }
      }
      for (const { unit, status } of bursts) {
        const { burst } = world.statusDef(status)!;
        const { enemy, min, max } = burst!;
        const count = min + Math.floor(world.random() * (max - min + 1));
        const released = release(unit, enemy, count);
        unit.hp = 0;
        events.push({ type: 'status_burst', uid: unit.uid, status, row: unit.row, col: unit.col, released: released.map((e) => e.uid) });
        for (const enemy of released) {
          state.enemies.push(enemy);
          events.push({ type: 'enemy_spawned', uid: enemy.uid, defId: enemy.defId, lane: enemy.lane });
        }
      }
      world.removeDeadUnits(events);
    },

    /** True while some unit carries a status that will still burst into new enemies. */
    pendingBurst: () =>
      state.units.some((unit) => Object.keys(unit.statuses).some((name) => world.hasStatus(unit, name) && world.statusDef(name)?.burst)),
  };
}
