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
  /**
   * What the unit attacks: enemies in its lane (default) or own units. Against own units `range`
   * is a radius around the unit's cell (1 = the 8 neighbouring cells) and `status` is required.
   */
  targets?: 'enemies' | 'own';
  /** Statuses an own unit must all carry to be a valid target (only with `targets: 'own'`). */
  status?: string[];
  /**
   * Against enemies carrying every `against` tag (too big to swallow), the unit strikes instead:
   * `damage` at `rate` per second. If the enemy is weak enough (`EnemyDef.engulfBelow`) and has no
   * shield up, the unit engulfs it whole at its own rate instead.
   */
  strike?: { against: string[]; damage: number; rate: number };
}

/**
 * A timed state a unit can carry (for example infected or protected). Content declares them by
 * name; enemies and other statuses apply them.
 */
export interface StatusDef {
  /** Seconds the status lasts once applied. Omitted: it lasts as long as its carrier (a C3b mark stays on the microbe). */
  duration?: number;
  /**
   * Enemy statuses only: tags the enemy counts as carrying while it has the status (for example
   * an opsonized enemy counts as PAMP-marked for phagocytes).
   */
  grants?: string[];
  /** Enemy statuses only: multiplier (above 1 for more) on the damage the enemy takes from units. */
  damageMultiplier?: number;
  /** Statuses that cannot be applied to a unit while it carries this one. */
  prevents?: string[];
  /** When newly applied, the own units within `radius` cells (1 = the 8 neighbours) receive `status`. */
  shares?: { status: string; radius: number };
  /**
   * When the status runs out, the unit dies and releases between `min` and `max` enemies of
   * `enemy` (picked with the level's seeded RNG): the first into its own cell, the rest into the
   * same column of the neighbouring lanes.
   */
  burst?: { enemy: string; min: number; max: number };
}

/**
 * Something that stores signal charge for the player to release. Charge is in signal points;
 * rates are per second.
 */
export interface ChargeDef {
  /** Most signal points the source can hold. */
  capacity: number;
  /** Points gained per second while the source is generating (a unit detecting, a wound open). */
  perSecond?: number;
  /** Points gained per hit point of damage the source takes. */
  perDamage?: number;
}

/**
 * A unit that stores charge of a signal: while it detects a matching enemy (when `range` is set)
 * and/or when it takes damage (`perDamage`).
 */
export interface EmitDef extends ChargeDef {
  signal: string;
  /** Detection reach in cells ahead of the unit's own cell. Without it the unit never detects. */
  range?: number;
  /** Tags an enemy must all carry to be detected. */
  requires?: string[];
}

/** A global meter (for example cytokines) that the player fills from stored charge and the rest of the sim reads. */
export interface SignalDef {
  max: number;
  /** Meter points lost per second, always. */
  decayPerSecond: number;
  /** Points per second that flow from the stored charge into the meter while the player releases. Default 0. */
  releasePerSecond?: number;
  /** Points per second each source loses once it has gone a second without gaining any. Default 0. */
  storeDecayPerSecond?: number;
  /** When set, every open wound is a source of this signal that charges for as long as it is open. */
  fromWounds?: ChargeDef;
  /** Extra marrow speed at full signal: 1 means twice as fast. */
  marrowBoost?: number;
  /** Extra redeploy speed at full signal for units tagged `recruitTag`: 1 means half the cooldown. */
  recruitBoost?: number;
  recruitTag?: string;
  /** The meter also rises by `perPoint` for every point the player releases into `signal`. */
  risesWith?: { signal: string; perPoint: number };
  /** Collateral damage: from this level (0 to 1) up, every own unit loses a share of its max HP. */
  /**
   * Collateral damage tiers, in any order. While the signal is at or above a tier's `from`, own
   * units take that tier's damage; only the highest tier reached applies.
   */
  harm?: HarmDef[];
  /** Reaching this level (0 to 1) loses the level. */
  defeatAt?: number;
}

/** One collateral damage tier of a signal. */
export interface HarmDef {
  /** Level (0 to 1) from which this tier's damage applies. */
  from: number;
  /** Percent of each unit's max hit points lost per second while the signal is at or above `from`. */
  hpPercentPerSecond: number;
}

/**
 * Something a unit leaves on its cell when it dies (for example a NET). It slows and hurts the
 * enemies crossing that cell for a while.
 */
