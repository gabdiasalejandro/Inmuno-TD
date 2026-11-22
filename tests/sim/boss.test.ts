import { describe, expect, it } from 'vitest';
import { createSim, secondsToTicks, type Content, type EnemyDef, type LevelDef, type Sim, type SimEvent, type UnitDef } from '../../src/sim';
import { content as base, grunt, level } from './fixtures';

/** Stands its ground, covers three lanes and sheds grunts every 2 s. */
const king: EnemyDef = {
  id: 'king',
  hp: 1000,
  speed: 0.05,
  attack: { damage: 5, rate: 1 },
  span: 1,
  sheds: { enemy: 'grunt', every: 2 },
};
const hitter: UnitDef = { id: 'hitter', cost: 10, cooldown: 0, hp: 5000, attack: { type: 'melee', damage: 50, rate: 1, range: 1 } };
const runner: UnitDef = { id: 'runner', cost: 10, cooldown: 0, hp: 100, tags: ['fast'] };
const content: Content = {
  ...base,
  units: [...base.units, hitter, runner],
  enemies: [...base.enemies, king],
  statuses: { marked: {} },
  powers: [{ id: 'mark', cooldown: 1, radius: 1, opsonize: { status: 'marked', at: 0 } }],
};

function setup(overrides: Partial<LevelDef> = {}, enemies: EnemyDef[] = []): Sim {
  return createSim(
    level({
      grid: { rows: 5, cols: 8 },
      startEnergy: 10000,
      deck: ['hitter', 'runner', 'wall'],
      waves: [{ at: 0, enemy: 'king', lane: 2, count: 1, gap: 1 }],
      win: { type: 'survive', seconds: 999 },
      ...overrides,
    }),
    { ...content, enemies: [...content.enemies.filter((e) => !enemies.some((o) => o.id === e.id)), ...enemies] },
    1,
  );
}

function run(sim: Sim, seconds: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < secondsToTicks(seconds) && sim.state.status === 'playing'; i++) events.push(...sim.step());
  return events;
}

const kingOf = (sim: Sim) => sim.state.enemies.find((e) => e.defId === 'king')!;
const hitsOn = (events: SimEvent[], uid: number) => events.filter((e) => e.type === 'unit_attacked' && e.target === uid);

describe('an enemy that spans several lanes', () => {
  it('is in reach of units in every lane it covers and of none outside them', () => {
    const sim = setup({}, [{ ...king, sheds: undefined }]);
    sim.placeUnit('hitter', 1, 6);
    sim.placeUnit('hitter', 3, 6);
    sim.placeUnit('hitter', 0, 6);
    const events = run(sim, 3);
    const boss = kingOf(sim);
    const attackers = new Set(hitsOn(events, boss.uid).map((e) => (e as { uid: number }).uid));
    const byRow = (row: number) => sim.state.units.find((u) => u.row === row)!.uid;
    expect(attackers.has(byRow(1))).toBe(true);
    expect(attackers.has(byRow(3))).toBe(true);
    expect(attackers.has(byRow(0))).toBe(false);
  });

  it('is stopped by a wall in any lane it covers, and attacks it', () => {
    const sim = setup({}, [{ ...king, sheds: undefined, speed: 1 }]);
    sim.placeUnit('wall', 3, 4);
    const events = run(sim, 6);
    expect(events.some((e) => e.type === 'enemy_attacked')).toBe(true);
    expect(kingOf(sim).pos).toBeGreaterThanOrEqual(5000);
  });

  it('is caught by a power area that overlaps only one of its side lanes', () => {
    const sim = setup({ powers: ['mark'] }, [{ ...king, sheds: undefined }]);
    run(sim, 0.1);
    expect(sim.playPower('mark', 4, 7).ok).toBe(true);
    run(sim, 0.2);
    expect(kingOf(sim).statuses?.marked ?? 0).toBeGreaterThan(sim.state.tick);
  });
});

describe('an anchored enemy', () => {
  it('walks in and then holds its column, never advancing past it', () => {
    const sim = setup({}, [{ ...king, sheds: undefined, speed: 1, anchor: 5 }]);
    run(sim, 10);
    const boss = kingOf(sim);
    // Its front edge rests on the right edge of column 5: it stands in that column.
    expect(boss.pos).toBe(6000);
  });
});

