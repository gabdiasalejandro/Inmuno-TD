import { describe, expect, it } from 'vitest';
import { content, resolveLevel, tutorials } from '../../src/data';
import { countEnemies, createTutorial } from '../../src/game/tutorial';
import { createSim, secondsToTicks, type Content, type LevelDef, type Sim } from '../../src/sim';
import { every, frontCol, holdLanes, isFree, pulseRelease, together, unitsIn, type Bot } from './bots';

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

/** An epithelium in front of every lane's macrophage while a macrophage replacement stays affordable. */
const wallLine: Bot = (sim) => {
  for (const lane of sim.state.openLanes) {
    const guarded = unitsIn(sim, lane, 'macrofago').length > 0;
    if (guarded && unitsIn(sim, lane, 'epitelio').length === 0 && sim.state.energy >= unitCost('macrofago') && isFree(sim, lane, 4)) {
      sim.placeUnit('epitelio', lane, 4);
    }
  }
};

const infected = (sim: Sim) => sim.state.units.filter((unit) => (unit.statuses.infectada ?? 0) > sim.state.tick);

/**
 * Answers every infected cell with an NK cell next to it, behind it when that cell is free,
 * unless an NK cell already reaches it.
 */
const nkCells: Bot = (sim, level) => {
  const reach = content.units.find((unit) => unit.id === 'nk')!.attack!.range;
  for (const cell of infected(sim)) {
    const covered = sim.state.units.some(
      (u) => u.defId === 'nk' && Math.abs(u.row - cell.row) <= reach && Math.abs(u.col - cell.col) <= reach,
    );
    if (covered) continue;
    const spots: Array<[number, number]> = [
      [cell.row, cell.col - 1],
      [cell.row - 1, cell.col - 1],
      [cell.row + 1, cell.col - 1],
      [cell.row - 1, cell.col],
      [cell.row + 1, cell.col],
    ];
    for (const [row, col] of spots) {
      if (row < 0 || row >= level.grid.rows || col < 0 || !isFree(sim, row, col)) continue;
      if (sim.placeUnit('nk', row, col).ok) break;
    }
  }
};

/** Two NK cells kept behind the line from the first virus on, together reaching every lane. */
const nkGuard: Bot = (sim) => {
  if (!sim.state.enemies.some((e) => e.defId === 'virus') && !sim.state.units.some((u) => u.defId === 'nk')) return;
  for (const row of [1, 3]) {
    if (unitsIn(sim, row, 'nk').length === 0 && isFree(sim, row, 2) && sim.state.energy >= unitCost('nk')) sim.placeUnit('nk', row, 2);
  }
};

/** Releases with moderation: below half a meter of cytokines and before the inflammation harms. */
const moderate: Bot = (sim) => sim.setReleasing(sim.signal('citocinas') < 0.5 && sim.signal('inflamacion') < 0.55);

const walls = together(macrophages, wallLine, neutrophils);
const withNk = together(walls, nkCells, moderate);
const slowWithNk = together(every(2, together(walls, nkCells)), moderate);
const withoutNk = together(walls, moderate);
const slowWithoutNk = together(every(2, walls), moderate);

function play(level: LevelDef, bot: Bot, rules: Content = content, seed = 1) {
  const sim = createSim(level, rules, seed);
  let peak = 0;
  let infections = 0;
  let bursts = 0;
  while (sim.state.status === 'playing' && sim.state.tick < secondsToTicks(300)) {
    bot(sim, level);
    for (const event of sim.step()) {
      if (event.type === 'status_applied' && event.status === 'infectada') infections++;
      if (event.type === 'status_burst') bursts++;
    }
    peak = Math.max(peak, sim.signal('inflamacion'));
  }
  return { status: sim.state.status, defeat: sim.state.defeat, seconds: sim.state.tick / 20, peak, infections, bursts };
}

/** Same rules without interferon: an infected cell protects none of its neighbours. */
const noInterferon: Content = {
  ...content,
  statuses: Object.fromEntries(Object.entries(content.statuses ?? {}).map(([name, def]) => [name, { ...def, shares: undefined }])),
};

const level = resolveLevel('1-5', 'normal')!;
/** Seeds change only where burst virions go; the result must not hang on one of them. */
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