export interface TrapDef {
  id: string;
  /** Seconds the trap lasts. */
  duration: number;
  /** Speed multiplier (0 to 1) applied to enemies crossing the cell. */
  slow: number;
  /** Damage dealt to each enemy in the cell on every hit. */
  damage: number;
  /** Hits per second. */
  rate: number;
  /** Tags an enemy must all carry to be slowed and hurt. */
  requires?: string[];
  /** Points added to a signal when the trap is laid, only in levels where that signal is active. */
  raises?: { signal: string; amount: number };
}

/**
 * A reusable power the player plays on a cell, outside the deck: it acts on an area around that
 * cell, then recharges for `cooldown` seconds. Its cascade runs in the order the steps are
 * declared; each `at` is seconds after the play.
 */
export interface PowerDef {
  id: string;
  /** Seconds before the power can be played again. */
  cooldown: number;
  /** Cells reached on each side of the played cell (1 = the 3x3 square). */
  radius: number;
  /** Enemies in the area get the status (for example opsonized). */
  opsonize?: { status: string; at: number };
  /** The inflammation meter rises by `amount` points, when the level has that signal. */
  inflammation?: { signal: string; amount: number; at: number };
  /** A unit of `unit` is placed on the played cell, or the nearest free cell in its lane. */
  recruit?: { unit: string; at: number };
  /** Enemies in the area carrying every `requires` tag take `damage` (the nearest `max` of them). */
  attack?: { requires: string[]; max: number; damage: number; at: number };
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
  /** What the unit leaves on its cell when it dies, whether killed or expired. */
  onDeath?: { trap: TrapDef };
  /**
   * Antigen pickup (the dendritic cell): one antigen per enemy that dies within `radius` cells.
   * With `capacity` antigen it leaves its cell and walks left along its lane at `speed` cells per
   * second, delivering the load when it reaches the left edge (the lymph node).
   */
  collects?: { radius: number; capacity: number; speed: number };
  lineage?: string;
  tags?: string[];
}

export interface EnemyDef {
  id: string;
  hp: number;
  speed: number;
  attack: { damage: number; rate: number };
  /**
   * Spreads through the tissue: on reaching a blocking unit that carries any of `around` tags it
   * moves to a neighbouring lane instead of attacking, when one is free at that column. With
   * `maxSwitches` it does so at most that many times; after that it attacks barriers like any enemy.
   */
  spreads?: { around: string[]; maxSwitches?: number };
  /**
   * Infects instead of attacking: on reaching a blocking own unit that carries every `requires`
   * tag it gives that unit `status` and is consumed. When the unit cannot take the status (it
   * already has it, or carries one that prevents it) `resisted` decides: `pass` (default) goes on
   * through that cell, `lost` is used up on it without effect. Blocking units without the tags
   * are attacked as usual.
   */
  infects?: { status: string; requires?: string[]; resisted?: 'pass' | 'lost' };
  /** Column the enemy stops in and holds: it walks in from the right edge and advances no further. */
  anchor?: number;
  /** Lanes the enemy covers on each side of its own (a wide boss). Units in any of them reach it, and any of them blocks it. */
  span?: number;
  /**
   * While alive, releases one enemy every `every` seconds from the right edge, of a kind drawn from
   * `pool` by weight and in a lane drawn at random, both with the level's seeded RNG.
   */
  sheds?: { every: number; pool: Array<{ enemy: string; weight: number }> };
  /** Share of max health at or under which a unit that strikes it engulfs it whole (see `AttackDef.strike`). */
  engulfBelow?: number;
  /**
   * Toxins: once its health falls to `from` (share of max), own units carrying every `requires`
   * tag within `radius` cells of any cell it covers lose `damagePerSecond` hit points per second.
   */
  aura?: { from: number; radius: number; requires: string[]; damagePerSecond: number };
  /** Once its health falls to `from` (share of max), it raises a shield of `hp` that takes all damage until it breaks. Once. */
  shield?: { from: number; hp: number };
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
  /** Powers the player can play on this level, outside the deck. Omitted: none. */
  powers?: string[];
  /** Learning objectives as i18n keys, each phrased as an exam question. The sim ignores them. */
  objectives?: string[];
  waves: WaveDef[];
  /** Defaults to `clear`: every wave spawned and every enemy dead. */
  win?: WinCondition;
  /** Names of the content signals active in this level. When omitted, all of them are. */
  signals?: string[];
  /** Lanes that open during the level. When omitted, every lane is open from the start. */
  wounds?: WoundDef[];
  /**
   * The pathogen comes back: once every wave has spawned and the board is clear, while the antigen
   * the win condition needs is neither delivered nor on its way, the waves at or after `from`
   * seconds spawn again, the first of them `after` seconds later. Only for `antigen` wins.
   * `chronic`: each return raises a floor of `points` under that signal, which its decay cannot
   * go below (a recurring infection keeps the tissue inflamed).
   */
  returns?: { from: number; after: number; chronic?: { signal: string; points: number } };
}

