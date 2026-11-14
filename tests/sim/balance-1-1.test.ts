import { describe, expect, it } from 'vitest';
import { content, levels } from '../../src/data';
import { createSim, secondsToTicks, type Sim } from '../../src/sim';

const LANE = 2;
const level = levels['1-1']!;

type Bot = (sim: Sim) => void;

const frontCol = (sim: Sim): number | undefined => {
  const lane = sim.state.enemies.filter((enemy) => enemy.lane === LANE);
  return lane.length ? Math.ceil(Math.min(...lane.map((enemy) => enemy.pos)) / 1000) - 1 : undefined;
};

const hasWallAhead = (sim: Sim, front: number): boolean =>
  sim.state.units.some((unit) => unit.defId === 'epitelio' && unit.row === LANE && unit.col <= front);

/** Does nothing. */
const idle: Bot = () => {};

/** Places a single wall and never reacts again. */
const oneWall: Bot = (sim) => {
  if (sim.state.tick === 0) sim.placeUnit('epitelio', LANE, 4);
};

/** Keeps one wall standing between the bacteria and the base, rebuilding it further back when it falls. */
const rebuildWalls: Bot = (sim) => {
  const front = frontCol(sim) ?? 7;
  if (!hasWallAhead(sim, front)) sim.placeUnit('epitelio', LANE, Math.max(0, front - 1));
};

/** Same as rebuildWalls, plus mucus on the two cells the bacteria must cross to reach the wall. */
const wallsAndMucus: Bot = (sim) => {
  rebuildWalls(sim);
  const wall = sim.state.units
    .filter((unit) => unit.defId === 'epitelio' && unit.row === LANE)
    .sort((a, b) => b.col - a.col)[0];
  if (!wall || sim.state.energy < 75) return;
  for (const col of [wall.col + 1, wall.col + 2]) {
    if (col < level.grid.cols) sim.placeUnit('moco', LANE, col);
  }
};

function play(bot: Bot) {
  const sim = createSim(level, content, 1);
  const limit = secondsToTicks(200);
  while (sim.state.status === 'playing' && sim.state.tick < limit) {
    bot(sim);
    sim.step();
  }
  const reached = Math.min(level.grid.cols * 1000, ...sim.state.enemies.map((enemy) => enemy.pos));
  return { status: sim.state.status, seconds: sim.state.tick / 20, energy: sim.state.energy, reached };
}

/** A distracted player: one wall up front, and a new one only 5 seconds after the last one fell. */
const lateWalls = (): Bot => {
  let brokenSince: number | undefined;
  return (sim) => {
    const front = frontCol(sim) ?? 7;
    if (hasWallAhead(sim, front)) return void (brokenSince = undefined);
    brokenSince ??= sim.state.tick;
    const reacted = sim.state.tick === 0 || sim.state.tick - brokenSince >= secondsToTicks(5);
    if (reacted) sim.placeUnit('epitelio', LANE, Math.max(0, Math.min(4, front - 1)));
  };
};

describe('level 1-1 balance', () => {
  it('only uses the wounded lane', () => {
    expect(level.waves.every((wave) => wave.lane === LANE)).toBe(true);
    expect(level.wounds).toEqual([{ at: 3, lane: LANE }]);
  });

  it('is lost without placing anything', () => {
    expect(play(idle).status).toBe('lost');
  });

  it('is lost with a single wall that is never rebuilt', () => {
    expect(play(oneWall).status).toBe('lost');
  });

  it('is won by rebuilding walls as they fall', () => {
    expect(play(rebuildWalls).status).toBe('won');
  });

  it('is won even by a distracted player who rebuilds late', () => {
    expect(play(lateWalls()).status).toBe('won');
  });

  it('mucus keeps the bacteria further from the base than walls alone', () => {
    const walls = play(rebuildWalls);
    const both = play(wallsAndMucus);
    expect(both.status).toBe('won');
    expect(both.reached).toBeGreaterThan(walls.reached);
  });
});