describe('level 1-5 balance', () => {
  it('is won by answering infected cells with NK cells and releasing with moderation, also by a slow player', () => {
    for (const bot of [withNk, slowWithNk]) {
      for (const seed of SEEDS) {
        const result = play(level, bot, content, seed);
        expect(result.status, `seed ${seed}`).toBe('won');
        expect(result.peak).toBeLessThan(0.6);
        // Three to four minutes.
        expect(result.seconds).toBeGreaterThan(170);
        expect(result.seconds).toBeLessThan(240);
      }
    }
  });

  it('is also won keeping two NK cells behind the line from the first virus on', () => {
    expect(play(level, together(walls, nkGuard, moderate)).status).toBe('won');
  });

  it('is lost without NK cells: infected cells burst and the infection spreads', () => {
    for (const bot of [withoutNk, slowWithoutNk]) {
      for (const seed of SEEDS) {
        const result = play(level, bot, content, seed);
        expect(result.status, `seed ${seed}`).toBe('lost');
        expect(result.defeat).toEqual({ type: 'breach' });
      }
    }
    // Without NK cells far more cells burst than with them.
    const without = play(level, withoutNk);
    const withThem = play(level, withNk);
    expect(without.bursts).toBeGreaterThan(withThem.bursts * 2);
  });

  it('needs interferon: the winning player loses on almost every seed when infected cells protect nobody', () => {
    const lost = SEEDS.filter((seed) => play(level, withNk, noInterferon, seed).status === 'lost');
    expect(lost.length).toBeGreaterThanOrEqual(6);
    // And it falls early, long before the end of the level.
    expect(play(level, withNk, noInterferon).seconds).toBeLessThan(120);
  });

  it('is lost by the same cells when the player never releases the cytokines', () => {
    const result = play(level, together(walls, nkCells));
    expect(result.status).toBe('lost');
  });

  it('mixes viruses with bacteria and sends the viruses at neighbouring lanes a moment apart', () => {
    const viruses = level.waves.filter((wave) => wave.enemy === 'virus');
    expect(viruses.length).toBeGreaterThan(0);
    expect(level.waves.some((wave) => wave.enemy !== 'virus')).toBe(true);
    expect(level.deck).toEqual(['epitelio', 'moco', 'macrofago', 'neutrofilo', 'nk']);
    expect(level.signals).toEqual(['citocinas', 'inflamacion']);
  });
});

/**
 * A casual player who still answers infected cells with NK cells, but sloppily: acts only every
 * 3 seconds and notices an infected cell `delay` seconds after it was infected, so its NK cell
 * arrives with the 6-second burst timer half spent.
 */
function lateNkCells(delay: number): Bot {
  const seenAt = new Map<number, number>();
  return (sim, level) => {
    const reach = content.units.find((unit) => unit.id === 'nk')!.attack!.range;
    for (const cell of infected(sim)) {
      if (!seenAt.has(cell.uid)) seenAt.set(cell.uid, sim.state.tick);
      if (sim.state.tick - seenAt.get(cell.uid)! < secondsToTicks(delay)) continue;
      const covered = sim.state.units.some(
        (u) => u.defId === 'nk' && Math.abs(u.row - cell.row) <= reach && Math.abs(u.col - cell.col) <= reach,
      );
      if (covered) continue;
      for (const [row, col] of [[cell.row, cell.col - 1], [cell.row - 1, cell.col - 1], [cell.row + 1, cell.col - 1]] as const) {
        if (row < 0 || row >= level.grid.rows || col < 0 || !isFree(sim, row, col)) continue;
        if (sim.placeUnit('nk', row, col).ok) break;
      }
    }
  };
}

/** Casual player who releases with moderation but reacts late. Built fresh per game: it remembers cells. */
const casualModerate = (): Bot => together(every(3, together(walls, lateNkCells(2))), moderate);
/** Casual player who reacts late and also holds the release button in pulses, ignoring the inflammation bar. */
const casualCareless = (): Bot => together(every(3, together(walls, lateNkCells(2))), pulseRelease(3, 6));

describe('level 1-5 difficulties', () => {
  const sepsis = resolveLevel('1-5', 'sepsis')!;

  it('normal is won by a casual player who answers infected cells late, on every seed', () => {
    for (const make of [casualModerate, casualCareless]) {
      for (const seed of SEEDS) {
        const result = play(level, make(), content, seed);
        expect(result.status, `${make.name} seed ${seed}`).toBe('won');
        expect(result.seconds).toBeGreaterThan(170);
        expect(result.seconds).toBeLessThan(240);
      }
    }
  });

  it('sepsis is lost by the casual player who releases carelessly: the inflammation bar fills', () => {
    for (const seed of SEEDS) {
      const result = play(sepsis, casualCareless(), content, seed);
      expect(result.status, `seed ${seed}`).toBe('lost');
      expect(result.peak).toBeGreaterThanOrEqual(1);
    }
  });

  it('sepsis is lost on some seeds even by the casual player who releases with moderation', () => {
    const lost = SEEDS.filter((seed) => play(sepsis, casualModerate(), content, seed).status === 'lost');
    expect(lost.length).toBeGreaterThan(0);
  });

  it('normal only eases the waves and, slightly, the inflammation bar', () => {
    expect(level.startEnergy).toBe(sepsis.startEnergy);
    expect(level.marrow).toEqual(sepsis.marrow);
    expect(level.wounds).toEqual(sepsis.wounds);
    // Same viruses at the same moments: the concept the level teaches is untouched.
    const viruses = (lvl: LevelDef) => lvl.waves.filter((wave) => wave.enemy === 'virus');
    expect(viruses(level)).toEqual(viruses(sepsis));
    const enemies = (lvl: LevelDef) => lvl.waves.reduce((sum, wave) => sum + wave.count, 0);
    expect(enemies(level)).toBeLessThan(enemies(sepsis));
    // The inflammation bar only drains a little faster; harm tiers and the defeat point stay.
    expect(Object.keys(level.signalTuning ?? {})).toEqual(['inflamacion']);
    expect(Object.keys(level.signalTuning!.inflamacion!)).toEqual(['decayPerSecond']);
    const base = content.signals!.inflamacion!.decayPerSecond;
    expect(level.signalTuning!.inflamacion!.decayPerSecond).toBeGreaterThan(base);
    expect(level.signalTuning!.inflamacion!.decayPerSecond).toBeLessThanOrEqual(base * 1.25);
  });
});

