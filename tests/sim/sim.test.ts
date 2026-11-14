import { describe, expect, it } from 'vitest';
import { createRng, createSim, secondsToTicks, type Sim, type SimEvent } from '../../src/sim';
import { content, level } from './fixtures';

function run(sim: Sim, seconds: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < secondsToTicks(seconds); i++) events.push(...sim.step());
  return events;
}

const oneGrunt = (lane = 1) => [{ at: 0, enemy: 'grunt', lane, count: 1, gap: 0 }];

describe('time', () => {
  it('converts seconds to whole ticks of the fixed step', () => {
    expect(secondsToTicks(1)).toBe(20);
    expect(secondsToTicks(0.5)).toBe(10);
  });
});

describe('rng', () => {
  it('yields the same sequence for the same seed and a different one otherwise', () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const seqA = [a.next(), a.next(), a.next()];
    expect([b.next(), b.next(), b.next()]).toEqual(seqA);
    expect([c.next(), c.next(), c.next()]).not.toEqual(seqA);
    expect(seqA.every((n) => n >= 0 && n < 1)).toBe(true);
  });
});

describe('energy', () => {
  it('starts at the level value and grows by the marrow amount every interval', () => {
    const sim = createSim(level(), content, 1);
    expect(sim.state.energy).toBe(100);
    run(sim, 4.95);
    expect(sim.state.energy).toBe(100);
    run(sim, 0.05);
    expect(sim.state.energy).toBe(125);
    run(sim, 5);
    expect(sim.state.energy).toBe(150);
  });
});

describe('placing units', () => {
  it('spends energy and puts the unit on the cell', () => {
    const sim = createSim(level(), content, 1);
    expect(sim.placeUnit('fighter', 1, 2)).toEqual({ ok: true });
    expect(sim.state.energy).toBe(50);
    expect(sim.state.units).toMatchObject([{ defId: 'fighter', row: 1, col: 2, hp: 60 }]);
  });

  it.each([
    ['unknown unit', () => level({ deck: ['wall'] }), 'fighter', 0, 0, 'not_in_deck'],
    ['outside the grid', () => level(), 'wall', 3, 0, 'out_of_bounds'],
    ['outside the grid (col)', () => level(), 'wall', 0, 5, 'out_of_bounds'],
    ['too expensive', () => level({ startEnergy: 40 }), 'fighter', 0, 0, 'insufficient_energy'],
  ] as const)('rejects a unit that is %s without changing state', (_n, makeLevel, id, row, col, reason) => {
    const sim = createSim(makeLevel(), content, 1);
    const before = structuredClone(sim.state);
    expect(sim.placeUnit(id, row, col)).toEqual({ ok: false, reason });
    expect(sim.state).toEqual(before);
  });

  it('rejects an occupied cell', () => {
    const sim = createSim(level(), content, 1);
    sim.placeUnit('wall', 0, 0);
    expect(sim.placeUnit('mayfly', 0, 0)).toEqual({ ok: false, reason: 'cell_occupied' });
    expect(sim.state.units).toHaveLength(1);
  });

  it('enforces the per-unit redeploy cooldown', () => {
    const sim = createSim(level(), content, 1);
    sim.placeUnit('wall', 0, 0);
    expect(sim.placeUnit('wall', 0, 1)).toEqual({ ok: false, reason: 'on_cooldown' });
    expect(sim.placeUnit('mayfly', 0, 1)).toEqual({ ok: true });
    run(sim, 2);
    expect(sim.placeUnit('wall', 0, 2)).toEqual({ ok: true });
  });

  it('removes a unit when its lifespan runs out', () => {
    const sim = createSim(level(), content, 1);
    sim.placeUnit('mayfly', 0, 0);
    run(sim, 2.95);
    expect(sim.state.units).toHaveLength(1);
    const events = run(sim, 0.05);
    expect(sim.state.units).toHaveLength(0);
    expect(events).toContainEqual(expect.objectContaining({ type: 'unit_died', cause: 'expired' }));
  });
});

