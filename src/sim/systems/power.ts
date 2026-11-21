import { secondsToTicks } from '../time';
import type { EnemyState, PowerDef, PowerResult, PowerStepKind, SimEvent, UnitState } from '../types';
import { engagedCol, type System, type World } from '../world';

interface PendingStep {
  due: number;
  power: string;
  kind: PowerStepKind;
  row: number;
  col: number;
  def: PowerDef;
}

/**
 * One-use powers: a card played on a cell acts on an area around it. Its cascade runs in a fixed
 * order (opsonize, inflammation, recruit, attack), each step at its own delay, so the player can
 * read the sequence. Steps re-read the board when they run, so enemies that moved still count.
 */
export function createPowers(world: World): { system: System; play(defId: string, row: number, col: number): PowerResult } {
  const { state, level } = world;
  const { rows, cols } = level.grid;
  let pending: PendingStep[] = [];

  const inArea = (enemy: EnemyState, row: number, col: number, radius: number): boolean =>
    enemy.hp > 0 && Math.abs(enemy.lane - row) <= radius && Math.abs(engagedCol(enemy.pos) - col) <= radius;

  const enemiesIn = (row: number, col: number, radius: number): EnemyState[] =>
    state.enemies.filter((enemy) => inArea(enemy, row, col, radius));

  /** The played cell if free, otherwise the nearest free cell in the same lane. */
  const freeCellNear = (row: number, col: number): number | undefined => {
    for (let distance = 0; distance < cols; distance++) {
      for (const c of distance === 0 ? [col] : [col - distance, col + distance]) {
        if (c >= 0 && c < cols && !world.unitAt(row, c)) return c;
      }
    }
    return undefined;
  };

  const run = ({ power, kind, row, col, def }: PendingStep, events: SimEvent[]): void => {
    const area = enemiesIn(row, col, def.radius);
    switch (kind) {
      case 'opsonize': {
        const status = def.opsonize!.status;
        const until = state.tick + secondsToTicks(world.statusDef(status)?.duration ?? 0);
        for (const enemy of area) {
          enemy.statuses ??= {};
          enemy.statuses[status] = Math.max(enemy.statuses[status] ?? 0, until);
        }
        events.push({ type: 'power_step', power, kind, enemies: area.map((enemy) => enemy.uid) });
        return;
      }
      case 'inflammation': {
        const { signal, amount } = def.inflammation!;
        world.raise(signal, amount);
        events.push({ type: 'power_step', power, kind, enemies: area.map((enemy) => enemy.uid), amount });
        return;
      }
      case 'recruit': {
        const defId = def.recruit!.unit;
        const c = freeCellNear(row, col);
        if (c === undefined) {
          events.push({ type: 'power_step', power, kind, enemies: [] });
          return;
        }
        const unitDef = world.unitDef(defId);
        const unit: UnitState = {
          uid: state.nextUid++,
          defId,
          row,
          col: c,
          hp: unitDef.hp,
          bornAt: state.tick,
          attackReadyAt: 0,
          alarmed: false,
          charge: 0,
          chargedAt: state.tick,
          statuses: {},
        };
        state.units.push(unit);
        events.push({ type: 'power_step', power, kind, enemies: [], unit: unit.uid });
        return;
      }
      case 'attack': {
        const { requires, max, damage } = def.attack!;
        const targets = area
          .filter((enemy) => world.enemyHas(enemy, requires))
          .sort((a, b) => a.pos - b.pos)
          .slice(0, max);
        for (const enemy of targets) enemy.hp -= damage;
        events.push({ type: 'power_step', power, kind, enemies: targets.map((enemy) => enemy.uid) });
        return;
      }
    }
  };

  return {
    system(events) {
      const due = pending.filter((step) => step.due <= state.tick);
      if (due.length === 0) return;
      pending = pending.filter((step) => step.due > state.tick);
      for (const step of due) run(step, events);
      state.enemies = state.enemies.filter((enemy) => {
        if (enemy.hp > 0) return true;
        events.push({ type: 'enemy_died', uid: enemy.uid });
        return false;
      });
    },

    play(defId, row, col) {
      if (state.status !== 'playing') return { ok: false, reason: 'game_over' };
      if (!level.deck.includes(defId)) return { ok: false, reason: 'not_in_deck' };
      const def = world.unitDef(defId);
      if (def.kind !== 'power' || !def.power) return { ok: false, reason: 'not_a_power' };
      const inGrid = Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < rows && col >= 0 && col < cols;
      if (!inGrid) return { ok: false, reason: 'out_of_bounds' };
      if (state.powersUsed.includes(defId)) return { ok: false, reason: 'already_used' };

      state.powersUsed.push(defId);
      const power = def.power;
      const steps: Array<[PowerStepKind, number | undefined]> = [
        ['opsonize', power.opsonize?.at],
        ['inflammation', power.inflammation?.at],
        ['recruit', power.recruit?.at],
        ['attack', power.attack?.at],
      ];
      for (const [kind, at] of steps) {
        if (at === undefined) continue;
        pending.push({ due: state.tick + secondsToTicks(at), power: defId, kind, row, col, def: power });
      }
      return { ok: true };
    },
  };
}
