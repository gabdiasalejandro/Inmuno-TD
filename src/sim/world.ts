import { createRng } from './rng';
import { secondsToTicks } from './time';
import type {
  Content,
  EnemyDef,
  EnemyState,
  LevelDef,
  SignalDef,
  SimEvent,
  SimState,
  PowerDef,
  StatusDef,
  TrapDef,
  UnitDef,
  UnitState,
} from './types';

/** Enemy positions are integers in thousandths of a cell. */
export const CELL = 1000;
/** Signals and marrow charge are kept as integers in thousandths. */
export const MILLI = 1000;

/** One simulation step of one concern. Systems run in the fixed order set in `sim.ts`. */
export type System = (events: SimEvent[]) => void;

/**
 * Everything the systems share: the level, its content, the mutable state and the queries
 * more than one system needs. A new mechanic is a new system that reads and writes this.
 */
export interface World {
  readonly level: LevelDef;
  readonly state: SimState;
  /** Signals active in this level, in content order. */
  readonly signalDefs: ReadonlyArray<readonly [string, SignalDef]>;
  unitDef(id: string): UnitDef;
  enemyDef(id: string): EnemyDef;
  unitAt(row: number, col: number): UnitState | undefined;
  /** Nearest enemy to the base in the unit's lane, from the unit's own cell up to `range` cells ahead. */
  findTarget(unit: UnitState, range: number, requires?: string[]): EnemyState | undefined;
  /** Level of a signal from 0 to 1. Unknown or inactive signals read 0. */
  signalFraction(name: string): number;
  /** Sum over all active signals of `boost * level`, for one of the boost kinds a signal can grant. */
  boostFrom(pick: (def: SignalDef) => number | undefined): number;
  /** Adds points to an active signal, capped at its maximum. Inactive signals ignore it. */
  raise(name: string, points: number): void;
  /** Removes units at zero hit points, reporting each as killed. */
  removeDeadUnits(events: SimEvent[]): void;
  /** Speed multiplier the traps on this cell apply to this enemy (1 without traps). */
  trapSlow(enemy: EnemyState, col: number): number;
  /** Trap definition by id (traps are declared on the units that lay them). */
  trapDef(id: string): TrapDef;
  /** Power definition by id. */
  powerDef(id: string): PowerDef;
  /** Whether an enemy carries every tag in `requires`, its own tags and those its statuses grant. */
  enemyHas(enemy: EnemyState, requires?: string[]): boolean;
  /** Multiplier on the damage units deal to this enemy, from its active statuses (1 without any). */
  enemyDamageMultiplier(enemy: EnemyState): number;
  /** Next number of the level's seeded random sequence, in [0, 1). Advances the stored state. */
  random(): number;
  /** Status definition by name, if the content declares it. */
  statusDef(name: string): StatusDef | undefined;
  /** Whether the unit carries the status right now. */
  hasStatus(unit: UnitState, name: string): boolean;
  /** Whether the status could be newly applied to the unit: it does not carry it nor anything preventing it. */
  canTake(unit: UnitState, name: string): boolean;
  /**
   * Gives the unit a status for its duration and, when the status `shares`, gives the shared one to
   * the own units around it. Returns false (and changes nothing for this unit) when the unit cannot
   * take it; a shared status the unit already carries is refreshed instead.
   */
  applyStatus(unit: UnitState, name: string, events: SimEvent[], by?: number): boolean;
  /** Own units within `radius` cells of (row, col), the cell itself excluded, in deploy order. */
  unitsAround(row: number, col: number, radius: number): UnitState[];
}

function indexById<T extends { id: string }>(defs: T[]): Map<string, T> {
  return new Map(defs.map((def) => [def.id, def]));
}

/** Tick from which a status applied at `tick` is gone; a status without duration never runs out. */
export function statusEnd(def: StatusDef | undefined, tick: number): number {
  return def?.duration === undefined ? Number.MAX_SAFE_INTEGER : tick + secondsToTicks(def.duration);
}

/** Cell an enemy is pressing against: a front edge exactly on a boundary belongs to the cell on its left. */
export function engagedCol(pos: number): number {
  return Math.ceil(pos / CELL) - 1;
}

export function assertLaneInGrid(level: LevelDef, lane: number, what: string): void {
  if (!Number.isInteger(lane) || lane < 0 || lane >= level.grid.rows) {
    throw new Error(`Level ${level.id}: ${what} ${lane} is outside the grid`);
  }
}

