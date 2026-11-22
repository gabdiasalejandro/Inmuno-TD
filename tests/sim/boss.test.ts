import { describe, expect, it } from 'vitest';
import { createSim, secondsToTicks, type Content, type EnemyDef, type LevelDef, type Sim, type SimEvent, type UnitDef } from '../../src/sim';
import { content as base, level } from './fixtures';

/** Stands its ground, covers three lanes and sheds grunts every 2 s. */
const king: EnemyDef = {
  id: 'king',
  hp: 1000,
  speed: 0.05,
  attack: { damage: 5, rate: 1 },
  span: 1,
  sheds: [{ every: 2, from: 'edge', pool: [{ enemy: 'grunt', weight: 1 }] }],
  tags: ['big'],
};
const hitter: UnitDef = { id: 'hitter', cost: 10, cooldown: 0, hp: 5000, attack: { type: 'melee', damage: 50, rate: 1, range: 1 } };
/** Eats in slow bites, but against big enemies throws quick, lighter punches. */
const eater: UnitDef = {
  id: 'eater',
  cost: 10,
  cooldown: 0,
  hp: 5000,
  attack: { type: 'bite', damage: 40, rate: 0.25, range: 1, strike: { against: ['big'], damage: 30, rate: 1 } },
};
const imp: EnemyDef = { id: 'imp', hp: 30, speed: 1, attack: { damage: 1, rate: 1 } };
const runner: UnitDef = { id: 'runner', cost: 10, cooldown: 0, hp: 100, tags: ['fast'] };
const content: Content = {
  ...base,
  units: [...base.units, hitter, runner, eater],
  enemies: [...base.enemies, king, imp],
  statuses: { marked: {} },
  powers: [{ id: 'mark', cooldown: 1, radius: 1, opsonize: { status: 'marked', at: 0 } }],
};