/** `antigen`: won as soon as `count` antigen reach the lymph node, whatever is still on the board. */
/** `boss`: won once an enemy of that id has appeared, died, and no other enemy is left (nor about to burst out). */
export type WinCondition =
  | { type: 'clear' }
  | { type: 'survive'; seconds: number }
  | { type: 'antigen'; count: number }
  | { type: 'boss'; enemy: string };

export interface WoundDef {
  /** Second at which the lane opens. */
  at: number;
  lane: number;
}

export interface Content {
  units: UnitDef[];
  enemies: EnemyDef[];
  signals?: Record<string, SignalDef>;
  /** Unit statuses by name. */
  statuses?: Record<string, StatusDef>;
  powers?: PowerDef[];
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
  /** Stored charge of its `emits` signal, in thousandths of a point; capped at its capacity. */
  charge: number;
  /** Tick at which the unit last gained charge (stored charge decays once it goes idle). */
  chargedAt: number;
  /** Statuses the unit carries, by name, with the tick from which each is gone. */
  statuses: Record<string, number>;
  /** Antigen picked up so far, for units that `collects`. */
  antigen?: number;
}

/** A collecting unit that left its cell and walks to the lymph node with its antigen. */
export interface CourierState {
  uid: number;
  defId: string;
  row: number;
  /** Position in thousandths of a cell from the left edge of the grid. */
  pos: number;
  antigen: number;
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
  /** Lane switches made so far (enemies that spread around barriers). */
  switches: number;
  /** Enemy statuses by name, with the tick from which each is gone. */
  statuses?: Record<string, number>;
  /** Hit points left on its shield (see `EnemyDef.shield`); damage goes here first. */
  shield?: number;
  /** Health phases already reached, in order (`aura`, `shield`). */
  phases?: BossPhase[];
  /** Tick of its next shed enemy, and how many it has shed (see `EnemyDef.sheds`). */
  nextShed?: number;
  shed?: number;
}

export type BossPhase = 'aura' | 'shield';

/** A trap laid on a cell (for example a NET). */
export interface TrapState {
  uid: number;
  defId: string;
  row: number;
  col: number;
  /** Tick it was laid; it hits on ticks `laidAt + k * interval`. */
  laidAt: number;
  /** Tick from which it is gone. */
  until: number;
}

/** Why a level was lost: an enemy crossed the tissue, or a signal reached its `defeatAt`. */
export type DefeatCause = { type: 'breach' } | { type: 'signal'; signal: string };

export type SimStatus = 'playing' | 'won' | 'lost';

