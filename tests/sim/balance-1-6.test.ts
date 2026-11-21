import { describe, expect, it } from 'vitest';
import { content, levels } from '../../src/data';
import { createSim, secondsToTicks, type Sim } from '../../src/sim';
import { engagedCol } from '../../src/sim/world';
import { frontCol, holdLanes, holdRelease, isFree, together, unitsIn, type Bot } from './bots';

const macrophages = holdLanes('macrofago', 3);
const RESERVE = 100;

/** An epithelium in front of every guarded lane while a macrophage replacement stays affordable. */
const walls: Bot = (sim) => {
  for (const lane of sim.state.openLanes) {
    const guarded = unitsIn(sim, lane, 'macrofago').length > 0;
    if (guarded && unitsIn(sim, lane, 'epitelio').length === 0 && isFree(sim, lane, 5) && sim.state.energy >= 50 + RESERVE) {
      sim.placeUnit('epitelio', lane, 5);
    }
  }
};

/** Neutrophils meet the enemies of a lane once they come within six cells, keeping the reserve. */
const neutrophils: Bot = (sim) => {
  for (const lane of sim.state.openLanes) {
    const front = frontCol(sim, lane);
    if (front === undefined || front > 6 || sim.state.energy < 50 + RESERVE) continue;
    const col = Math.max(3, front - 1);
    if (isFree(sim, lane, col)) sim.placeUnit('neutrofilo', lane, col);
  }
};

/** Plays the complement power whenever it is ready and capsulated bacteria reach the middle of the board. */
const complement: Bot = (sim) => {
  const target = sim.state.enemies.find((e) => e.defId === 'bacteria_capsulada' && engagedCol(e.pos) <= 6);
  if (target) sim.playPower('complemento', target.lane, engagedCol(target.pos));
};

function play(bot: Bot, seconds = 240) {
  const level = levels['1-6']!;
  const sim: Sim = createSim(level, content, 1);
  const limit = secondsToTicks(seconds);
  while (sim.state.status === 'playing' && sim.state.tick < limit) {
    bot(sim, level);
    sim.step();
  }
  return { status: sim.state.status, seconds: sim.state.tick / 20, defeat: sim.state.defeat };
}

describe('level 1-6 balance', () => {
  it('is won by macrophages, walls, neutrophils and the complement power against the capsulated waves', () => {
    const result = play(together(macrophages, walls, neutrophils, holdRelease, complement));
    expect(result.status).toBe('won');
  });

  it('is lost without the complement power: capsulated bacteria go unseen by phagocytes', () => {
    const result = play(together(macrophages, walls, neutrophils, holdRelease));
    expect(result).toMatchObject({ status: 'lost', defeat: { type: 'breach' } });
  });

  it('is lost with no defence beyond macrophages', () => {
    const result = play(together(macrophages, holdRelease));
    expect(result.status).toBe('lost');
  });

  it('offers the complement as a power, not as a deck card', () => {
    const level = levels['1-6']!;
    expect(level.powers).toEqual(['complemento']);
    expect(level.deck).not.toContain('complemento');
  });
});
