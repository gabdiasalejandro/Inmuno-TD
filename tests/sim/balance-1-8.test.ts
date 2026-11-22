import { describe, expect, it } from 'vitest';
import { content, resolveLevel, tutorials, type Difficulty } from '../../src/data';
import { countEnemies, createTutorial } from '../../src/game/tutorial';
import { createSim, secondsToTicks, type Sim, type SimEvent } from '../../src/sim';
import { engagedCol } from '../../src/sim/world';
import { every, holdLanes, pulseRelease, together, type Bot } from './bots';

const BOSS = 'staphylococcus_aureus_colonia';
const SEEDS = [1, 2, 3, 4, 5];
const colony = (sim: Sim) => sim.state.enemies.find((enemy) => enemy.defId === BOSS);
const occupied = (sim: Sim, row: number, col: number) => sim.state.units.some((unit) => unit.row === row && unit.col === col);

const defence = holdLanes('macrofago', 3);
/** An epithelium in a lane with bacteria and neither macrophage nor wall yet (macrophages take 12 s to redeploy). */
const plug: Bot = (sim) => {
  for (const lane of sim.state.openLanes) {
    if (sim.state.units.some((u) => u.row === lane && (u.defId === 'macrofago' || u.defId === 'epitelio'))) continue;
    if (sim.state.enemies.some((e) => e.lane === lane && e.defId !== BOSS)) sim.placeUnit('epitelio', lane, 2);
  }
};
/** Once the colony stands in its column, a macrophage right in front of it in each lane it covers. */
const siege: Bot = (sim) => {
  const boss = colony(sim);
  if (!boss || engagedCol(boss.pos) > 5) return;
  for (const lane of [boss.lane - 1, boss.lane, boss.lane + 1]) {
    if (!occupied(sim, lane, 4) && sim.state.energy >= 100) sim.placeUnit('macrofago', lane, 4);
  }
};
/** Neutrophils behind a lane's macrophage when bacteria come close, kept out of the colony's toxins. */
const neutrophils: Bot = (sim) => {
  for (const lane of sim.state.openLanes) {
    const near = sim.state.enemies.filter((e) => e.lane === lane && e.defId !== BOSS).map((e) => engagedCol(e.pos));
    const front = Math.min(99, ...near);
    if (front > 5 || sim.state.energy < 150 || !sim.state.units.some((u) => u.row === lane && u.defId === 'macrofago')) continue;
    const col = Math.max(2, Math.min(3, front - 1));
    if (Math.abs(lane - 2) <= 1 && col >= 3) continue;
    if (!occupied(sim, lane, col)) sim.placeUnit('neutrofilo', lane, col);
  }
};
/** An NK cell next to any infected cell. */
const nk: Bot = (sim) => {
  for (const cell of sim.state.units) {
    if ((cell.statuses.infectada ?? 0) <= sim.state.tick) continue;
    for (const [dr, dc] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
      const row = cell.row + dr;
      const col = cell.col + dc;
      if (row < 0 || row > 4 || col < 0 || col > 8 || occupied(sim, row, col)) continue;
      if (sim.placeUnit('nk', row, col).ok) return;
    }
  }
};
const carefulRelease: Bot = (sim) => sim.setReleasing(sim.signal('inflamacion') < 0.3);
/** The complement on an unmarked capsulated bacterium, or on the colony once it stands, while inflammation allows. */
const complement: Bot = (sim) => {
  if (sim.signal('inflamacion') > 0.4) return;
  const capsule = sim.state.enemies.find((e) => e.defId === 'bacteria_capsulada' && !e.statuses?.opsonizado && e.pos < 6000);
  const boss = colony(sim);
  const target = capsule ?? (boss && engagedCol(boss.pos) <= 5 ? boss : undefined);
  if (target) sim.playPower('complemento', target.lane, engagedCol(target.pos));
};
const withoutComplement = together(defence, plug, nk, siege, neutrophils, carefulRelease);
const full = together(withoutComplement, complement);