export function createWorld(level: LevelDef, content: Content, seed: number): World {
  const unitDefs = indexById(content.units);
  const enemyDefs = indexById(content.enemies);
  for (const id of level.deck) {
    if (!unitDefs.has(id)) throw new Error(`Level ${level.id}: unknown unit "${id}" in deck`);
  }
  for (const wave of level.waves) {
    if (!enemyDefs.has(wave.enemy)) throw new Error(`Level ${level.id}: unknown enemy "${wave.enemy}"`);
  }
  // A level can leave a signal out so a concept does not act before the level that teaches it.
  const signalDefs = Object.entries(content.signals ?? {}).filter(([name]) => level.signals?.includes(name) ?? true);
  const activeSignals = new Map(signalDefs);

  const state: SimState = {
    tick: 0,
    status: 'playing',
    energy: level.startEnergy,
    units: [],
    enemies: [],
    traps: [],
    defeat: null,
    deployReadyAt: {},
    nextSpawn: 0,
    openLanes: level.wounds ? [] : Array.from({ length: level.grid.rows }, (_, lane) => lane),
    nextUid: 1,
    signals: Object.fromEntries(signalDefs.map(([name]) => [name, 0])),
    woundCharge: {},
    releasing: false,
    released: Object.fromEntries(signalDefs.map(([name]) => [name, 0])),
    marrowCharge: 0,
    powerReadyAt: {},
    rngState: createRng(seed).state,
  };

  const trapDefs = new Map(content.units.flatMap((unit) => (unit.onDeath ? [[unit.onDeath.trap.id, unit.onDeath.trap] as const] : [])));
  const powerDefs = new Map((content.powers ?? []).map((power) => [power.id, power] as const));
  for (const id of level.powers ?? []) {
    if (!powerDefs.has(id)) throw new Error(`Level ${level.id}: unknown power "${id}"`);
  }
  const statusDefs = content.statuses ?? {};
  for (const [name, def] of Object.entries(statusDefs)) {
    if (def.burst && !enemyDefs.has(def.burst.enemy)) throw new Error(`Status "${name}": unknown enemy "${def.burst.enemy}"`);
  }
  const hasStatus = (unit: UnitState, name: string): boolean => (unit.statuses[name] ?? 0) > state.tick;
  const canTake = (unit: UnitState, name: string): boolean =>
    !hasStatus(unit, name) &&
    !Object.keys(unit.statuses).some((held) => hasStatus(unit, held) && statusDefs[held]?.prevents?.includes(name));
  const unitsAround = (row: number, col: number, radius: number): UnitState[] =>
    state.units.filter(
      (unit) => (unit.row !== row || unit.col !== col) && Math.abs(unit.row - row) <= radius && Math.abs(unit.col - col) <= radius,
    );
  const give = (unit: UnitState, name: string, def: StatusDef): void => {
    unit.statuses[name] = Math.max(unit.statuses[name] ?? 0, statusEnd(def, state.tick));
  };

  const activeEnemyStatuses = (enemy: EnemyState): StatusDef[] =>
    Object.entries(enemy.statuses ?? {})
      .filter(([, until]) => until > state.tick)
      .flatMap(([name]) => (statusDefs[name] ? [statusDefs[name]] : []));

  const enemyHas = (enemy: EnemyState, requires: string[] = []): boolean => {
    const tags = [...(enemyDefs.get(enemy.defId)?.tags ?? []), ...activeEnemyStatuses(enemy).flatMap((def) => def.grants ?? [])];
    return requires.every((tag) => tags.includes(tag));
  };

  const enemyDamageMultiplier = (enemy: EnemyState): number =>
    activeEnemyStatuses(enemy).reduce((factor, def) => factor * (def.damageMultiplier ?? 1), 1);

  // Ids were validated above or come from state the sim itself created.
  const enemyDef = (id: string): EnemyDef => enemyDefs.get(id)!;

  const signalFraction = (name: string): number => {
    const max = activeSignals.get(name)?.max;
    return max ? (state.signals[name] ?? 0) / (max * MILLI) : 0;
  };

  return {
    level,
    state,
    signalDefs,
    unitDef: (id) => unitDefs.get(id)!,
    enemyDef,
    unitAt: (row, col) => state.units.find((unit) => unit.row === row && unit.col === col),
    findTarget(unit, range, requires = []) {
      const nearEdge = unit.col * CELL;
      const farEdge = (unit.col + 1 + range) * CELL;
      let target: EnemyState | undefined;
      for (const enemy of state.enemies) {
        if (enemy.lane !== unit.row || enemy.hp <= 0) continue;
        if (enemy.pos <= nearEdge || enemy.pos > farEdge) continue;
        if (!enemyHas(enemy, requires)) continue;
        if (!target || enemy.pos < target.pos) target = enemy;
      }
      return target;
    },
    signalFraction,
    boostFrom: (pick) => signalDefs.reduce((sum, [name, def]) => sum + (pick(def) ?? 0) * signalFraction(name), 0),
    trapDef: (id) => trapDefs.get(id)!,
    powerDef: (id) => powerDefs.get(id)!,
    enemyHas,
    enemyDamageMultiplier,
    trapSlow(enemy, col) {
      let slow = 1;
      for (const trap of state.traps) {
        if (trap.row !== enemy.lane || trap.col !== col) continue;
        const def = trapDefs.get(trap.defId)!;
        if (enemyHas(enemy, def.requires)) slow *= def.slow;
      }
      return slow;
    },
    raise(name, points) {
      const def = activeSignals.get(name);
      if (!def) return;
      state.signals[name] = Math.min(def.max * MILLI, (state.signals[name] ?? 0) + Math.round(points * MILLI));
    },
    removeDeadUnits(events) {
      state.units = state.units.filter((unit) => {
        if (unit.hp > 0) return true;
        events.push({ type: 'unit_died', uid: unit.uid, cause: 'killed', defId: unit.defId, row: unit.row, col: unit.col });
        return false;
      });
    },
    statusDef: (name) => statusDefs[name],
    hasStatus,
    canTake,
    unitsAround,
    applyStatus(unit, name, events, by) {
      const def = statusDefs[name];
      if (!def || !canTake(unit, name)) return false;
      give(unit, name, def);
      events.push(by === undefined ? { type: 'status_applied', uid: unit.uid, status: name } : { type: 'status_applied', uid: unit.uid, status: name, by });
      const shared = def.shares && statusDefs[def.shares.status];
      if (def.shares && shared) {
        for (const neighbour of unitsAround(unit.row, unit.col, def.shares.radius)) {
          if (neighbour.hp <= 0) continue;
          if (hasStatus(neighbour, def.shares.status)) {
            give(neighbour, def.shares.status, shared);
          } else if (canTake(neighbour, def.shares.status)) {
            give(neighbour, def.shares.status, shared);
            events.push({ type: 'status_applied', uid: neighbour.uid, status: def.shares.status });
          }
        }
      }
      return true;
    },
    random() {
      const rng = createRng(state.rngState);
      const value = rng.next();
      state.rngState = rng.state;
      return value;
    },
  };
}
