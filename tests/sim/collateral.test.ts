import { describe, expect, it } from 'vitest';
import { createSim, secondsToTicks, type Content, type EnemyDef, type SignalDef, type Sim, type SimEvent, type UnitDef } from '../../src/sim';
import { content as base, grunt, level } from './fixtures';

/**
 * Engine rules for a damaging global meter (collateral harm, defeat), traps left on death and
 * enemies that spread around barriers. Neutral ids: these tests assert engine rules, not biology.
 */

function run(sim: Sim, seconds: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < secondsToTicks(seconds) && sim.state.status === 'playing'; i++) events.push(...sim.step());
  return events;
}

const bunker: UnitDef = { id: 'bunker', cost: 0, cooldown: 0, hp: 1_000_000 };
const tower: UnitDef = { id: 'tower', cost: 0, cooldown: 0, hp: 200, tags: ['shield'] };
const flyer: UnitDef = {
  id: 'flyer',
  cost: 0,
  cooldown: 0,
  hp: 1000,
  lifespan: 2,
  onDeath: { trap: { id: 'web', duration: 3, slow: 0.25, damage: 5, rate: 1, raises: { signal: 'heat', amount: 4 } } },
};
const stocked: UnitDef = { id: 'stocked', cost: 0, cooldown: 0, hp: 1_000_000, emits: { signal: 'alarm', capacity: 1000 } };
const creeper: EnemyDef = { ...grunt, id: 'creeper', spreads: { around: ['shield'] } };
const hopper: EnemyDef = { ...grunt, id: 'hopper', spreads: { around: ['shield'], maxSwitches: 1 } };

const alarm: SignalDef = { max: 100, decayPerSecond: 0, releasePerSecond: 20 };
const heat: SignalDef = {
  max: 100,
  decayPerSecond: 0,
  risesWith: { signal: 'alarm', perPoint: 0.5 },
  harm: [
    { from: 0.4, hpPercentPerSecond: 10 },
    { from: 0.8, hpPercentPerSecond: 20 },
  ],
  defeatAt: 1,
};
const content: Content = {
  units: [...base.units, bunker, tower, flyer, stocked],
  enemies: [grunt, creeper, hopper],
  signals: { alarm, heat },
};
const deck = ['bunker', 'tower', 'flyer', 'stocked', 'fighter', 'wall'];
const endless = { type: 'survive', seconds: 999 } as const;
const quiet = (signals = ['alarm', 'heat']) => createSim(level({ deck, signals, win: endless }), content, 1);
const unitOf = (sim: Sim, defId: string) => sim.state.units.find((u) => u.defId === defId)!;

describe('a meter that rises with another', () => {
  it('rises by perPoint for every point released into the signal it follows', () => {
    const sim = quiet();
    sim.placeUnit('stocked', 0, 0);
    unitOf(sim, 'stocked').charge = 1000 * 1000;
    sim.setReleasing(true);
    run(sim, 1);
    expect(sim.signal('alarm')).toBeCloseTo(0.2, 5);
    expect(sim.signal('heat')).toBeCloseTo(0.1, 5);
  });

  it('stays inert in a level that does not list it', () => {
    const sim = quiet(['alarm']);
    sim.placeUnit('stocked', 0, 0);
    unitOf(sim, 'stocked').charge = 1000 * 1000;
    sim.setReleasing(true);
    run(sim, 1);
    expect(sim.signal('alarm')).toBeCloseTo(0.2, 5);
    expect(sim.signal('heat')).toBe(0);
    expect(sim.state.signals.heat).toBeUndefined();
  });
});

describe('collateral harm', () => {
  it('does nothing below its threshold', () => {
    const sim = quiet();
    sim.placeUnit('tower', 0, 0);
    sim.state.signals.heat = 39_000;
    run(sim, 3);
    expect(unitOf(sim, 'tower').hp).toBe(200);
  });

  it('takes a share of max HP per second from every own unit at or above the threshold', () => {
    const sim = quiet();
    sim.placeUnit('tower', 0, 0);
    sim.placeUnit('wall', 2, 4);
    sim.state.signals.heat = 40_000;
    run(sim, 2);
    // 10 % of 200 HP per second, for two seconds.
    expect(unitOf(sim, 'tower').hp).toBeCloseTo(160, 5);
    expect(unitOf(sim, 'wall').hp).toBeCloseTo(160, 5);
  });

  it('applies only the highest tier reached, not the sum of the tiers below it', () => {
    const sim = quiet();
    sim.placeUnit('tower', 0, 0);
    sim.state.signals.heat = 80_000;
    run(sim, 2);
    // 20 % of 200 HP per second, for two seconds.
    expect(unitOf(sim, 'tower').hp).toBeCloseTo(120, 5);
  });

  it('removes units it brings to zero and reports them killed', () => {
    const sim = quiet();
    sim.placeUnit('tower', 0, 0);
    sim.state.signals.heat = 90_000;
    const events = run(sim, 11);
    expect(sim.state.units.some((u) => u.defId === 'tower')).toBe(false);
    expect(events).toContainEqual(expect.objectContaining({ type: 'unit_died', defId: 'tower', cause: 'killed' }));
  });
});

