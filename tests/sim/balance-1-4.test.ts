import { describe, expect, it } from 'vitest';
import { content, resolveLevel, tutorials } from '../../src/data';
import { countEnemies, createTutorial } from '../../src/game/tutorial';
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

/** Keep enough energy to replace a macrophage after buying an epithelium. */
const WALL_RESERVE = unitCost('macrofago');

/**
 * An epithelium right in front of every lane's macrophage, as soon as a macrophage replacement
 * stays affordable: a complete line leaves S. pyogenes no free neighbour lane to slip into.
 */
const wallLine: Bot = (sim) => {
  for (const lane of sim.state.openLanes) {
    const guarded = unitsIn(sim, lane, 'macrofago').length > 0;
    if (guarded && unitsIn(sim, lane, 'epitelio').length === 0 && sim.state.energy >= WALL_RESERVE && isFree(sim, lane, 4)) {
      sim.placeUnit('epitelio', lane, 4);
    }
  }
};

/**
 * Releases with moderation: holds the button while the cytokine meter is below half and stops
 * before the inflammation reaches the band where it starts to damage the tissue.
 */
const moderate: Bot = (sim) => sim.setReleasing(sim.signal('citocinas') < 0.5 && sim.signal('inflamacion') < 0.55);

/**
 * Releases freely: holds the button while the cytokine meter is below 80 %, letting the
 * inflammation into the damaging band and stopping only well before the doubled damage.
 */
const free: Bot = (sim) => sim.setReleasing(sim.signal('citocinas') < 0.8 && sim.signal('inflamacion') < 0.7);

const both = together(macrophages, neutrophils);

/** A slower player: places cells only every two seconds, but still watches the bars. */
const slow = (bot: Bot): Bot => together(every(2, bot), moderate);

function play(level: LevelDef, bot: Bot, rules: Content = content, seed = 1) {
  const sim = createSim(level, rules, seed);
  let peak = 0;
  let switches = 0;
  /** Lane switches made by each enemy, by uid. */
  const perEnemy = new Map<number, number>();
  while (sim.state.status === 'playing' && sim.state.tick < secondsToTicks(300)) {
    bot(sim, level);
    for (const event of sim.step()) {
      if (event.type !== 'enemy_switched_lane') continue;
      switches++;
      perEnemy.set(event.uid, (perEnemy.get(event.uid) ?? 0) + 1);
    }
    peak = Math.max(peak, sim.signal('inflamacion'));
  }
  const mostByOne = Math.max(0, ...perEnemy.values());
  return { status: sim.state.status, defeat: sim.state.defeat, seconds: sim.state.tick / 20, peak, switches, mostByOne };
}

const level = resolveLevel('1-4', 'normal')!;
const walls = together(macrophages, wallLine, neutrophils);

describe('level 1-4 balance', () => {
  it('is won releasing cytokines with moderation behind a wall line, also by a slow player', () => {
    for (const bot of [together(walls, moderate), slow(walls)]) {
      const result = play(level, bot);
      expect(result.status).toBe('won');
      // Moderation keeps the inflammation out of the band where it damages the tissue.
      expect(result.peak).toBeLessThan(0.6);
      // Three to four minutes.
      expect(result.seconds).toBeGreaterThan(170);
      expect(result.seconds).toBeLessThan(240);
    }
  });

  it('needs the wall line: the same moderate players without walls lose to the S. pyogenes groups', () => {
    for (const bot of [together(both, moderate), slow(both)]) {
      const result = play(level, bot);
      expect(result.status).toBe('lost');
      expect(result.defeat).toEqual({ type: 'breach' });
    }
  });

  it('is won releasing freely into the damaging band behind a wall line, also by a slow player', () => {
    for (const bot of [together(walls, free), together(every(2, walls), free)]) {
      const result = play(level, bot);
      expect(result.status).toBe('won');
      // The inflammation enters the collateral damage band but stays below the doubled damage.
      expect(result.peak).toBeGreaterThan(0.6);
      expect(result.peak).toBeLessThan(0.9);
      expect(result.seconds).toBeLessThan(240);
    }
  });

  it('is lost by the same cells when the player never releases the cytokines', () => {
    for (const bot of [both, walls]) {
      const result = play(level, bot);
      expect(result.status).toBe('lost');
      expect(result.defeat).toEqual({ type: 'breach' });
    }
  });

  it('is lost to the inflammation itself when the player releases nonstop', () => {
    for (const bot of [together(both, holdRelease), together(walls, holdRelease)]) {
      const result = play(level, bot);
      expect(result.status).toBe('lost');
      expect(result.defeat).toEqual({ type: 'signal', signal: 'inflamacion' });
      // Late enough to have shown the benefit before the tissue gives way.
      expect(result.seconds).toBeGreaterThan(140);
    }
  });

  it('has S. pyogenes switching lanes when it meets a wall, each one at most once', () => {
    const result = play(level, together(walls, moderate));
    expect(result.switches).toBeGreaterThan(0);
    expect(result.mostByOne).toBe(1);
  });

  it('sends S. pyogenes in tight groups of 3 or 4', () => {
    const groups = level.waves.filter((wave) => wave.enemy === 'streptococcus_pyogenes');
    expect(groups.length).toBeGreaterThan(0);
    for (const wave of groups) {
      expect(wave.count).toBeGreaterThanOrEqual(3);
      expect(wave.count).toBeLessThanOrEqual(4);
      expect(wave.gap).toBeLessThanOrEqual(1);
    }
  });
});

