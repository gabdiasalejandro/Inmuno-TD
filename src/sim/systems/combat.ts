import { TICKS_PER_SECOND, secondsToTicks } from '../time';
import type { EnemyState, UnitState } from '../types';
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
      events.push({ type: 'unit_died', uid: unit.uid, cause: 'expired', defId: unit.defId, row: unit.row, col: unit.col });
      return false;
    });
  };
}

/**
 * Own unit a unit that attacks own units goes for: within its radius, alive and carrying every
 * required status; the closest one, then the one whose first status runs out soonest.
 */
function ownTarget(world: World, unit: UnitState, range: number, status: string[] = []): UnitState | undefined {
  const soonest = (u: UnitState): number => Math.min(...status.map((name) => u.statuses[name] ?? Infinity));
  const distance = (u: UnitState): number => Math.max(Math.abs(u.row - unit.row), Math.abs(u.col - unit.col));
  let best: UnitState | undefined;
  for (const other of world.unitsAround(unit.row, unit.col, range)) {
    if (other.hp <= 0 || !status.every((name) => world.hasStatus(other, name))) continue;
    if (!best || distance(other) < distance(best) || (distance(other) === distance(best) && soonest(other) < soonest(best))) best = other;
  }
  return best;
}

/**
 * Units attack the nearest valid enemy in their lane, or, with `targets: 'own'`, an own unit with
 * the required statuses around them. Enemies and units at zero hit points are removed.
 */
export function createUnitAttacks(world: World): System {
  const { state } = world;
  return (events) => {
    for (const unit of state.units) {
      const { attack } = world.unitDef(unit.defId);
      if (!attack || unit.hp <= 0 || state.tick < unit.attackReadyAt) continue;
      if (attack.targets === 'own') {
        const cell = ownTarget(world, unit, attack.range, attack.status);
        if (!cell) continue;
        cell.hp -= attack.damage;
        unit.attackReadyAt = state.tick + attackIntervalTicks(attack.rate);
        events.push({ type: 'cell_attacked', uid: unit.uid, target: cell.uid, damage: attack.damage });
        continue;
      }
      const target = world.findTarget(unit, attack.range, attack.requires);
      if (!target) continue;
      const damage = attack.damage * world.enemyDamageMultiplier(target);
      target.hp -= damage;
      unit.attackReadyAt = state.tick + attackIntervalTicks(attack.rate);
      events.push({ type: 'unit_attacked', uid: unit.uid, target: target.uid, damage });
    }
    state.enemies = state.enemies.filter((enemy) => {
      if (enemy.hp > 0) return true;
      events.push({ type: 'enemy_died', uid: enemy.uid });
      return false;
    });
    world.removeDeadUnits(events);
  };
}

/** Whether a live unit stands on this cell and stops enemies. */
function blocksAt(world: World, row: number, col: number): boolean {
  const unit = world.unitAt(row, col);
  return !!unit && unit.hp > 0 && world.unitDef(unit.defId).blocks !== false;
}

/** Whether an infecting enemy can infect this unit: it carries the required tags (whatever its statuses). */
function infectable(world: World, enemy: EnemyState, unit: UnitState): boolean {
  const infects = world.enemyDef(enemy.defId).infects;
  if (!infects) return false;
  const tags = world.unitDef(unit.defId).tags ?? [];
  return (infects.requires ?? []).every((tag) => tags.includes(tag));
}

/**
 * Whether a live blocking unit stops this enemy. An infecting enemy that cannot infect the unit
 * right now goes through it, unless it is `lost` on such cells.
 */
function stops(world: World, enemy: EnemyState, unit: UnitState | undefined): boolean {
  if (!unit || unit.hp <= 0 || world.unitDef(unit.defId).blocks === false) return false;
  if (!infectable(world, enemy, unit)) return true;
  const infects = world.enemyDef(enemy.defId).infects!;
  return infects.resisted === 'lost' || world.canTake(unit, infects.status);
}

/**
 * Lane a spreading enemy moves to instead of attacking the barrier in front of it: a neighbouring
 * lane with nothing blocking at that column, picked with the level's seeded RNG when both are free.
 * None once the enemy has used up its `maxSwitches`.
 */
function spreadLane(world: World, enemy: EnemyState, blocker: UnitState, col: number): number | undefined {
  const spreads = world.enemyDef(enemy.defId).spreads;
  if (!spreads || enemy.switches >= (spreads.maxSwitches ?? Infinity)) return undefined;
  const tags = world.unitDef(blocker.defId).tags ?? [];
  if (!spreads.around.some((tag) => tags.includes(tag))) return undefined;
  const free = [enemy.lane - 1, enemy.lane + 1].filter(
    (lane) => lane >= 0 && lane < world.level.grid.rows && !blocksAt(world, lane, col),
  );
  if (free.length < 2) return free[0];
  return free[Math.floor(world.random() * free.length)];
}

/** Enemies attack whatever blocks them, otherwise advance; units at zero hit points are removed. */
export function createEnemyActions(world: World): System {
  const { state } = world;
  return (events) => {
    const consumed = new Set<number>();
    for (const enemy of state.enemies) {
      const def = world.enemyDef(enemy.defId);
      const col = engagedCol(enemy.pos);
      const occupant = world.unitAt(enemy.lane, col);
      const occupantDef = occupant && world.unitDef(occupant.defId);
      const blocker = stops(world, enemy, occupant) ? occupant : undefined;
      if (blocker && def.infects && infectable(world, enemy, blocker)) {
        // Infection instead of an attack: the enemy uses itself up on the cell, even when the
        // cell resists it (only enemies `lost` on resisting cells are stopped by those).
        world.applyStatus(blocker, def.infects.status, events, enemy.uid);
        consumed.add(enemy.uid);
        events.push({ type: 'enemy_consumed', uid: enemy.uid, target: blocker.uid });
        continue;
      }
      if (blocker) {
        const lane = spreadLane(world, enemy, blocker, col);
        if (lane !== undefined) {
          events.push({ type: 'enemy_switched_lane', uid: enemy.uid, from: enemy.lane, to: lane });
          enemy.lane = lane;
          enemy.switches++;
          continue;
        }
        if (state.tick < enemy.attackReadyAt) continue;
        blocker.hp -= def.attack.damage;
        enemy.attackReadyAt = state.tick + attackIntervalTicks(def.attack.rate);
        events.push({ type: 'enemy_attacked', uid: enemy.uid, target: blocker.uid, damage: def.attack.damage });
        continue;
      }
      // A non-blocking occupant (or one an infecting enemy goes through) and any trap may slow whoever crosses the cell.
      const slow = (occupantDef?.slow ?? 1) * world.trapSlow(enemy, col);
      const stride = Math.max(1, Math.round(((def.speed * CELL) / TICKS_PER_SECOND) * slow));
      const advanced = enemy.pos - stride;
      const cellEdge = col * CELL;
      const blockedAhead = stops(world, enemy, world.unitAt(enemy.lane, col - 1));
      // Stop flush against the next blocking unit instead of overlapping it.
      enemy.pos = blockedAhead && advanced < cellEdge ? cellEdge : advanced;
    }
    if (consumed.size > 0) state.enemies = state.enemies.filter((enemy) => !consumed.has(enemy.uid));
    world.removeDeadUnits(events);
  };
}