describe('shedding', () => {
  it('releases one enemy every `every` seconds from the right edge, rotating through the lanes', () => {
    const sim = setup();
    const spawned = run(sim, 10.1).filter((e) => e.type === 'enemy_spawned' && e.defId === 'grunt');
    expect(spawned).toHaveLength(5);
    expect(spawned.map((e) => (e as { lane: number }).lane)).toEqual([0, 1, 2, 3, 4]);
  });

  it('stops when the shedding enemy dies', () => {
    const sim = setup({}, [{ ...king, hp: 60 }]);
    sim.placeUnit('hitter', 2, 6);
    run(sim, 3);
    expect(sim.state.enemies.some((e) => e.defId === 'king')).toBe(false);
    const later = run(sim, 6).filter((e) => e.type === 'enemy_spawned');
    expect(later).toHaveLength(0);
  });
});

describe('a toxin aura from a health threshold', () => {
  const toxic: EnemyDef = { ...king, sheds: undefined, aura: { from: 0.7, radius: 1, requires: ['fast'], damagePerSecond: 50 } };

  it('does nothing while the enemy is above the threshold', () => {
    const sim = setup({}, [toxic]);
    sim.placeUnit('runner', 1, 6);
    run(sim, 3);
    expect(sim.state.units.find((u) => u.defId === 'runner')!.hp).toBe(100);
  });

  it('below it, harms units with the tags within the radius, and only them', () => {
    const sim = setup({}, [toxic]);
    run(sim, 0.1);
    kingOf(sim).hp = 600;
    sim.placeUnit('runner', 1, 6);
    sim.placeUnit('runner', 1, 4);
    sim.placeUnit('wall', 3, 6);
    const events = run(sim, 1);
    expect(events.find((e) => e.type === 'boss_phase')).toMatchObject({ phase: 'aura' });
    const runners = sim.state.units.filter((u) => u.defId === 'runner');
    expect(runners.find((u) => u.col === 6)!.hp).toBeCloseTo(50, 0);
    // Three columns away: out of the radius.
    expect(runners.find((u) => u.col === 4)!.hp).toBe(100);
    expect(sim.state.units.find((u) => u.defId === 'wall')!.hp).toBe(200);
  });
});

describe('a shield from a health threshold', () => {
  const walled: EnemyDef = { ...king, sheds: undefined, shield: { from: 0.4, hp: 200 } };

  it('raises the shield once below the threshold and takes the damage on it until it breaks', () => {
    const sim = setup({}, [walled]);
    run(sim, 0.1);
    const boss = kingOf(sim);
    boss.hp = 400;
    const raised = run(sim, 0.1);
    expect(raised.find((e) => e.type === 'boss_phase')).toMatchObject({ phase: 'shield' });
    expect(boss.shield).toBe(200);
    sim.placeUnit('hitter', 2, 6);
    run(sim, 3.5);
    // Four hits of 50 break the 200-point shield; the body is untouched until then.
    expect(boss.shield).toBe(0);
    expect(boss.hp).toBe(400);
    run(sim, 1.5);
    expect(boss.hp).toBeLessThan(400);
  });

  it('is raised only once', () => {
    const sim = setup({}, [walled]);
    run(sim, 0.1);
    const boss = kingOf(sim);
    boss.hp = 300;
    run(sim, 0.1);
    boss.shield = 0;
    boss.hp = 100;
    const events = run(sim, 1);
    expect(events.some((e) => e.type === 'boss_phase')).toBe(false);
    expect(boss.shield).toBe(0);
  });
});

describe('boss win condition', () => {
  it('is won the moment the boss dies, with other enemies still on the board', () => {
    const sim = setup({ win: { type: 'boss', enemy: 'king' } }, [{ ...king, hp: 300 }]);
    sim.placeUnit('hitter', 2, 6);
    run(sim, 3);
    expect(sim.state.status).toBe('playing');
    run(sim, 4);
    expect(sim.state.status).toBe('won');
    expect(sim.state.enemies.some((e) => e.defId === grunt.id)).toBe(true);
  });

  it('is not won before the boss has appeared', () => {
    const sim = setup({ win: { type: 'boss', enemy: 'king' }, waves: [{ at: 5, enemy: 'king', lane: 2, count: 1, gap: 1 }] });
    run(sim, 2);
    expect(sim.state.status).toBe('playing');
  });
});