describe('level 1-5 tutorial on normal', () => {
  /** Same player as tests/data/tutorials.test.ts: a macrophage behind an epithelium per lane, following the steps. */
  it('can be followed to the end with the real rules', () => {
    const sim = createSim(level, content, 1);
    const tutorial = createTutorial(tutorials['1-5']!.steps);
    const shown: number[] = [];
    let nkPlaced = false;
    while (!tutorial.finished && sim.state.status === 'playing' && sim.state.tick < secondsToTicks(240)) {
      const tick = sim.state.tick;
      const statuses = new Set(sim.state.units.flatMap((u) => Object.keys(u.statuses).filter((name) => (u.statuses[name] ?? 0) > tick)));
      tutorial.observe({ stored: 0, enemies: countEnemies(sim.state.enemies.map((enemy) => enemy.defId)), statuses });
      const step = tutorial.step;
      if (tutorial.active && step) {
        if (shown[shown.length - 1] !== tutorial.index) shown.push(tutorial.index);
        if (step.advance.type === 'tap') {
          tutorial.perform({ type: 'tap' });
          continue;
        }
        const cell = sim.state.units.find((u) => (u.statuses.infectada ?? 0) > tick) ?? sim.state.units[0]!;
        for (const [row, col] of [[cell.row, cell.col - 1], [cell.row - 1, cell.col], [cell.row + 1, cell.col], [cell.row, cell.col + 1]] as const) {
          if (row < 0 || row >= level.grid.rows || col < 0) continue;
          if (sim.placeUnit('nk', row, col).ok) {
            nkPlaced = true;
            tutorial.perform({ type: 'place', unit: 'nk', row, col });
            break;
          }
        }
      } else {
        for (const lane of sim.state.openLanes) {
          if (!sim.state.units.some((u) => u.row === lane && u.defId === 'macrofago')) sim.placeUnit('macrofago', lane, 3);
          else if (!sim.state.units.some((u) => u.row === lane && u.defId === 'epitelio')) sim.placeUnit('epitelio', lane, 4);
        }
      }
      if (tutorial.timeScale > 0) sim.step();
    }
    expect(tutorial.finished).toBe(true);
    expect(shown).toEqual([0, 1, 2, 3]);
    expect(nkPlaced).toBe(true);
  });
});

describe('virus, interferon and NK cell (real content, small scenarios)', () => {
  const scenario = (waves: LevelDef['waves']): LevelDef => ({
    id: 'scenario',
    grid: { rows: 3, cols: 9 },
    startEnergy: 1000,
    marrow: { amount: 0, interval: 5 },
    deck: ['epitelio', 'macrofago', 'nk'],
    signals: [],
    waves,
  });
  const run = (lvl: LevelDef, setup: (sim: Sim) => void, seconds: number) => {
    const sim = createSim(lvl, content, 1);
    setup(sim);
    const events = [];
    for (let i = 0; i < secondsToTicks(seconds) && sim.state.status === 'playing'; i++) events.push(...sim.step());
    return { sim, events };
  };

  it('a macrophage phagocytoses a free virion before it reaches it', () => {
    const { sim, events } = run(scenario([{ at: 0, enemy: 'virus', lane: 1, count: 1, gap: 0 }]), (s) => s.placeUnit('macrofago', 1, 3), 20);
    expect(events.some((e) => e.type === 'enemy_died')).toBe(true);
    expect(sim.state.status).toBe('won');
  });

  it('an NK cell ignores free virions and kills the infected epithelium before it bursts', () => {
    const { sim, events } = run(
      scenario([{ at: 0, enemy: 'virus', lane: 1, count: 1, gap: 0 }]),
      (s) => {
        s.placeUnit('epitelio', 1, 5);
        s.placeUnit('nk', 0, 4);
      },
      20,
    );
    expect(events.some((e) => e.type === 'status_applied' && e.status === 'infectada')).toBe(true);
    expect(events.some((e) => e.type === 'cell_attacked')).toBe(true);
    expect(events.some((e) => e.type === 'status_burst')).toBe(false);
    expect(sim.state.status).toBe('won');
  });

  it('an infected epithelium left alone bursts into 2 or 3 virions', () => {
    const { events } = run(scenario([{ at: 0, enemy: 'virus', lane: 1, count: 1, gap: 0 }]), (s) => s.placeUnit('epitelio', 1, 7), 12);
    const burst = events.find((e) => e.type === 'status_burst');
    expect(burst && burst.type === 'status_burst' ? burst.released.length : 0).toBeGreaterThanOrEqual(2);
    expect(burst && burst.type === 'status_burst' ? burst.released.length : 0).toBeLessThanOrEqual(3);
  });
});
