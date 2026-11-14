import { content, levels } from '../../src/data';
import { createSim, secondsToTicks, type LevelDef, type Sim } from '../../src/sim';

export type Bot = (sim: Sim, level: LevelDef) => void;

/** Column of the cell the frontmost enemy of a lane is pressing against, if any. */
export function frontCol(sim: Sim, lane: number): number | undefined {
  const inLane = sim.state.enemies.filter((enemy) => enemy.lane === lane);
  return inLane.length ? Math.ceil(Math.min(...inLane.map((enemy) => enemy.pos)) / 1000) - 1 : undefined;
}

export const unitsIn = (sim: Sim, lane: number, defId: string) =>
  sim.state.units.filter((unit) => unit.row === lane && unit.defId === defId);

export const isFree = (sim: Sim, row: number, col: number): boolean =>
  !sim.state.units.some((unit) => unit.row === row && unit.col === col);

/** Keeps one unit of `defId` alive in every open lane, at `col` or just behind the bacteria if they got past. */
export const holdLanes =
  (defId: string, col: number): Bot =>
  (sim) => {
    for (const lane of sim.state.openLanes) {
      const front = frontCol(sim, lane) ?? 8;
      const standing = unitsIn(sim, lane, defId).some((unit) => unit.col <= front);
      if (!standing) sim.placeUnit(defId, lane, Math.max(0, Math.min(col, front - 1)));
    }
  };

/** Runs several bots one after another on every tick. */
export const together =
  (...bots: Bot[]): Bot =>
  (sim, level) =>
    bots.forEach((bot) => bot(sim, level));

/** A slower player: only acts once every `seconds`. */
export const every =
  (seconds: number, bot: Bot): Bot =>
  (sim, level) => {
    if (sim.state.tick % secondsToTicks(seconds) === 0) bot(sim, level);
  };

export function play(levelId: string, bot: Bot, maxSeconds = 240) {
  const level = levels[levelId]!;
  const sim = createSim(level, content, 1);
  const limit = secondsToTicks(maxSeconds);
  while (sim.state.status === 'playing' && sim.state.tick < limit) {
    bot(sim, level);
    sim.step();
  }
  const reached = Math.min(level.grid.cols * 1000, ...sim.state.enemies.map((enemy) => enemy.pos));
  return { status: sim.state.status, seconds: sim.state.tick / 20, energy: sim.state.energy, reached };
}
