import { createRng } from './rng';
import { TICKS_PER_SECOND, secondsToTicks } from './time';
import type {
  Content,
  EnemyDef,
  EnemyState,
  LevelDef,
  PlaceResult,
  Sim,
  SimEvent,
  SignalDef,
  SimState,
  UnitDef,
  UnitState,
} from './types';

/** Enemy positions are integers in thousandths of a cell. */
const CELL = 1000;
/** Signals and marrow charge are kept as integers in thousandths. */
const MILLI = 1000;

interface Spawn {
  tick: number;
  enemy: string;
  lane: number;
}

function indexById<T extends { id: string }>(defs: T[]): Map<string, T> {
  return new Map(defs.map((def) => [def.id, def]));
}

function attackIntervalTicks(rate: number): number {
  return Math.max(1, Math.round(TICKS_PER_SECOND / rate));
}

function buildSchedule(level: LevelDef, enemies: Map<string, EnemyDef>): Spawn[] {
  const schedule: Spawn[] = [];
  for (const wave of level.waves) {
    if (!enemies.has(wave.enemy)) {
      throw new Error(`Level ${level.id}: unknown enemy "${wave.enemy}"`);
    }
    if (!Number.isInteger(wave.lane) || wave.lane < 0 || wave.lane >= level.grid.rows) {
      throw new Error(`Level ${level.id}: lane ${wave.lane} is outside the grid`);
    }
    for (let i = 0; i < wave.count; i++) {
      schedule.push({ tick: secondsToTicks(wave.at + i * wave.gap), enemy: wave.enemy, lane: wave.lane });
    }
  }
  // Array.prototype.sort is stable, so same-tick spawns keep their order in the level file.
  return schedule.sort((a, b) => a.tick - b.tick);
}

/** Cell an enemy is pressing against: a front edge exactly on a boundary belongs to the cell on its left. */
function engagedCol(pos: number): number {
  return Math.ceil(pos / CELL) - 1;
}