export interface SimState {
  tick: number;
  status: SimStatus;
  energy: number;
  units: UnitState[];
  enemies: EnemyState[];
  /** Traps laid on cells, in the order they were laid. */
  traps: TrapState[];
  /** Why the level was lost; null while playing or after a win. */
  defeat: DefeatCause | null;
  /** Tick from which each unit id can be deployed again. */
  deployReadyAt: Record<string, number>;
  /** Index of the next entry of the spawn schedule. */
  nextSpawn: number;
  /** Lanes enemies can currently come through, in the order they opened. */
  openLanes: number[];
  nextUid: number;
  /** Signal levels in thousandths of a point, so they stay exact integers. */
  signals: Record<string, number>;
  /** Stored charge of each open wound, by lane, in thousandths of a point of the signal wounds feed. */
  woundCharge: Record<number, number>;
  /** Whether the player is holding the release: stored charge flows into the meters every tick. */
  releasing: boolean;
  /** Total ever released into each signal, in thousandths of a point (later mechanics may read it). */
  released: Record<string, number>;
  /** Marrow progress toward its next batch, in thousandths of a tick. */
  marrowCharge: number;
  /** Tick from which each power can be played again. */
  powerReadyAt: Record<string, number>;
  /** Collecting units walking to the lymph node, in the order they left. */
  couriers: CourierState[];
  /** Antigen delivered to the lymph node so far. */
  antigenDelivered: number;
  /** Times the pathogen came back (see `LevelDef.returns`). */
  returns: number;
  /** Level, in thousandths of a point, under which each signal cannot decay (chronic returns). */
  signalFloors: Record<string, number>;
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

export type PowerFailure = 'game_over' | 'not_in_powers' | 'out_of_bounds' | 'on_cooldown';

export type PowerResult = { ok: true } | { ok: false; reason: PowerFailure };

/** Something that stores signal charge: a unit by id, or the open wound of a lane. */
export type SignalSource = { kind: 'unit'; uid: number } | { kind: 'wound'; lane: number };

/** The steps a power's cascade can take, in the order they are declared on `PowerDef`. */
export type PowerStepKind = 'opsonize' | 'inflammation' | 'recruit' | 'attack';

export type SimEvent =
  | { type: 'energy_gained'; amount: number }
  /** One step of a power's cascade ran. `enemies` are the uids it touched, `unit` the unit it placed. */
  | { type: 'power_step'; power: string; kind: PowerStepKind; enemies: number[]; unit?: number; amount?: number }
  | { type: 'wound_opened'; lane: number }
  /** Stored charge that flowed into a signal this tick while the player held the release, in points. */
  | { type: 'signal_released'; signal: string; amount: number }
  | { type: 'enemy_spawned'; uid: number; defId: string; lane: number }
  /** A unit hit an enemy; `kind` tells a strike or a final engulfing from an ordinary attack. */
  | { type: 'unit_attacked'; uid: number; target: number; damage: number; kind?: 'strike' | 'engulf' }
  | { type: 'enemy_attacked'; uid: number; target: number; damage: number }
  | { type: 'enemy_died'; uid: number }
  | { type: 'unit_died'; uid: number; cause: 'killed' | 'expired'; defId: string; row: number; col: number }
  | { type: 'trap_laid'; uid: number; defId: string; row: number; col: number }
  | { type: 'trap_hit'; uid: number; target: number; damage: number }
  | { type: 'enemy_switched_lane'; uid: number; from: number; to: number }
  /** A status was given to a unit: by an enemy (`by` is its uid) or shared from a neighbour. */
  | { type: 'status_applied'; uid: number; status: string; by?: number }
  /** An enemy that infects used itself up on the unit `target`. */
  | { type: 'enemy_consumed'; uid: number; target: number }
  /** A unit's status ran out and the unit burst, releasing the enemies `released` (uids). */
  | { type: 'status_burst'; uid: number; status: string; row: number; col: number; released: number[] }
  /** A unit attacked an own unit (for example a marked one). */
  | { type: 'cell_attacked'; uid: number; target: number; damage: number }
  /** A collecting unit took antigen from an enemy that died around it. */
  | { type: 'antigen_taken'; uid: number; enemy: number }
  /** A full collecting unit left its cell for the lymph node. */
  | { type: 'unit_migrated'; uid: number; row: number; col: number; antigen: number }
  /** A courier reached the left edge and delivered its antigen. */
  | { type: 'antigen_delivered'; uid: number; row: number; amount: number }
  /** A boss reached a health phase (its toxins or its shield). */
  | { type: 'boss_phase'; uid: number; phase: BossPhase }
  /** The pathogen came back for the `count`-th time. */
  | { type: 'pathogen_returned'; count: number }
  | { type: 'won' }
  | { type: 'lost'; cause: DefeatCause };

export interface Sim {
  /** Live state. Plain data: safe to clone, serialize and compare. Do not mutate from outside. */
  readonly state: SimState;
  /** Advances exactly one fixed tick and returns what happened during it. */
  step(): SimEvent[];
  placeUnit(defId: string, row: number, col: number): PlaceResult;
  /** Plays a one-use power on a cell; its cascade then runs over the following ticks. */
  playPower(defId: string, row: number, col: number): PowerResult;
  /**
   * Player command, applied on every following tick until changed: while on, stored charge flows
   * into its signal at the signal's `releasePerSecond`, never more than is stored nor past `max`.
   */
  setReleasing(on: boolean): void;
  /** Stored charge of a source as a share of its capacity (0 to 1), or null when it is not an active source. */
  charge(source: SignalSource): number | null;
  /** Charge stored in all sources of a signal, in signal points. Unknown or inactive signals read 0. */
  stored(name: string): number;
  /** Level of a signal from 0 (none) to 1 (its maximum). Unknown signals read 0. */
  signal(name: string): number;
  /** Marrow progress toward its next energy batch, from 0 to 1. */
  marrowFraction(): number;
}