/** Macrophages in front of the colony, one per look, wherever a covered lane still lacks one. */
const sloppySiege: Bot = (sim) => {
  const boss = colony(sim);
  if (!boss || engagedCol(boss.pos) > 5) return;
  const lane = [boss.lane - 1, boss.lane, boss.lane + 1].find((row) => !occupied(sim, row, 4));
  if (lane !== undefined) sim.placeUnit('macrofago', lane, 4);
};
/** A neutrophil in front of a lane's macrophage whenever bacteria come and energy is spare, toxins or not. */
const sloppyNeutrophils: Bot = (sim) => {
  if (sim.state.energy < 100) return;
  for (const lane of sim.state.openLanes) {
    const near = sim.state.enemies.filter((e) => e.lane === lane && e.defId !== BOSS).map((e) => engagedCol(e.pos));
    if (!near.length || !sim.state.units.some((u) => u.row === lane && u.defId === 'macrofago')) continue;
    const col = Math.max(1, Math.min(4, Math.min(...near) - 1));
    if (!occupied(sim, lane, col) && sim.placeUnit('neutrofilo', lane, col).ok) return;
  }
};
/** The complement on a capsulated bacterium once it is close, or on the colony once its wall is up, unless the tissue is badly inflamed. */
const lateComplement: Bot = (sim) => {
  if (sim.signal('inflamacion') > 0.6) return;
  const capsule = sim.state.enemies.find((e) => e.defId === 'bacteria_capsulada' && !e.statuses?.opsonizado && e.pos < 4000);
  const boss = colony(sim);
  const target = capsule ?? (boss?.shield ? boss : undefined);
  if (target) sim.playPower('complemento', target.lane, engagedCol(target.pos));
};
/**
 * A casual player who knows the right ideas but plays them loosely: looks at the board once every
 * two seconds, holds the lanes with macrophages, answers infected cells with an NK, lays siege to the colony, sends neutrophils even
 * into the toxins, plays the complement late and pulses the release, stopping only once the
 * inflammation bar is already half full.
 */
const pulses = pulseRelease(3, 10);
const sloppyRelease: Bot = (sim, level) => (sim.signal('inflamacion') < 0.5 ? pulses(sim, level) : sim.setReleasing(false));
const casual = together(every(2, together(defence, plug, nk, sloppySiege, sloppyNeutrophils, lateComplement)), sloppyRelease);

function play(bot: Bot, seed = 1, seconds = 600, difficulty: Difficulty = 'normal') {
  const level = resolveLevel('1-8', difficulty)!;
  const sim = createSim(level, content, seed);
  const events: SimEvent[] = [];
  while (sim.state.status === 'playing' && sim.state.tick < secondsToTicks(seconds)) {
    bot(sim, level);
    events.push(...sim.step());
  }
  return { sim, events, seconds: sim.state.tick / 20 };
}