/**
 * A casual player who gets the concept but plays it sloppily: looks at the board only every four
 * seconds (when exactly depends on the seed), keeps one macrophage per lane and never buys
 * neutrophils, starts the wall line only once an S. pyogenes has shown up, and releases the
 * cytokines in clumsy bursts (five seconds out of every fifteen), letting go early only when the
 * inflammation bar turns red.
 */
function casual(seed: number): Bot {
  let sawPyogenes = false;
  const walled: Bot = (sim, lvl) => {
    sawPyogenes ||= sim.state.enemies.some((enemy) => enemy.defId === 'streptococcus_pyogenes');
    if (sawPyogenes) wallLine(sim, lvl);
  };
  const phase = seed % 4;
  const cells: Bot = (sim, lvl) => {
    if ((sim.state.tick + secondsToTicks(phase)) % secondsToTicks(4) === 0) together(macrophages, walled)(sim, lvl);
  };
  const bursts: Bot = (sim) =>
    sim.setReleasing(sim.state.tick % secondsToTicks(15) < secondsToTicks(5) && sim.signal('inflamacion') < 0.75);
  return together(cells, bursts);
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

describe('level 1-4 difficulty', () => {
  const sepsis = resolveLevel('1-4', 'sepsis')!;

  it('normal is easier than sepsis: a casual player who walls late and releases in bursts wins on every seed', () => {
    for (const seed of SEEDS) {
      const result = play(level, casual(seed), content, seed);
      expect(result.status, `seed ${seed}`).toBe('won');
      expect(result.seconds).toBeLessThan(240);
    }
  });

  it('sepsis is not: the same casual player loses on almost every seed', () => {
    const lost = SEEDS.filter((seed) => play(sepsis, casual(seed), content, seed).status === 'lost');
    expect(lost.length).toBeGreaterThanOrEqual(SEEDS.length - 1);
  });

  it('normal keeps the S. pyogenes groups and every lane of the final rush', () => {
    const pyogenes = (lvl: LevelDef) => lvl.waves.filter((wave) => wave.enemy === 'streptococcus_pyogenes').map((wave) => wave.lane);
    expect(pyogenes(level)).toEqual(pyogenes(sepsis));
    // The final rush: every wave in the last 26 seconds of spawns.
    const finalLanes = (lvl: LevelDef) => {
      const last = Math.max(...lvl.waves.map((wave) => wave.at));
      return lvl.waves.filter((wave) => wave.at >= last - 26).map((wave) => wave.lane).sort();
    };
    expect(finalLanes(level)).toEqual(finalLanes(sepsis));
  });

  it('the tutorial can be followed to the end on normal', () => {
    // The player of tests/data/tutorials.test.ts (a macrophage per open lane, walls with gaps, moderate
    // release), who only buys a wall while a macrophage replacement stays affordable.
    const sim = createSim(level, content, 1);
    const tutorial = createTutorial(tutorials['1-4']!.steps);
    const seen = new Set<string>();
    const shown: number[] = [];
    while (!tutorial.finished && sim.state.status === 'playing' && sim.state.tick < secondsToTicks(240)) {
      tutorial.observe({ stored: 0, signals: { inflamacion: sim.signal('inflamacion') }, seen, enemies: countEnemies(sim.state.enemies.map((enemy) => enemy.defId)) });
      if (tutorial.active) {
        shown.push(tutorial.index);
        tutorial.perform({ type: 'tap' });
        continue;
      }
      for (const lane of sim.state.openLanes) {
        if (!sim.state.units.some((unit) => unit.row === lane && unit.defId === 'macrofago')) sim.placeUnit('macrofago', lane, 3);
        else if (lane % 2 === 0 && sim.state.energy >= WALL_RESERVE + unitCost('epitelio')) sim.placeUnit('epitelio', lane, 6);
      }
      sim.setReleasing(sim.signal('citocinas') < 0.5 && sim.signal('inflamacion') < 0.35);
      for (const event of sim.step()) seen.add(event.type);
    }
    expect(tutorial.finished).toBe(true);
    expect(shown).toEqual([0, 1, 2]);
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

  it('after its one switch it attacks the next wall like any bacterium', () => {
    // Lane 0 walled further on: the bacterium switches 1 -> 0 at column 6, then meets column 4.
    const instant = { ...content, units: content.units.map((unit) => ({ ...unit, cooldown: 0 })) };
    const level: LevelDef = { ...scenario('streptococcus_pyogenes'), waves: [{ at: 0, enemy: 'streptococcus_pyogenes', lane: 1, count: 1, gap: 0 }] };
    const bot: Bot = (sim) => {
      if (sim.state.tick !== 0) return;
      sim.placeUnit('epitelio', 1, 6);
      sim.placeUnit('epitelio', 2, 6);
      sim.placeUnit('epitelio', 0, 4);
      sim.placeUnit('macrofago', 0, 3);
    };
    const result = play(level, bot, instant);
    expect(result.switches).toBe(1);
    expect(result.status).toBe('won');
  });

  it('a row of walls leaves it nowhere to go: it has to attack the wall like any bacterium', () => {
    // Setting the whole row at once needs the epithelium's redeploy cooldown out of the way.
    const instant = { ...content, units: content.units.map((unit) => ({ ...unit, cooldown: 0 })) };
    const result = play(scenario('streptococcus_pyogenes'), wallRow, instant);
    expect(result.switches).toBe(0);
  });
});
