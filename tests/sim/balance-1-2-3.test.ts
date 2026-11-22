import { describe, expect, it } from 'vitest';
import { content, resolveLevel, tutorials, type Difficulty } from '../../src/data';
import { countEnemies, createTutorial } from '../../src/game/tutorial';
import { createRng, createSim, secondsToTicks } from '../../src/sim';
import { every, frontCol, holdLanes, holdRelease, isFree, play, pulseRelease, together, unitsIn, type Bot } from './bots';

const unitCost = (id: string): number => content.units.find((unit) => unit.id === id)!.cost;
const NEUTROPHIL_COST = unitCost('neutrofilo');
/** Keep enough energy to replace a macrophage after buying a neutrophil. */
const NEUTROPHIL_RESERVE = unitCost('macrofago') + NEUTROPHIL_COST;

const walls = holdLanes('epitelio', 4);
const macrophages = holdLanes('macrofago', 3);

/**
 * The owner's strategy, confirmed in play: macrophages held back at column 6, mucus just ahead
 * to slow the bacteria down, and an occasional wall to protect a macrophage.
 */
const heldBack: Bot = (sim) => {
  const MACRO_COL = 6;
  for (const lane of sim.state.openLanes) {
    const front = frontCol(sim, lane) ?? 8;
    if (unitsIn(sim, lane, 'macrofago').length === 0) {
      if (sim.state.energy >= 100) sim.placeUnit('macrofago', lane, MACRO_COL);
      continue;
    }
    if (!unitsIn(sim, lane, 'epitelio').some((unit) => unit.col <= front)) {
      if (sim.state.energy >= 50) sim.placeUnit('epitelio', lane, Math.max(0, Math.min(MACRO_COL + 2, front - 1)));
      continue;
    }
    if (MACRO_COL + 1 > front && isFree(sim, lane, MACRO_COL + 1) && sim.state.energy >= 25) {
      sim.placeUnit('moco', lane, MACRO_COL + 1);
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

  it('is won with macrophages held back, mucus ahead and the occasional wall, even by a slow player', () => {
    expect(play('1-2', heldBack).status).toBe('won');
    expect(play('1-2', every(3, heldBack)).status).toBe('won');
  });
});

describe('level 1-3 balance', () => {
  const both = together(macrophages, neutrophils);

  it('is lost with macrophages alone, even holding the release all along: they are overwhelmed', () => {
    expect(play('1-3', macrophages).status).toBe('lost');
    expect(play('1-3', together(macrophages, holdRelease)).status).toBe('lost');
  });

  it('is lost with neutrophils alone, even releasing what the wounds charge: wounds hold too little', () => {
    expect(play('1-3', neutrophils).status).toBe('lost');
    expect(play('1-3', together(neutrophils, holdRelease)).status).toBe('lost');
  });

  it('is won when macrophages detect, the player holds the release and neutrophils answer, even by a slow or sloppy player', () => {
    expect(play('1-3', together(both, holdRelease)).status).toBe('won');
    expect(play('1-3', every(2, together(both, holdRelease))).status).toBe('won');
    expect(play('1-3', together(both, pulseRelease(2, 6))).status).toBe('won');
  });

  it('is lost by the same macrophages and neutrophils when the player never releases the cytokines', () => {
    expect(play('1-3', both).status).toBe('lost');
    expect(play('1-3', every(2, both)).status).toBe('lost');
  });
});

describe('level data', () => {
  it('prices the neutrophil at 50', () => {
    expect(NEUTROPHIL_COST).toBe(50);
  });

  it('opens three lanes in 1-2 and all five in 1-3', () => {
    expect(resolveLevel('1-2', 'normal')!.wounds).toHaveLength(3);
    expect(resolveLevel('1-3', 'normal')!.wounds).toHaveLength(5);
    expect(new Set(resolveLevel('1-3', 'normal')!.wounds!.map((wound) => wound.lane))).toEqual(new Set([0, 1, 2, 3, 4]));
  });

  it('sends bacteria down every opened lane in 1-3', () => {
    const lanes = new Set(resolveLevel('1-3', 'normal')!.waves.map((wave) => wave.lane));
    expect(lanes).toEqual(new Set([0, 1, 2, 3, 4]));
  });
});

const SEEDS = [1, 2, 3, 4, 5];

/** Plays a level on a difficulty with a bot built for that seed; the sim gets the same seed. */
function playOn(levelId: string, difficulty: Difficulty, makeBot: (seed: number) => Bot, seed: number, maxSeconds = 240) {
  const level = resolveLevel(levelId, difficulty)!;
  const sim = createSim(level, content, seed);
  const bot = makeBot(seed);
  while (sim.state.status === 'playing' && sim.state.tick < secondsToTicks(maxSeconds)) {
    bot(sim, level);
    sim.step();
  }
  return { status: sim.state.status, seconds: sim.state.tick / 20 };
}

interface CasualStyle {
  /** Seconds between two looks at the board. */
  period: number;
  /** Column the player drops a macrophage at, or just behind the bacteria if they got past. */
  macroCol: number;
  /** Energy the player waits to have before spending on anything but a macrophage. */
  spare: number;
  barriers: boolean;
  neutrophils: boolean;
  /** Seconds held out of every period on the release button, if the player releases at all. */
  release?: [held: number, period: number];
}

/**
 * A casual player who knows the right concept but plays it loosely: looks at the board only every
 * few seconds, notices each newly opened lane 4 to 10 s late (drawn from the seed), puts the
 * macrophage too far forward, hoards energy before buying barriers or neutrophils, and only taps
 * the release now and then.
 */
const casual =
  (style: CasualStyle) =>
  (seed: number): Bot => {
    const rng = createRng(seed * 7919);
    const noticeAt = new Map<number, number>();
    const release = style.release ? pulseRelease(...style.release) : undefined;
    return (sim, level) => {
      release?.(sim, level);
      if (sim.state.tick % secondsToTicks(style.period) !== 0) return;
      const now = sim.state.tick / 20;
      for (const lane of sim.state.openLanes) {
        if (!noticeAt.has(lane)) noticeAt.set(lane, now + 4 + rng.next() * 6);
        if (now < noticeAt.get(lane)!) continue;
        const front = frontCol(sim, lane) ?? 8;
        if (unitsIn(sim, lane, 'macrofago').length === 0) {
          if (sim.state.energy >= 100) sim.placeUnit('macrofago', lane, Math.max(0, Math.min(style.macroCol, front - 1)));
          continue;
        }
        if (sim.state.energy < style.spare) continue;
        if (style.neutrophils && front < 8) {
          const col = Math.max(4, Math.min(7, front - 1));
          if (isFree(sim, lane, col)) sim.placeUnit('neutrofilo', lane, col);
          continue;
        }
        if (style.barriers && !unitsIn(sim, lane, 'epitelio').some((unit) => unit.col <= front)) {
          sim.placeUnit('epitelio', lane, Math.max(0, Math.min(style.macroCol + 2, front - 1)));
          continue;
        }
        if (style.barriers && style.macroCol + 1 > front && isFree(sim, lane, style.macroCol + 1)) sim.placeUnit('moco', lane, style.macroCol + 1);
      }
    };
  };

const casual12: CasualStyle = { period: 4, macroCol: 4, spare: 200, barriers: true, neutrophils: false };
const casual13: CasualStyle = { period: 3, macroCol: 3, spare: 200, barriers: false, neutrophils: true, release: [2, 10] };

describe('normal difficulty, 1-2 and 1-3', () => {
  it.each(SEEDS)('a casual player with macrophages and barriers wins 1-2 on normal and loses it on sepsis (seed %i)', (seed) => {
    expect(playOn('1-2', 'normal', casual(casual12), seed).status).toBe('won');
    expect(playOn('1-2', 'sepsis', casual(casual12), seed).status).toBe('lost');
  });

  it.each(SEEDS)('the same casual player still loses 1-2 on normal without barriers (seed %i)', (seed) => {
    expect(playOn('1-2', 'normal', casual({ ...casual12, barriers: false }), seed).status).toBe('lost');
  });

  it.each(SEEDS)('a casual player who releases now and then wins 1-3 on normal and loses it on sepsis (seed %i)', (seed) => {
    expect(playOn('1-3', 'normal', casual(casual13), seed).status).toBe('won');
    expect(playOn('1-3', 'sepsis', casual(casual13), seed).status).toBe('lost');
  });

  it.each(SEEDS)('the same casual player still loses 1-3 on normal if they never release the cytokines (seed %i)', (seed) => {
    expect(playOn('1-3', 'normal', casual({ ...casual13, release: undefined }), seed).status).toBe('lost');
  });

  it('keeps the tutorial of 1-3 followable to the end on normal', () => {
    const level = resolveLevel('1-3', 'normal')!;
    const steps = tutorials['1-3']!.steps;
    const sim = createSim(level, content, 1);
    const tutorial = createTutorial(steps);
    const seen = new Set<string>();
    let heldTicks = 0;
    let slowCarry = 0;
    while (!tutorial.finished && sim.state.status === 'playing' && sim.state.tick < secondsToTicks(90)) {
      tutorial.observe({ stored: level.signals?.reduce((sum, name) => sum + sim.stored(name), 0) ?? 0, seen, enemies: countEnemies(sim.state.enemies.map((enemy) => enemy.defId)) });
      const step = tutorial.step;
      let holding = false;
      if (step && tutorial.active) {
        const { advance } = step;
        if (advance.type === 'place' && sim.placeUnit(advance.unit, advance.row ?? 0, advance.col ?? 0).ok) {
          tutorial.perform({ type: 'place', unit: advance.unit, row: advance.row ?? 0, col: advance.col ?? 0 });
        } else if (advance.type === 'hold') {
          holding = true;
          tutorial.perform({ type: 'hold', seconds: heldTicks / secondsToTicks(1) });
        } else if (advance.type === 'tap') {
          tutorial.perform({ type: 'tap' });
        }
      }
      sim.setReleasing(holding);
      heldTicks = holding ? heldTicks + 1 : 0;
      // As in the game: a paused step freezes the clock, a fast one runs several ticks per frame, a slow one fewer.
      const tick = () => sim.step().forEach((event) => seen.add(event.type));
      for (let i = 0; i < Math.floor(tutorial.timeScale) && sim.state.status === 'playing'; i++) tick();
      if (tutorial.timeScale > 0 && tutorial.timeScale < 1) {
        slowCarry += tutorial.timeScale;
        if (slowCarry >= 1) {
          slowCarry -= 1;
          tick();
        }
      }
    }
    expect(tutorial.index).toBe(steps.length);
    expect(sim.state.status).toBe('playing');
    expect(sim.state.released.citocinas).toBeGreaterThan(0);
  });

  it('makes normal easier only through the waves: same economy, lanes and deck as sepsis, fewer bacteria', () => {
    for (const id of ['1-2', '1-3']) {
      const normal = resolveLevel(id, 'normal')!;
      const sepsis = resolveLevel(id, 'sepsis')!;
      expect({ ...normal, waves: [] }).toEqual({ ...sepsis, waves: [] });
      const total = (level: typeof normal) => level.waves.reduce((sum, wave) => sum + wave.count, 0);
      expect(total(normal)).toBeLessThan(total(sepsis));
    }
  });
});
