import { createRng } from './rng';
import type {
  Content,
  EnemyDef,
  EnemyState,
  LevelDef,
  SignalDef,
  SimEvent,
  SimState,
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
  /** Matching enemies in the same detection window, for signals that scale with the threat. */
  countTargets(unit: UnitState, range: number, requires?: string[]): number;
  /** Level of a signal from 0 to 1. Unknown or inactive signals read 0. */
  signalFraction(name: string): number;
  /** Sum over all active signals of `boost * level`, for one of the boost kinds a signal can grant. */
  boostFrom(pick: (def: SignalDef) => number | undefined): number;
}

function indexById<T extends { id: string }>(defs: T[]): Map<string, T> {
  return new Map(defs.map((def) => [def.id, def]));
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
    deployReadyAt: {},
    nextSpawn: 0,
    openLanes: level.wounds ? [] : Array.from({ length: level.grid.rows }, (_, lane) => lane),
    nextUid: 1,
    signals: Object.fromEntries(signalDefs.map(([name]) => [name, 0])),
    marrowCharge: 0,
    rngState: createRng(seed).state,
  };

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
        const tags = enemyDef(enemy.defId).tags ?? [];
        if (!requires.every((tag) => tags.includes(tag))) continue;
        if (!target || enemy.pos < target.pos) target = enemy;
      }
      return target;
    },
    countTargets(unit, range, requires = []) {
      const nearEdge = unit.col * CELL;
      const farEdge = (unit.col + 1 + range) * CELL;
      let count = 0;
      for (const enemy of state.enemies) {
        if (enemy.lane !== unit.row || enemy.hp <= 0) continue;
        if (enemy.pos <= nearEdge || enemy.pos > farEdge) continue;
        const tags = enemyDef(enemy.defId).tags ?? [];
        if (!requires.every((tag) => tags.includes(tag))) continue;
        count++;
      }
      return count;
    },
    signalFraction,
    boostFrom: (pick) => signalDefs.reduce((sum, [name, def]) => sum + (pick(def) ?? 0) * signalFraction(name), 0),
  };
}
