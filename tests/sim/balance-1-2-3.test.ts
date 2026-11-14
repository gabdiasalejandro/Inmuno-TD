import { describe, expect, it } from 'vitest';
import { content, levels } from '../../src/data';
import { every, frontCol, holdLanes, isFree, play, together, unitsIn, type Bot } from './bots';

const unitCost = (id: string): number => content.units.find((unit) => unit.id === id)!.cost;
const NEUTROPHIL_COST = unitCost('neutrofilo');
/** Keep enough energy to replace a macrophage after buying a neutrophil. */
const NEUTROPHIL_RESERVE = unitCost('macrofago') + NEUTROPHIL_COST;

const walls = holdLanes('epitelio', 4);
const macrophages = holdLanes('macrofago', 3);

/** A macrophage per open lane, then a wall just ahead of it, then mucus ahead of the wall. */
const supported: Bot = (sim) => {
  const missing = sim.state.openLanes.filter((lane) => unitsIn(sim, lane, 'macrofago').length === 0);
  if (missing.length > 0) {
    if (sim.state.energy < NEUTROPHIL_RESERVE - NEUTROPHIL_COST) return;
    sim.placeUnit('macrofago', missing[0]!, 3);
    return;
  }
  for (const lane of sim.state.openLanes) {
    const front = frontCol(sim, lane) ?? 8;
    if (!unitsIn(sim, lane, 'epitelio').some((unit) => unit.col <= front)) {
      if (sim.state.energy >= 50 + NEUTROPHIL_RESERVE) sim.placeUnit('epitelio', lane, Math.max(0, Math.min(5, front - 1)));
      continue;
    }
    for (const col of [8, 7, 6]) {
      if (col <= front || !isFree(sim, lane, col)) continue;
      if (sim.state.energy >= 25 + NEUTROPHIL_RESERVE) sim.placeUnit('moco', lane, col);
      break;
    }
  }
};

/** Only ever defends the first lane that opened. */
const firstLaneOnly: Bot = (sim) => {
  const lane = sim.state.openLanes[0];
  if (lane !== undefined && unitsIn(sim, lane, 'macrofago').length === 0) sim.placeUnit('macrofago', lane, 3);
};

/** Defends the first two lanes that opened and ignores the rest. */
const firstTwoLanesOnly: Bot = (sim) => {
  for (const lane of sim.state.openLanes.slice(0, 2)) {
    if (unitsIn(sim, lane, 'macrofago').length === 0) sim.placeUnit('macrofago', lane, 3);
  }
};

/** Sends a neutrophil to meet the bacteria in every lane that has them, in front of the macrophage. */
const neutrophils: Bot = (sim) => {
  for (const lane of sim.state.openLanes) {
    const front = frontCol(sim, lane);
    if (front === undefined || sim.state.energy < NEUTROPHIL_RESERVE) continue;
    const col = Math.max(4, Math.min(7, front - 1));
    if (isFree(sim, lane, col)) sim.placeUnit('neutrofilo', lane, col);
  }
};

describe('level 1-2 balance', () => {
  it('cannot be won with barriers alone', () => {
    expect(play('1-2', walls).status).not.toBe('won');
  });

  it('is lost when a wounded lane is ignored, even if the other two are held', () => {
    expect(play('1-2', firstTwoLanesOnly).status).toBe('lost');
    expect(play('1-2', firstLaneOnly).status).toBe('lost');
  });

  it('is lost with one macrophage per lane and no barriers', () => {
    expect(play('1-2', macrophages).status).toBe('lost');
    expect(play('1-2', every(3, macrophages)).status).toBe('lost');
  });

  it('is won with a macrophage per lane supported by a wall and mucus, even by a slow player', () => {
    expect(play('1-2', supported).status).toBe('won');
    expect(play('1-2', every(3, supported)).status).toBe('won');
  });
});

describe('level 1-3 balance', () => {
  const both = together(macrophages, neutrophils);

  it('is lost with macrophages alone: they are overwhelmed', () => {
    expect(play('1-3', macrophages).status).toBe('lost');
  });

  it('is lost with neutrophils alone: nobody raises the alarm', () => {
    expect(play('1-3', neutrophils).status).toBe('lost');
  });

  it('is won when macrophages raise the alarm and neutrophils answer, even by a slow player', () => {
    expect(play('1-3', both).status).toBe('won');
    expect(play('1-3', every(2, both)).status).toBe('won');
  });
});

describe('level data', () => {
  it('prices the neutrophil at 50', () => {
    expect(NEUTROPHIL_COST).toBe(50);
  });

  it('opens three lanes in 1-2 and all five in 1-3', () => {
    expect(levels['1-2']!.wounds).toHaveLength(3);
    expect(levels['1-3']!.wounds).toHaveLength(5);
    expect(new Set(levels['1-3']!.wounds!.map((wound) => wound.lane))).toEqual(new Set([0, 1, 2, 3, 4]));
  });

  it('sends bacteria down every opened lane in 1-3', () => {
    const lanes = new Set(levels['1-3']!.waves.map((wave) => wave.lane));
    expect(lanes).toEqual(new Set([0, 1, 2, 3, 4]));
  });
});