describe('defeat causes', () => {
  it('is lost when a meter reaches its defeatAt, with that signal as the cause', () => {
    const sim = quiet();
    sim.state.signals.heat = 100_000;
    const events = run(sim, 0.05);
    expect(sim.state.status).toBe('lost');
    expect(sim.state.defeat).toEqual({ type: 'signal', signal: 'heat' });
    expect(events).toContainEqual({ type: 'lost', cause: { type: 'signal', signal: 'heat' } });
  });

  it('a breach is reported as such', () => {
    const sim = createSim(level({ waves: [{ at: 0, enemy: 'grunt', lane: 1, count: 1, gap: 0 }] }), content, 1);
    const events = run(sim, 6);
    expect(sim.state.defeat).toEqual({ type: 'breach' });
    expect(events).toContainEqual({ type: 'lost', cause: { type: 'breach' } });
  });

  it('stays null while playing and after a win', () => {
    expect(quiet().state.defeat).toBeNull();
  });
});

describe('traps left on death', () => {
  const withEnemy = (lane = 1, signals = ['alarm', 'heat']) =>
    createSim(level({ deck, signals, win: endless, waves: [{ at: 0, enemy: 'grunt', lane, count: 1, gap: 0 }] }), content, 1);

  it('a dying unit lays its trap on its own cell, which lasts its duration', () => {
    const sim = quiet();
    sim.placeUnit('flyer', 2, 3);
    const events = run(sim, 2);
    expect(events).toContainEqual(expect.objectContaining({ type: 'unit_died', defId: 'flyer', row: 2, col: 3, cause: 'expired' }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'trap_laid', defId: 'web', row: 2, col: 3 }));
    expect(sim.state.traps).toHaveLength(1);
    run(sim, 2.95);
    expect(sim.state.traps).toHaveLength(1);
    run(sim, 0.1);
    expect(sim.state.traps).toHaveLength(0);
  });

  it('a unit killed by enemies lays it too', () => {
    const killable: UnitDef = { ...flyer, id: 'killable', hp: 5, lifespan: undefined };
    const sim = createSim(
      level({ deck: ['killable'], win: endless, signals: [], waves: [{ at: 0, enemy: 'grunt', lane: 1, count: 1, gap: 0 }] }),
      { ...content, units: [killable] },
      1,
    );
    sim.placeUnit('killable', 1, 3);
    const events = run(sim, 3);
    expect(events).toContainEqual(expect.objectContaining({ type: 'unit_died', defId: 'killable', cause: 'killed' }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'trap_laid', row: 1, col: 3 }));
  });

  it('slows and hurts the enemies crossing its cell', () => {
    const free = withEnemy();
    const trapped = withEnemy();
    trapped.placeUnit('flyer', 1, 3);
    run(free, 3);
    const events = run(trapped, 3);
    const [a, b] = [free.state.enemies[0]!, trapped.state.enemies[0]!];
    expect(b.pos).toBeGreaterThan(a.pos);
    expect(b.hp).toBeLessThan(40);
    expect(events.some((e) => e.type === 'trap_hit')).toBe(true);
  });

  it('hits at its rate, its damage each time', () => {
    const sim = withEnemy();
    sim.placeUnit('flyer', 1, 4);
    // The flyer holds the grunt in its cell and dies at second 2; slowed to a quarter, the grunt stays
    // in that cell for the whole trap: a hit when laid and one per second after, three in three seconds.
    const hits = run(sim, 6).filter((e) => e.type === 'trap_hit');
    expect(hits.length).toBe(3);
    expect(hits.every((e) => e.type === 'trap_hit' && e.damage === 5)).toBe(true);
  });

  it('raises its signal only where that signal is active', () => {
    const active = quiet();
    active.placeUnit('flyer', 0, 0);
    run(active, 2);
    expect(active.signal('heat')).toBeCloseTo(0.04, 5);
    const inactive = quiet(['alarm']);
    inactive.placeUnit('flyer', 0, 0);
    run(inactive, 2);
    expect(inactive.state.signals.heat).toBeUndefined();
    expect(inactive.state.traps).toHaveLength(1);
  });
});