describe('enemies', () => {
  it('spawn at the right edge on schedule, spaced by the wave gap', () => {
    const sim = createSim(
      level({ waves: [{ at: 1, enemy: 'grunt', lane: 2, count: 2, gap: 2 }] }),
      content,
      1,
    );
    run(sim, 1);
    expect(sim.state.enemies).toHaveLength(0);
    sim.step();
    expect(sim.state.enemies).toMatchObject([{ defId: 'grunt', lane: 2, hp: 40 }]);
    run(sim, 2);
    expect(sim.state.enemies).toHaveLength(2);
  });

  it('advance along their lane at their speed in cells per second', () => {
    const sim = createSim(level({ waves: oneGrunt() }), content, 1);
    sim.step();
    const start = sim.state.enemies[0]!.pos;
    expect(start).toBeLessThanOrEqual(5000);
    run(sim, 2);
    expect(start - sim.state.enemies[0]!.pos).toBe(2000);
    expect(sim.state.enemies[0]!.lane).toBe(1);
  });

  it('rejects a level that references unknown content', () => {
    const bad = level({ waves: [{ at: 0, enemy: 'ghost', lane: 0, count: 1, gap: 0 }] });
    expect(() => createSim(bad, content, 1)).toThrow(/ghost/);
    expect(() => createSim(level({ deck: ['ghost'] }), content, 1)).toThrow(/ghost/);
    expect(() => createSim(level({ waves: oneGrunt(7) }), content, 1)).toThrow(/lane/);
  });
});

describe('combat', () => {
  it('a unit blocks the enemy at the edge of its cell and is damaged by it', () => {
    const sim = createSim(level({ waves: oneGrunt() }), content, 1);
    sim.placeUnit('wall', 1, 2);
    run(sim, 10);
    const enemy = sim.state.enemies[0]!;
    expect(enemy.pos).toBe(3000);
    expect(sim.state.units[0]!.hp).toBeLessThan(200);
    expect(sim.state.status).toBe('playing');
  });

  it('a unit only attacks enemies in its own lane and within range', () => {
    const sim = createSim(level({ waves: oneGrunt(0) }), content, 1);
    sim.placeUnit('fighter', 1, 0);
    run(sim, 3);
    expect(sim.state.enemies[0]!.hp).toBe(40);
  });

  it('a fighter kills an enemy that reaches it and the level is won', () => {
    const sim = createSim(level({ waves: oneGrunt() }), content, 1);
    sim.placeUnit('fighter', 1, 0);
    const events = run(sim, 10);
    expect(events).toContainEqual(expect.objectContaining({ type: 'enemy_died' }));
    expect(sim.state.enemies).toHaveLength(0);
    expect(sim.state.status).toBe('won');
    expect(events.filter((e) => e.type === 'won')).toHaveLength(1);
  });

  it('enemies destroy a unit and then keep advancing', () => {
    const waves = [{ at: 0, enemy: 'grunt', lane: 1, count: 3, gap: 0.5 }];
    const sim = createSim(level({ waves }), content, 1);
    sim.placeUnit('mayfly', 1, 3);
    const events = run(sim, 2.9);
    expect(events).toContainEqual(expect.objectContaining({ type: 'unit_died', cause: 'killed' }));
    expect(sim.state.units).toHaveLength(0);
    expect(Math.min(...sim.state.enemies.map((e) => e.pos))).toBeLessThan(4000);
  });
});

describe('outcome', () => {
  it('is lost when an enemy crosses the left edge, and then the sim freezes', () => {
    const sim = createSim(level({ waves: oneGrunt() }), content, 1);
    const events = run(sim, 6);
    expect(sim.state.status).toBe('lost');
    expect(events.filter((e) => e.type === 'lost')).toHaveLength(1);
    const frozen = structuredClone(sim.state);
    expect(sim.step()).toEqual([]);
    expect(sim.placeUnit('wall', 0, 0)).toEqual({ ok: false, reason: 'game_over' });
    expect(sim.state).toEqual(frozen);
  });

  it('is not won while waves are still pending', () => {
    const sim = createSim(level({ waves: [{ at: 3, enemy: 'grunt', lane: 1, count: 1, gap: 0 }] }), content, 1);
    run(sim, 2);
    expect(sim.state.status).toBe('playing');
  });
});

describe('determinism', () => {
  it('the same level, seed and commands produce identical states', () => {
    const play = () => {
      const waves = [{ at: 0, enemy: 'grunt', lane: 1, count: 4, gap: 1 }];
      const sim = createSim(level({ waves }), content, 7);
      sim.placeUnit('fighter', 1, 1);
      run(sim, 3);
      sim.placeUnit('wall', 1, 3);
      run(sim, 8);
      return sim.state;
    };
    expect(play()).toEqual(play());
  });
});