function setup(overrides: Partial<LevelDef> = {}, enemies: EnemyDef[] = []): Sim {
  return createSim(
    level({
      grid: { rows: 5, cols: 8 },
      startEnergy: 10000,
      deck: ['hitter', 'runner', 'wall', 'eater'],
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
  const mixed: EnemyDef = { ...king, sheds: [{ every: 1, from: 'edge', pool: [{ enemy: 'grunt', weight: 3 }, { enemy: 'imp', weight: 1 }] }] };
  const sheds = (seed: number) => {
    const sim = createSim(
      level({ grid: { rows: 5, cols: 8 }, deck: ['wall'], waves: [{ at: 0, enemy: 'king', lane: 2, count: 1, gap: 1 }], win: { type: 'survive', seconds: 999 } }),
      { ...content, enemies: [...content.enemies.filter((e) => e.id !== 'king'), mixed] },
      seed,
    );
    const shed: Array<{ defId: string; lane: number }> = [];
    for (let i = 0; i < secondsToTicks(40.1); i++) {
      for (const e of sim.step()) if (e.type === 'enemy_spawned' && e.defId !== 'king') shed.push({ defId: e.defId, lane: e.lane });
      // Keep the board from filling up: the test only cares about what is released.
      sim.state.enemies = sim.state.enemies.filter((enemy) => enemy.defId === 'king');
    }
    return shed;
  };

  it('releases one enemy every `every` seconds from the right edge', () => {
    expect(sheds(1)).toHaveLength(40);
  });

  it('picks the kind from its weighted pool and the lane at random, from the level seed', () => {
    const shed = sheds(1);
    const imps = shed.filter((s) => s.defId === 'imp').length;
    expect(imps).toBeGreaterThan(2);
    expect(imps).toBeLessThan(20);
    expect(new Set(shed.map((s) => s.lane))).toEqual(new Set([0, 1, 2, 3, 4]));
    // Not a fixed rotation: some lane repeats right away somewhere in the sequence.
    expect(shed.some((s, i) => i > 0 && s.lane === shed[i - 1]!.lane)).toBe(true);
    expect(sheds(1)).toEqual(shed);
    expect(sheds(2)).not.toEqual(shed);
  });

  it('releases from its own front with `from: self` and from the right edge with `from: edge`, each stream on its own clock', () => {
    const twoStreams: EnemyDef = {
      ...king,
      speed: 1,
      anchor: 6,
      sheds: [
        { every: 2, from: 'self', pool: [{ enemy: 'grunt', weight: 1 }] },
        { every: 5, from: 'edge', pool: [{ enemy: 'imp', weight: 1 }] },
      ],
    };
    const sim = setup({}, [twoStreams]);
    const seen: Array<{ defId: string; pos: number }> = [];
    for (let i = 0; i < secondsToTicks(6.1); i++) {
      for (const e of sim.step()) {
        if (e.type !== 'enemy_spawned' || e.defId === 'king') continue;
        seen.push({ defId: e.defId, pos: sim.state.enemies.find((x) => x.uid === e.uid)!.pos });
      }
    }
    const grunts = seen.filter((s) => s.defId === 'grunt');
    const imps = seen.filter((s) => s.defId === 'imp');
    expect(grunts).toHaveLength(3);
    expect(imps).toHaveLength(1);
    // Anchored at column 6 its front rests at 7000: grunts come out there; imps from the edge (8 columns).
    expect(grunts.every((g) => g.pos === 7000)).toBe(true);
    expect(imps.every((g) => g.pos === 8000)).toBe(true);
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

describe('an enemy attack with reach', () => {
  const reaching: EnemyDef = { ...king, sheds: undefined, speed: 1, anchor: 5, attack: { damage: 10, rate: 1, range: 2 } };

  it('hits the nearest unit within `range` cells ahead in a lane it covers, without anything blocking it', () => {
    const sim = setup({}, [reaching]);
    sim.placeUnit('runner', 1, 3);
    sim.placeUnit('runner', 0, 3);
    sim.placeUnit('runner', 2, 2);
    const events = run(sim, 6);
    const hit = new Set(events.flatMap((e) => (e.type === 'enemy_attacked' ? [e.target] : [])));
    const at = (row: number, col: number) => sim.state.units.find((u) => u.row === row && u.col === col)!.uid;
    expect(hit.has(at(1, 3))).toBe(true);
    // Lane 0 is not covered; column 2 is three cells away.
    expect(hit.has(at(0, 3))).toBe(false);
    expect(hit.has(at(2, 2))).toBe(false);
  });

  it('without reach, attacks only what blocks it', () => {
    const sim = setup({}, [{ ...reaching, attack: { damage: 10, rate: 1 } }]);
    sim.placeUnit('wall', 1, 3);
    const events = run(sim, 6);
    expect(events.some((e) => e.type === 'enemy_attacked')).toBe(false);
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

describe('a unit that strikes big enemies and engulfs them when weak', () => {
  it('strikes a big enemy with its quicker, lighter blow instead of its bite', () => {
    const sim = setup({}, [{ ...king, sheds: undefined }]);
    sim.placeUnit('eater', 2, 6);
    const hits = hitsOn(run(sim, 4.05), kingOf(sim).uid);
    expect(hits.length).toBeGreaterThanOrEqual(4);
    expect(hits.every((e) => (e as { damage: number }).damage === 30 && (e as { kind?: string }).kind === 'strike')).toBe(true);
  });

  it('strikes any enemy a bite would not kill, and bites it once a bite would', () => {
    const tough: EnemyDef = { id: 'tough', hp: 100, speed: 1, attack: { damage: 1, rate: 1 } };
    const brawler: UnitDef = { ...eater, id: 'brawler', attack: { ...eater.attack!, strike: { against: [], damage: 30, rate: 1 } } };
    const sim = createSim(
      level({ grid: { rows: 5, cols: 8 }, startEnergy: 1000, deck: ['brawler'], waves: [{ at: 0, enemy: 'tough', lane: 2, count: 1, gap: 1 }], win: { type: 'survive', seconds: 99 } }),
      { ...content, units: [...content.units, brawler], enemies: [...content.enemies, tough] },
      1,
    );
    sim.placeUnit('brawler', 2, 5);
    const hits = run(sim, 8).filter((e) => e.type === 'unit_attacked') as Array<{ damage: number; kind?: string }>;
    // 100 hp: two punches (100 → 70 → 40), then a 40-point bite swallows it.
    expect(hits.map((h) => [h.kind ?? 'bite', h.damage])).toEqual([['strike', 30], ['strike', 30], ['bite', 40]]);
    expect(sim.state.enemies).toHaveLength(0);
  });

  it('still bites an ordinary enemy', () => {
    const sim = setup({ waves: [{ at: 0, enemy: 'grunt', lane: 2, count: 1, gap: 1 }] });
    sim.placeUnit('eater', 2, 5);
    const bite = run(sim, 3).find((e) => e.type === 'unit_attacked');
    expect(bite).toMatchObject({ damage: 40 });
    expect((bite as { kind?: string }).kind).toBeUndefined();
  });

  it('engulfs the big enemy whole once its health is down to `engulfBelow`, but not through a shield', () => {
    const sim = setup({}, [{ ...king, sheds: undefined, engulfBelow: 0.1, shield: { from: 0.05, hp: 500 } }]);
    run(sim, 0.1);
    const boss = kingOf(sim);
    boss.hp = 150;
    sim.placeUnit('eater', 2, 6);
    const above = hitsOn(run(sim, 1.05), boss.uid);
    expect(above.every((e) => (e as { kind?: string }).kind === 'strike')).toBe(true);
    boss.hp = 90;
    const events = run(sim, 4.1);
    expect(events.find((e) => e.type === 'unit_attacked' && e.target === boss.uid)).toMatchObject({ kind: 'engulf', damage: 90 });
    expect(sim.state.enemies.some((e) => e.defId === 'king')).toBe(false);
  });

  it('does not engulf while the shield stands', () => {
    const sim = setup({}, [{ ...king, sheds: undefined, engulfBelow: 0.1, shield: { from: 0.5, hp: 500 } }]);
    run(sim, 0.1);
    const boss = kingOf(sim);
    boss.hp = 50;
    run(sim, 0.1);
    sim.placeUnit('eater', 2, 6);
    const hits = hitsOn(run(sim, 3), boss.uid);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((e) => (e as { kind?: string }).kind === 'strike')).toBe(true);
    expect(boss.hp).toBe(50);
  });
});

describe('boss win condition', () => {
  it('is not won while bacteria remain on the board after the boss dies, and is won once they are gone', () => {
    const sim = setup({ win: { type: 'boss', enemy: 'king' } }, [{ ...king, hp: 300 }]);
    sim.placeUnit('hitter', 2, 6);
    run(sim, 7);
    expect(sim.state.enemies.some((e) => e.defId === 'king')).toBe(false);
    expect(sim.state.enemies.length).toBeGreaterThan(0);
    expect(sim.state.status).toBe('playing');
    for (const enemy of sim.state.enemies) enemy.hp = 0;
    run(sim, 0.1);
    expect(sim.state.status).toBe('won');
  });

  it('is not won with the board clear while the boss lives', () => {
    const sim = setup({ win: { type: 'boss', enemy: 'king' } }, [{ ...king, sheds: undefined }]);
    run(sim, 3);
    expect(sim.state.enemies.map((e) => e.defId)).toEqual(['king']);
    expect(sim.state.status).toBe('playing');
  });

  it('is not won before the boss has appeared', () => {
    const sim = setup({ win: { type: 'boss', enemy: 'king' }, waves: [{ at: 5, enemy: 'king', lane: 2, count: 1, gap: 1 }] });
    run(sim, 2);
    expect(sim.state.status).toBe('playing');
  });
});
