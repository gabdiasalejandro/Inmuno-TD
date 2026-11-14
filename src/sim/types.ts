/**
 * Content definitions mirror the JSON files in src/data. Durations are in seconds,
 * distances in cells, speeds in cells per second.
 */

export interface AttackDef {
  type: string;
  damage: number;
  /** Attacks per second. */
  rate: number;
  /** Reach in cells ahead of the unit's own cell. */
  range: number;
  /** Tags an enemy must all carry to be a valid target (for example a PAMP its receptor recognises). */
  requires?: string[];
}

/** A unit that raises a global signal while it detects a matching enemy. */
export interface EmitDef {
  signal: string;
  /** Signal points added per second while detecting. */
  perSecond: number;
  /** Detection reach in cells ahead of the unit's own cell. */
  range: number;
  /** Tags an enemy must all carry to be detected. */
  requires?: string[];
}

/** A global meter (for example cytokines) that units raise and the rest of the sim reads. */
export interface SignalDef {
  max: number;
  /** Points lost per second, always. */
  decayPerSecond: number;
  /** Extra marrow speed at full signal: 1 means twice as fast. */
  marrowBoost?: number;
  /** Extra redeploy speed at full signal for units tagged `recruitTag`: 1 means half the cooldown. */
  recruitBoost?: number;
  recruitTag?: string;
}

export interface UnitDef {
  id: string;
  cost: number;
  /** Seconds before the same unit can be deployed again. */
  cooldown: number;
  hp: number;
  /** Seconds the unit lives once deployed. Omit for units that do not expire. */
  lifespan?: number;
  attack?: AttackDef;
  emits?: EmitDef;
  /** Whether enemies stop at this unit and attack it. Defaults to true. */
  blocks?: boolean;
  /** Speed multiplier (0 to 1) applied to enemies while they cross this unit's cell. */
  slow?: number;
  lineage?: string;
  tags?: string[];
}

export interface EnemyDef {
  id: string;
  hp: number;
  speed: number;
  attack: { damage: number; rate: number };
  tags?: string[];
}

export interface WaveDef {
  /** Second at which the first enemy of the wave appears. */
  at: number;
  enemy: string;
  lane: number;
  count: number;
  /** Seconds between consecutive enemies of the wave. */
  gap: number;
}

export interface LevelDef {
  id: string;
  grid: { rows: number; cols: number };
  startEnergy: number;
  /** Baseline energy production: `amount` every `interval` seconds. */
  marrow: { amount: number; interval: number };
  deck: string[];
  waves: WaveDef[];
  /** Defaults to `clear`: every wave spawned and every enemy dead. */
  win?: WinCondition;
  /** Names of the content signals active in this level. When omitted, all of them are. */
  signals?: string[];
  /** Lanes that open during the level. When omitted, every lane is open from the start. */
  wounds?: WoundDef[];
}

export type WinCondition = { type: 'clear' } | { type: 'survive'; seconds: number };

export interface WoundDef {
  /** Second at which the lane opens. */
  at: number;
  lane: number;
}

export interface Content {
  units: UnitDef[];
  enemies: EnemyDef[];
  signals?: Record<string, SignalDef>;
}

export interface UnitState {
  uid: number;
  defId: string;
  row: number;
  col: number;
  hp: number;
  bornAt: number;
  /** Tick from which the unit may attack again. */
  attackReadyAt: number;
  /** True while the unit's `emits` detection sees a matching enemy. */
  alarmed: boolean;
}

export interface EnemyState {
  uid: number;
  defId: string;
  lane: number;
  /**
   * Front edge of the enemy in thousandths of a cell, measured from the left edge of the grid.
   * Integer on purpose: movement stays exact and reproducible.
   */
  pos: number;
  hp: number;
  attackReadyAt: number;
}

export type SimStatus = 'playing' | 'won' | 'lost';

export interface SimState {
  tick: number;
  status: SimStatus;
  energy: number;
  units: UnitState[];
  enemies: EnemyState[];
  /** Tick from which each unit id can be deployed again. */
  deployReadyAt: Record<string, number>;
  /** Index of the next entry of the spawn schedule. */
  nextSpawn: number;
  /** Lanes enemies can currently come through, in the order they opened. */
  openLanes: number[];
  nextUid: number;
  /** Signal levels in thousandths of a point, so they stay exact integers. */
  signals: Record<string, number>;
  /** Marrow progress toward its next batch, in thousandths of a tick. */
  marrowCharge: number;
  rngState: number;
}

export type PlaceFailure =
  | 'game_over'
  | 'not_in_deck'
  | 'out_of_bounds'
  | 'cell_occupied'
  | 'on_cooldown'
  | 'insufficient_energy';

export type PlaceResult = { ok: true } | { ok: false; reason: PlaceFailure };

export type SimEvent =
  | { type: 'energy_gained'; amount: number }
  | { type: 'wound_opened'; lane: number }
  | { type: 'enemy_spawned'; uid: number; defId: string; lane: number }
  | { type: 'unit_attacked'; uid: number; target: number; damage: number }
  | { type: 'enemy_attacked'; uid: number; target: number; damage: number }
  | { type: 'enemy_died'; uid: number }
  | { type: 'unit_died'; uid: number; cause: 'killed' | 'expired' }
  | { type: 'won' }
  | { type: 'lost' };

export interface Sim {
  /** Live state. Plain data: safe to clone, serialize and compare. Do not mutate from outside. */
  readonly state: SimState;
  /** Advances exactly one fixed tick and returns what happened during it. */
  step(): SimEvent[];
  placeUnit(defId: string, row: number, col: number): PlaceResult;
  /** Level of a signal from 0 (none) to 1 (its maximum). Unknown signals read 0. */
  signal(name: string): number;
  /** Marrow progress toward its next energy batch, from 0 to 1. */
  marrowFraction(): number;
}
