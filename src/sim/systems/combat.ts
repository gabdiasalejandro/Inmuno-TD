import { TICKS_PER_SECOND, secondsToTicks } from '../time';
import { CELL, engagedCol, type System, type World } from '../world';

function attackIntervalTicks(rate: number): number {
  return Math.max(1, Math.round(TICKS_PER_SECOND / rate));
}

/** Units that run out of lifespan leave the board. */
export function createExpiry(world: World): System {
  const { state } = world;
  return (events) => {
    state.units = state.units.filter((unit) => {
      const { lifespan } = world.unitDef(unit.defId);
      if (lifespan === undefined || state.tick - unit.bornAt < secondsToTicks(lifespan)) return true;
      events.push({ type: 'unit_died', uid: unit.uid, cause: 'expired' });
      return false;
    });
  };
}

/** Units attack the nearest valid enemy in their lane; enemies at zero hit points are removed. */
export function createUnitAttacks(world: World): System {
  const { state } = world;
  return (events) => {
    for (const unit of state.units) {
      const { attack } = world.unitDef(unit.defId);
      if (!attack || state.tick < unit.attackReadyAt) continue;
      const target = world.findTarget(unit, attack.range, attack.requires);
      if (!target) continue;
      target.hp -= attack.damage;
      unit.attackReadyAt = state.tick + attackIntervalTicks(attack.rate);
      events.push({ type: 'unit_attacked', uid: unit.uid, target: target.uid, damage: attack.damage });
    }
    state.enemies = state.enemies.filter((enemy) => {
      if (enemy.hp > 0) return true;
      events.push({ type: 'enemy_died', uid: enemy.uid });
      return false;
    });
  };
}

/** Enemies attack whatever blocks them, otherwise advance; units at zero hit points are removed. */
export function createEnemyActions(world: World): System {
  const { state } = world;
  return (events) => {
    for (const enemy of state.enemies) {
      const def = world.enemyDef(enemy.defId);
      const col = engagedCol(enemy.pos);
      const occupant = world.unitAt(enemy.lane, col);
      const occupantDef = occupant && world.unitDef(occupant.defId);
      const blocker = occupantDef?.blocks === false ? undefined : occupant;
      if (blocker && blocker.hp > 0) {
        if (state.tick < enemy.attackReadyAt) continue;
        blocker.hp -= def.attack.damage;
        enemy.attackReadyAt = state.tick + attackIntervalTicks(def.attack.rate);
        events.push({ type: 'enemy_attacked', uid: enemy.uid, target: blocker.uid, damage: def.attack.damage });
        continue;
      }
      // A non-blocking occupant (the only kind left here) may slow whoever crosses its cell.
      const slow = occupantDef?.slow ?? 1;
      const stride = Math.max(1, Math.round(((def.speed * CELL) / TICKS_PER_SECOND) * slow));
      const advanced = enemy.pos - stride;
      const cellEdge = col * CELL;
      const ahead = world.unitAt(enemy.lane, col - 1);
      const blockedAhead = ahead && ahead.hp > 0 && world.unitDef(ahead.defId).blocks !== false;
      // Stop flush against the next blocking unit instead of overlapping it.
      enemy.pos = blockedAhead && advanced < cellEdge ? cellEdge : advanced;
    }
    state.units = state.units.filter((unit) => {
      if (unit.hp > 0) return true;
      events.push({ type: 'unit_died', uid: unit.uid, cause: 'killed' });
      return false;
    });
  };
}