describe('level 1-8 balance', () => {
  it.each(SEEDS)('is won with every tool of world 1, in 2 to 4 minutes (seed %i)', (seed) => {
    const { sim, events, seconds } = play(full, seed);
    expect(sim.state.status).toBe('won');
    expect(seconds).toBeGreaterThan(120);
    expect(seconds).toBeLessThan(240);
    expect(events.filter((e) => e.type === 'boss_phase').map((e) => (e as { phase: string }).phase)).toEqual(['aura', 'shield']);
  });

  it('ends with a macrophage engulfing the weakened colony, and is won only once the board is clear', () => {
    const { sim, events } = play(full);
    const boss = events.find((e) => e.type === 'enemy_spawned' && e.defId === BOSS) as { uid: number };
    const end = events.findIndex((e) => e.type === 'unit_attacked' && e.target === boss.uid && e.kind === 'engulf');
    const won = events.findIndex((e) => e.type === 'won');
    expect(end).toBeGreaterThan(-1);
    expect(won).toBeGreaterThan(end);
    expect(events.slice(end, won).some((e) => e.type === 'enemy_died' && e.uid !== boss.uid)).toBe(true);
    expect(sim.state.enemies).toHaveLength(0);
  });

  it('strikes the colony with quick, lighter blows rather than bites', () => {
    const { events } = play(full);
    const boss = events.find((e) => e.type === 'enemy_spawned' && e.defId === BOSS) as { uid: number };
    const blows = events.filter((e) => e.type === 'unit_attacked' && e.target === boss.uid && e.kind === 'strike');
    expect(blows.length).toBeGreaterThan(20);
  });

  it.each(SEEDS)('is lost without the complement: capsulated bacteria slip past the phagocytes (seed %i)', (seed) => {
    const { sim } = play(withoutComplement, seed);
    expect(sim.state.status).toBe('lost');
  });

  it('is lost by a defence that only waits: the colony holds its ground and keeps shedding bacteria', () => {
    const { sim } = play(together(defence, plug, carefulRelease));
    expect(sim.state.status).toBe('lost');
  });

  it('sheds a random mix that includes capsulated bacteria and viruses', () => {
    // One play rolls the wound stream only a few times, so the mix is read across seeds.
    const shed = new Set(SEEDS.flatMap((seed) => play(full, seed, 200).events.flatMap((e) => (e.type === 'enemy_spawned' ? [e.defId] : []))));
    expect(shed).toContain('bacteria_capsulada');
    expect(shed).toContain('virus');
  });

  it('kills a neutrophil next to the colony within two seconds once the leukocidins are out', () => {
    const level = resolveLevel('1-8', 'normal')!;
    const sim = createSim(level, content, 1);
    while (!colony(sim) || engagedCol(colony(sim)!.pos) > 5) {
      defence(sim, level);
      sim.step();
    }
    const boss = colony(sim)!;
    boss.hp = 0.6 * content.enemies.find((e) => e.id === BOSS)!.hp;
    sim.state.energy = 1000;
    expect(sim.placeUnit('neutrofilo', boss.lane + 1, 4)).toEqual({ ok: true });
    const events: SimEvent[] = [];
    for (let i = 0; i < secondsToTicks(2); i++) events.push(...sim.step());
    expect(events.some((e) => e.type === 'unit_died' && e.defId === 'neutrofilo' && e.cause === 'killed')).toBe(true);
  });

  it('shrugs off the membrane attack: the colony is gram-positive', () => {
    const { events } = play(full, 1, 200);
    const boss = events.find((e) => e.type === 'enemy_spawned' && e.defId === BOSS) as { uid: number };
    const macs = events.filter((e) => e.type === 'power_step' && e.kind === 'attack');
    expect(macs.length).toBeGreaterThan(0);
    expect(macs.some((e) => (e as { enemies: number[] }).enemies.includes(boss.uid))).toBe(false);
  });

  it('is a boss level: the colony is the win condition, stands still and sheds a weighted mix', () => {
    const level = resolveLevel('1-8', 'normal')!;
    expect(level.win).toEqual({ type: 'boss', enemy: BOSS });
    const def = content.enemies.find((e) => e.id === BOSS)!;
    expect(def.anchor).toBeDefined();
    expect(def.engulfBelow).toBeDefined();
    expect(def.sheds?.map((stream) => [stream.from, stream.pool.map((entry) => entry.enemy)])).toEqual([
      ['self', ['staphylococcus_aureus']],
      ['edge', ['bacteria_capsulada', 'virus']],
    ]);
  });

  it.each(SEEDS)('is won on Normal by a casual player who knows the concepts, in 2 to 5 minutes (seed %i)', (seed) => {
    const { sim, seconds } = play(casual, seed);
    expect(sim.state.status).toBe('won');
    expect(seconds).toBeGreaterThan(120);
    expect(seconds).toBeLessThan(300);
  });

  it.each(SEEDS)('is lost on Sepsis by that same casual player (seed %i)', (seed) => {
    const { sim } = play(casual, seed, 600, 'sepsis');
    expect(sim.state.status).toBe('lost');
  });

  it('keeps something arriving on Normal: wave starts before the colony are at most 10 s apart', () => {
    const level = resolveLevel('1-8', 'normal')!;
    const colonyAt = level.waves.find((wave) => wave.enemy === BOSS)!.at;
    const starts = [...new Set(level.waves.filter((wave) => wave.at <= colonyAt).map((wave) => wave.at))].sort((a, b) => a - b);
    const gaps = starts.slice(1).map((at, i) => at - starts[i]!);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(10);
  });

  it('can be followed to the end on Normal: each tutorial step shows and the player still wins', () => {
    const level = resolveLevel('1-8', 'normal')!;
    const steps = tutorials['1-8']!.steps;
    const sim = createSim(level, content, 1);
    const tutorial = createTutorial(steps);
    /** Real frames the player spends reading a bubble before tapping on. */
    const READ_FRAMES = 60;
    let reading = 0;
    let slowCarry = 0;
    while (sim.state.status === 'playing' && sim.state.tick < secondsToTicks(600)) {
      tutorial.observe({
        stored: level.signals?.reduce((sum, name) => sum + sim.stored(name), 0) ?? 0,
        enemies: countEnemies(sim.state.enemies.map((enemy) => enemy.defId)),
        bossPhases: new Set(sim.state.enemies.flatMap((enemy) => enemy.phases ?? [])),
      });
      if (tutorial.active) {
        // While a bubble is up only its tap is allowed: the player reads it, then taps on.
        if (++reading >= READ_FRAMES && tutorial.perform({ type: 'tap' })) reading = 0;
      } else {
        casual(sim, level);
      }
      const scale = tutorial.timeScale;
      for (let i = 0; i < Math.floor(scale) && sim.state.status === 'playing'; i++) sim.step();
      if (scale > 0 && scale < 1 && (slowCarry += scale) >= 1) {
        slowCarry -= 1;
        sim.step();
      }
    }
    expect(tutorial.finished).toBe(true);
    expect(sim.state.status).toBe('won');
  });
});

