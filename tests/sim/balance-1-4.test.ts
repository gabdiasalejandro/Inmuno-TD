import { describe, expect, it } from 'vitest';
import { content, levels } from '../../src/data';
import { createSim, secondsToTicks, type Content, type LevelDef } from '../../src/sim';
import { every, frontCol, holdLanes, holdRelease, isFree, together, unitsIn, type Bot } from './bots';

const unitCost = (id: string): number => content.units.find((unit) => unit.id === id)!.cost;
/** Keep enough energy to replace a macrophage after buying a neutrophil. */
const NEUTROPHIL_RESERVE = unitCost('macrofago') + unitCost('neutrofilo');

const macrophages = holdLanes('macrofago', 3);

/** Sends a neutrophil to meet the bacteria in every lane that has them, in front of the macrophage. */
const neutrophils: Bot = (sim) => {
  for (const lane of sim.state.openLanes) {
    const front = frontCol(sim, lane);
    if (front === undefined || sim.state.energy < NEUTROPHIL_RESERVE) continue;
    const col = Math.max(4, Math.min(7, front - 1));
    if (isFree(sim, lane, col)) sim.placeUnit('neutrofilo', lane, col);
  }
};

/** An epithelium right in front of every lane's macrophage, once there is energy to spare. */
const wallLine: Bot = (sim) => {
  for (const lane of sim.state.openLanes) {
    const guarded = unitsIn(sim, lane, 'macrofago').length > 0;
    if (guarded && unitsIn(sim, lane, 'epitelio').length === 0 && sim.state.energy >= NEUTROPHIL_RESERVE && isFree(sim, lane, 4)) {
      sim.placeUnit('epitelio', lane, 4);
    }
  }
};

/**
 * Releases with moderation: holds the button while the cytokine meter is below half and stops
 * before the inflammation reaches the band where it starts to damage the tissue.
 */
const moderate: Bot = (sim) => sim.setReleasing(sim.signal('citocinas') < 0.5 && sim.signal('inflamacion') < 0.35);

const both = together(macrophages, neutrophils);

/** A slower player: places cells only every two seconds, but still watches the bars. */
const slow = (bot: Bot): Bot => together(every(2, bot), moderate);

function play(level: LevelDef, bot: Bot, rules: Content = content) {
  const sim = createSim(level, rules, 1);
  let peak = 0;
  let switches = 0;
  while (sim.state.status === 'playing' && sim.state.tick < secondsToTicks(300)) {
    bot(sim, level);
    switches += sim.step().filter((event) => event.type === 'enemy_switched_lane').length;
    peak = Math.max(peak, sim.signal('inflamacion'));
  }
  return { status: sim.state.status, defeat: sim.state.defeat, seconds: sim.state.tick / 20, peak, switches };
}

const level = levels['1-4']!;

describe('level 1-4 balance', () => {
  it('is won releasing cytokines with moderation, with or without a wall line, also by a slow player', () => {
    for (const bot of [together(both, moderate), together(macrophages, wallLine, neutrophils, moderate), slow(both), slow(together(macrophages, wallLine, neutrophils))]) {
      const result = play(level, bot);
      expect(result.status).toBe('won');
      // Moderation keeps the inflammation out of the band where it damages the tissue.
      expect(result.peak).toBeLessThan(0.4);
      // Three to four minutes.
      expect(result.seconds).toBeGreaterThan(170);
      expect(result.seconds).toBeLessThan(240);
    }
  });

  it('is lost by the same cells when the player never releases the cytokines', () => {
    for (const bot of [both, together(macrophages, wallLine, neutrophils)]) {
      const result = play(level, bot);
      expect(result.status).toBe('lost');
      expect(result.defeat).toEqual({ type: 'breach' });
    }
  });

  it('is lost to the inflammation itself when the player releases nonstop', () => {
    for (const bot of [together(both, holdRelease), together(macrophages, wallLine, neutrophils, holdRelease)]) {
      const result = play(level, bot);
      expect(result.status).toBe('lost');
      expect(result.defeat).toEqual({ type: 'signal', signal: 'inflamacion' });
    }
  });

  it('has S. pyogenes switching lanes when it meets a wall', () => {
    expect(play(level, together(macrophages, wallLine, neutrophils, moderate)).switches).toBeGreaterThan(0);
  });
});

describe('S. pyogenes against epithelium (real content, one-lane scenario)', () => {
  /** Three lanes, one bacterium in the middle one, a macrophage behind an epithelium there. */
  const scenario = (enemy: string): LevelDef => ({
    id: 'scenario',
    grid: { rows: 3, cols: 9 },
    startEnergy: 1000,
    marrow: { amount: 0, interval: 5 },
    deck: ['epitelio', 'macrofago'],
    signals: [],
    waves: [{ at: 0, enemy, lane: 1, count: 3, gap: 3 }],
  });
  const loneWall: Bot = (sim) => {
    if (sim.state.tick !== 0) return;
    sim.placeUnit('macrofago', 1, 3);
    sim.placeUnit('epitelio', 1, 6);
  };
  const wallRow: Bot = (sim) => {
    if (sim.state.tick !== 0) return;
    loneWall(sim, scenario(''));
    sim.placeUnit('epitelio', 0, 6);
    sim.placeUnit('epitelio', 2, 6);
  };

  it('a lone wall stops gram-positive bacteria in its lane', () => {
    const result = play(scenario('bacteria_gram_pos'), loneWall);
    expect(result.switches).toBe(0);
    expect(result.status).toBe('won');
  });

  it('S. pyogenes goes around a lone wall into the undefended neighbour lane and breaks through', () => {
    const result = play(scenario('streptococcus_pyogenes'), loneWall);
    expect(result.switches).toBeGreaterThan(0);
    expect(result.status).toBe('lost');
  });

  it('a row of walls leaves it nowhere to go: it has to attack the wall like any bacterium', () => {
    // Setting the whole row at once needs the epithelium's redeploy cooldown out of the way.
    const instant = { ...content, units: content.units.map((unit) => ({ ...unit, cooldown: 0 })) };
    const result = play(scenario('streptococcus_pyogenes'), wallRow, instant);
    expect(result.switches).toBe(0);
  });
});
