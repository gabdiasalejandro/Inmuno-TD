import { TICKS_PER_SECOND } from '../time';
import type { UnitState } from '../types';
import { CELL, engagedCol, type System, type World } from '../world';

/**
 * Antigen and the lymph node. A unit that `collects` takes one antigen for each enemy that dies
 * within its radius (the nearest such unit with room takes it); once full it leaves its cell and
 * walks left along its lane, and delivers its load when it reaches the left edge.
 */
export function createAntigen(world: World): { system: System; committed(): number } {
  const { state } = world;
  /** Cell of every enemy at the end of the previous run: where a dying enemy was last seen. */
  let lastSeen = new Map<number, { row: number; col: number }>();

  const distance = (unit: UnitState, at: { row: number; col: number }): number =>
    Math.max(Math.abs(unit.row - at.row), Math.abs(unit.col - at.col));

  const collector = (at: { row: number; col: number }): UnitState | undefined => {
    let best: UnitState | undefined;
    for (const unit of state.units) {
      const collects = world.unitDef(unit.defId).collects;
      if (!collects || unit.hp <= 0 || (unit.antigen ?? 0) >= collects.capacity) continue;
      if (distance(unit, at) > collects.radius) continue;
      if (!best || distance(unit, at) < distance(best, at)) best = unit;
    }
    return best;
  };

  return {
    system(events) {
      for (const event of [...events]) {
        if (event.type !== 'enemy_died') continue;
        const at = lastSeen.get(event.uid);
        const unit = at && collector(at);
        if (!unit) continue;
        unit.antigen = (unit.antigen ?? 0) + 1;
        events.push({ type: 'antigen_taken', uid: unit.uid, enemy: event.uid });
      }

      // Couriers already on their way walk first, so one that leaves this tick starts walking next tick.
      state.couriers = state.couriers.filter((courier) => {
        const { speed } = world.unitDef(courier.defId).collects!;
        courier.pos = Math.max(0, courier.pos - Math.round((speed * CELL) / TICKS_PER_SECOND));
        if (courier.pos > 0) return true;
        state.antigenDelivered += courier.antigen;
        events.push({ type: 'antigen_delivered', uid: courier.uid, row: courier.row, amount: courier.antigen });
        return false;
      });

      state.units = state.units.filter((unit) => {
        const collects = world.unitDef(unit.defId).collects;
        if (!collects || unit.hp <= 0 || (unit.antigen ?? 0) < collects.capacity) return true;
        const antigen = unit.antigen ?? 0;
        state.couriers.push({ uid: unit.uid, defId: unit.defId, row: unit.row, pos: unit.col * CELL, antigen });
        events.push({ type: 'unit_migrated', uid: unit.uid, row: unit.row, col: unit.col, antigen });
        return false;
      });

      lastSeen = new Map(state.enemies.map((enemy) => [enemy.uid, { row: enemy.lane, col: engagedCol(enemy.pos) }]));
    },

    /** Antigen delivered plus antigen on its way: what the lymph node will have without more pickup. */
    committed: () => state.antigenDelivered + state.couriers.reduce((sum, courier) => sum + courier.antigen, 0),
  };
}