describe('enemies that spread around barriers', () => {
  const spreadSim = (lane: number) =>
    createSim(level({ deck, signals: [], win: endless, waves: [{ at: 0, enemy: 'creeper', lane, count: 1, gap: 0 }] }), content, 1);

  it('move to a free neighbouring lane instead of attacking a tagged blocker', () => {
    const sim = spreadSim(1);
    sim.placeUnit('tower', 1, 3);
    sim.placeUnit('bunker', 0, 3);
    const events = run(sim, 2);
    expect(events).toContainEqual(expect.objectContaining({ type: 'enemy_switched_lane', from: 1, to: 2 }));
    expect(events.some((e) => e.type === 'enemy_attacked')).toBe(false);
    expect(unitOf(sim, 'tower').hp).toBe(200);
    run(sim, 1);
    expect(sim.state.enemies[0]!.lane).toBe(2);
    expect(sim.state.enemies[0]!.pos).toBeLessThan(4000);
  });

  it('on an edge lane take the only neighbour', () => {
    const sim = spreadSim(0);
    sim.placeUnit('tower', 0, 3);
    const events = run(sim, 2);
    expect(events).toContainEqual(expect.objectContaining({ type: 'enemy_switched_lane', from: 0, to: 1 }));
  });

  it('pick between two free neighbours with the seeded RNG, the same way every run', () => {
    const lanes = [1, 2, 3, 4, 5].map((seed) => {
      const sim = createSim(level({ deck, signals: [], win: endless, waves: [{ at: 0, enemy: 'creeper', lane: 1, count: 1, gap: 0 }] }), content, seed);
      sim.placeUnit('tower', 1, 3);
      run(sim, 2);
      return sim.state.enemies[0]!.lane;
    });
    expect(lanes.every((lane) => lane === 0 || lane === 2)).toBe(true);
    const again = createSim(level({ deck, signals: [], win: endless, waves: [{ at: 0, enemy: 'creeper', lane: 1, count: 1, gap: 0 }] }), content, 1);
    again.placeUnit('tower', 1, 3);
    run(again, 2);
    expect(again.state.enemies[0]!.lane).toBe(lanes[0]);
  });

  it('attack the barrier when every neighbour is blocked at that column', () => {
    const sim = spreadSim(0);
    sim.placeUnit('tower', 0, 3);
    sim.placeUnit('bunker', 1, 3);
    const events = run(sim, 3);
    expect(events.some((e) => e.type === 'enemy_switched_lane')).toBe(false);
    expect(unitOf(sim, 'tower').hp).toBeLessThan(200);
  });

  it('attack untagged blockers as usual', () => {
    const sim = spreadSim(1);
    sim.placeUnit('wall', 1, 3);
    const events = run(sim, 3);
    expect(events.some((e) => e.type === 'enemy_switched_lane')).toBe(false);
    expect(unitOf(sim, 'wall').hp).toBeLessThan(200);
  });

  /** A tagged blocker in lane 1 (lane 0 shut), then another one further on in lane 2. */
  const twoWalls = (enemy: string) => {
    const sim = createSim(level({ deck, signals: [], win: endless, waves: [{ at: 0, enemy, lane: 1, count: 1, gap: 0 }] }), content, 1);
    sim.placeUnit('tower', 1, 3);
    sim.placeUnit('bunker', 0, 3);
    sim.placeUnit('tower', 2, 1);
    return sim;
  };
  const towerIn = (sim: Sim, row: number) => sim.state.units.find((u) => u.defId === 'tower' && u.row === row)!;

  it('with maxSwitches 1 switch once, then attack the next tagged blocker like any enemy', () => {
    const sim = twoWalls('hopper');
    const events = run(sim, 6);
    expect(events.filter((e) => e.type === 'enemy_switched_lane')).toEqual([expect.objectContaining({ from: 1, to: 2 })]);
    expect(sim.state.enemies[0]!.lane).toBe(2);
    expect(towerIn(sim, 1).hp).toBe(200);
    expect(towerIn(sim, 2).hp).toBeLessThan(200);
  });

  it('without maxSwitches keep switching at every tagged blocker', () => {
    const sim = twoWalls('creeper');
    const events = run(sim, 6);
    expect(events.filter((e) => e.type === 'enemy_switched_lane').map((e) => e.type === 'enemy_switched_lane' && e.to)).toEqual([2, 1]);
    expect(towerIn(sim, 2).hp).toBe(200);
  });

  it('plain enemies never switch lanes', () => {
    const sim = createSim(level({ deck, signals: [], win: endless, waves: [{ at: 0, enemy: 'grunt', lane: 1, count: 1, gap: 0 }] }), content, 1);
    sim.placeUnit('tower', 1, 3);
    const events = run(sim, 3);
    expect(events.some((e) => e.type === 'enemy_switched_lane')).toBe(false);
    expect(unitOf(sim, 'tower').hp).toBeLessThan(200);
  });
});