export function createSim(level: LevelDef, content: Content, seed: number): Sim {
  const unitDefs = indexById(content.units);
  const enemyDefs = indexById(content.enemies);
  for (const id of level.deck) {
    if (!unitDefs.has(id)) throw new Error(`Level ${level.id}: unknown unit "${id}" in deck`);
  }
  const schedule = buildSchedule(level, enemyDefs);
  const wounds = (level.wounds ?? []).map((wound) => {
    if (!Number.isInteger(wound.lane) || wound.lane < 0 || wound.lane >= level.grid.rows) {
      throw new Error(`Level ${level.id}: wound lane ${wound.lane} is outside the grid`);
    }
    return { tick: secondsToTicks(wound.at), lane: wound.lane };
  });
  const win = level.win ?? { type: 'clear' };
  const marrowThreshold = Math.max(1, secondsToTicks(level.marrow.interval)) * MILLI;
  // A level can leave a signal out so a concept does not act before the level that teaches it.
  const signalDefs: Array<[string, SignalDef]> = Object.entries(content.signals ?? {}).filter(
    ([name]) => level.signals?.includes(name) ?? true,
  );
  const activeSignals = new Map(signalDefs);
  const { rows, cols } = level.grid;

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
  const unitDef = (id: string): UnitDef => unitDefs.get(id)!;
  const enemyDef = (id: string): EnemyDef => enemyDefs.get(id)!;
  const unitAt = (row: number, col: number): UnitState | undefined =>
    state.units.find((unit) => unit.row === row && unit.col === col);

  function openWounds(events: SimEvent[]): void {
    for (const wound of wounds) {
      if (wound.tick > state.tick || state.openLanes.includes(wound.lane)) continue;
      state.openLanes.push(wound.lane);
      events.push({ type: 'wound_opened', lane: wound.lane });
    }
  }

  function spawnDue(events: SimEvent[]): void {
    for (let next = schedule[state.nextSpawn]; next && next.tick <= state.tick; next = schedule[state.nextSpawn]) {
      const def = enemyDef(next.enemy);
      const enemy: EnemyState = {
        uid: state.nextUid++,
        defId: def.id,
        lane: next.lane,
        pos: cols * CELL,
        hp: def.hp,
        attackReadyAt: 0,
      };
      state.enemies.push(enemy);
      state.nextSpawn++;
      events.push({ type: 'enemy_spawned', uid: enemy.uid, defId: enemy.defId, lane: enemy.lane });
    }
  }

  const signalFraction = (name: string): number => {
    const max = activeSignals.get(name)?.max;
    return max ? (state.signals[name] ?? 0) / (max * MILLI) : 0;
  };

  /** Sum over all signals of `boost * level`, for one of the boost kinds a signal can grant. */
  const boostFrom = (pick: (def: SignalDef) => number | undefined): number =>
    signalDefs.reduce((sum, [name, def]) => sum + (pick(def) ?? 0) * signalFraction(name), 0);

  function updateSignals(): void {
    for (const [name, def] of signalDefs) {
      const decayed = (state.signals[name] ?? 0) - Math.round((def.decayPerSecond * MILLI) / TICKS_PER_SECOND);
      state.signals[name] = Math.max(0, decayed);
    }
    for (const unit of state.units) {
      const { emits } = unitDef(unit.defId);
      unit.alarmed = Boolean(emits && findTarget(unit, emits.range, emits.requires));
      const def = emits && activeSignals.get(emits.signal);
      if (!unit.alarmed || !emits || !def) continue;
      const raised = (state.signals[emits.signal] ?? 0) + Math.round((emits.perSecond * MILLI) / TICKS_PER_SECOND);
      state.signals[emits.signal] = Math.min(def.max * MILLI, raised);
    }
  }

  function produceEnergy(events: SimEvent[]): void {
    state.marrowCharge += MILLI + Math.round(MILLI * boostFrom((def) => def.marrowBoost));
    if (state.marrowCharge < marrowThreshold) return;
    state.marrowCharge -= marrowThreshold;
    state.energy += level.marrow.amount;
    events.push({ type: 'energy_gained', amount: level.marrow.amount });
  }

  function expireUnits(events: SimEvent[]): void {
    state.units = state.units.filter((unit) => {
      const { lifespan } = unitDef(unit.defId);
      if (lifespan === undefined || state.tick - unit.bornAt < secondsToTicks(lifespan)) return true;
      events.push({ type: 'unit_died', uid: unit.uid, cause: 'expired' });
      return false;
    });
  }

  /** Nearest enemy to the base in the unit's lane, from the unit's own cell up to its range. */
  function findTarget(unit: UnitState, range: number, requires: string[] = []): EnemyState | undefined {
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
  }

  function unitsAttack(events: SimEvent[]): void {
    for (const unit of state.units) {
      const { attack } = unitDef(unit.defId);
      if (!attack || state.tick < unit.attackReadyAt) continue;
      const target = findTarget(unit, attack.range, attack.requires);
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
  }

  function enemiesAct(events: SimEvent[]): void {
    for (const enemy of state.enemies) {
      const def = enemyDef(enemy.defId);
      const col = engagedCol(enemy.pos);
      const occupant = unitAt(enemy.lane, col);
      const occupantDef = occupant && unitDef(occupant.defId);
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
      const ahead = unitAt(enemy.lane, col - 1);
      const blockedAhead = ahead && ahead.hp > 0 && unitDef(ahead.defId).blocks !== false;
      // Stop flush against the next blocking unit instead of overlapping it.
      enemy.pos = blockedAhead && advanced < cellEdge ? cellEdge : advanced;
    }
    state.units = state.units.filter((unit) => {
      if (unit.hp > 0) return true;
      events.push({ type: 'unit_died', uid: unit.uid, cause: 'killed' });
      return false;
    });
  }

  function resolveOutcome(events: SimEvent[]): void {
    if (state.enemies.some((enemy) => enemy.pos <= 0)) {
      state.status = 'lost';
      events.push({ type: 'lost' });
      return;
    }
    if (win.type === 'survive') {
      if (state.tick < secondsToTicks(win.seconds)) return;
      state.status = 'won';
      events.push({ type: 'won' });
      return;
    }
    // A level without waves is a sandbox: it never ends on its own.
    const allSpawned = schedule.length > 0 && state.nextSpawn >= schedule.length;
    if (allSpawned && state.enemies.length === 0) {
      state.status = 'won';
      events.push({ type: 'won' });
    }
  }

  return {
    state,
    signal: signalFraction,
    marrowFraction: () => state.marrowCharge / marrowThreshold,

    step() {
      if (state.status !== 'playing') return [];
      const events: SimEvent[] = [];
      openWounds(events);
      spawnDue(events);
      state.tick++;
      updateSignals();
      produceEnergy(events);
      expireUnits(events);
      unitsAttack(events);
      enemiesAct(events);
      resolveOutcome(events);
      return events;
    },

    placeUnit(defId, row, col): PlaceResult {
      if (state.status !== 'playing') return { ok: false, reason: 'game_over' };
      if (!level.deck.includes(defId)) return { ok: false, reason: 'not_in_deck' };
      const inGrid = Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < rows && col >= 0 && col < cols;
      if (!inGrid) return { ok: false, reason: 'out_of_bounds' };
      if (unitAt(row, col)) return { ok: false, reason: 'cell_occupied' };
      if (state.tick < (state.deployReadyAt[defId] ?? 0)) return { ok: false, reason: 'on_cooldown' };
      const def = unitDef(defId);
      if (state.energy < def.cost) return { ok: false, reason: 'insufficient_energy' };

      state.energy -= def.cost;
      const recruitSpeed = 1 + boostFrom((signal) => (def.tags?.includes(signal.recruitTag ?? '') ? signal.recruitBoost : 0));
      state.deployReadyAt[defId] = state.tick + Math.round(secondsToTicks(def.cooldown) / recruitSpeed);
      state.units.push({
        uid: state.nextUid++,
        defId,
        row,
        col,
        hp: def.hp,
        bornAt: state.tick,
        attackReadyAt: 0,
        alarmed: false,
      });
      return { ok: true };
    },
  };
}
