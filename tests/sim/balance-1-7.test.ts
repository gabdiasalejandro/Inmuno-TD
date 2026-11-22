import { describe, expect, it } from 'vitest';
import { content, levels } from '../../src/data';
import { createSim, secondsToTicks } from '../../src/sim';
import { frontCol, holdLanes, isFree, play, together, unitsIn, type Bot } from './bots';

const RESERVE = 50;
const macrophages = holdLanes('macrofago', 3);

/** Neutrophils meet the bacteria of a lane once they come within six cells, keeping a reserve. */
const neutrophils: Bot = (sim) => {
  for (const lane of sim.state.openLanes) {
    const front = frontCol(sim, lane);
    if (front === undefined || front > 6 || sim.state.energy < 50 + RESERVE) continue;
    const col = Math.max(4, front - 1);
    if (isFree(sim, lane, col)) sim.placeUnit('neutrofilo', lane, col);
  }
};

/** Cytokines only while inflammation is low. */
const carefulRelease: Bot = (sim) => sim.setReleasing(sim.signal('inflamacion') < 0.3);

/**
 * Once every lane holds a macrophage, a dendritic cell just in front of the macrophage of each lane
 * with bacteria: it does not block, so it waits where the bacteria die.
 */
const dendritics: Bot = (sim) => {
  if (sim.state.openLanes.some((lane) => unitsIn(sim, lane, 'macrofago').length === 0)) return;
  for (const lane of sim.state.openLanes) {
    if (frontCol(sim, lane) === undefined) continue;
    const guard = unitsIn(sim, lane, 'macrofago')[0];
    if (!guard || unitsIn(sim, lane, 'dendritica').length > 0) continue;
    const col = guard.col + 1;
    if (col >= 0 && isFree(sim, lane, col) && sim.state.energy >= 50) sim.placeUnit('dendritica', lane, col);
  }
};

const innate = together(macrophages, neutrophils, carefulRelease);

describe('level 1-7 balance', () => {
  it('is won by carrying antigen to the lymph node with dendritic cells, within the 3 to 5 minutes of a level', () => {
    const result = play('1-7', together(innate, dendritics), 300);
    expect(result.status).toBe('won');
    expect(result.seconds).toBeGreaterThan(90);
    expect(result.seconds).toBeLessThan(300);
  });

  it('is lost by the innate response alone: the pathogen keeps coming back and the inflammation turns chronic', () => {
    const sim = createSim(levels['1-7']!, content, 1);
    while (sim.state.status === 'playing' && sim.state.tick < secondsToTicks(900)) {
      innate(sim, levels['1-7']!);
      sim.step();
    }
    expect(sim.state.status).toBe('lost');
    expect(sim.state.defeat).toEqual({ type: 'signal', signal: 'inflamacion' });
    expect(sim.state.returns).toBeGreaterThanOrEqual(3);
  });

  it('is still won by a player who finds the dendritic cell late, after the pathogen has come back', () => {
    const late: Bot = (sim, level) => {
      if (sim.state.returns > 0) dendritics(sim, level);
    };
    const sim = createSim(levels['1-7']!, content, 1);
    while (sim.state.status === 'playing' && sim.state.tick < secondsToTicks(600)) {
      together(innate, late)(sim, levels['1-7']!);
      sim.step();
    }
    expect(sim.state.status).toBe('won');
    expect(sim.state.returns).toBeGreaterThanOrEqual(1);
  });

  it('is lost with no defence beyond dendritic cells', () => {
    const result = play('1-7', dendritics, 300);
    expect(result.status).toBe('lost');
  });

  it('brings the same pathogen back each time and asks for antigen, not a clear board', () => {
    const level = levels['1-7']!;
    expect(new Set(level.waves.map((wave) => wave.enemy))).toEqual(new Set(['streptococcus_pyogenes']));
    expect(level.win).toMatchObject({ type: 'antigen' });
    expect(level.returns).toBeDefined();
    expect(level.deck).toContain('dendritica');
  });
});
