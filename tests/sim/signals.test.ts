import { describe, expect, it } from 'vitest';
import { createSim, secondsToTicks, type Content, type EnemyDef, type SignalDef, type Sim, type SimEvent, type UnitDef } from '../../src/sim';
import { content as base, grunt, level } from './fixtures';

function run(sim: Sim, seconds: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < secondsToTicks(seconds); i++) events.push(...sim.step());
  return events;
}

const marked: EnemyDef = { ...grunt, id: 'marked', tags: ['PAMP'] };
const bunker: UnitDef = { id: 'bunker', cost: 0, cooldown: 0, hp: 1_000_000 };
const picky: UnitDef = {
  id: 'picky',
  cost: 0,
  cooldown: 0,
  hp: 60,
  attack: { type: 'melee', damage: 20, rate: 1, range: 1, requires: ['PAMP'] },
};
/** Stores up to 30 points of `alarm`, 15 per second while it detects a PAMP: full in 2 seconds. */
const sentinel: UnitDef = {
  id: 'sentinel',
  cost: 0,
  cooldown: 0,
  hp: 60,
  emits: { signal: 'alarm', capacity: 30, perSecond: 15, range: 2, requires: ['PAMP'] },
};
/** Stores up to 100 points, 50 per second. */
const siren: UnitDef = { ...sentinel, id: 'siren', emits: { ...sentinel.emits!, capacity: 100, perSecond: 50 } };
/** Never detects; stores 1 point per hit point of damage it takes, up to 20. */
const padded: UnitDef = { id: 'padded', cost: 0, cooldown: 0, hp: 1000, emits: { signal: 'alarm', capacity: 20, perDamage: 1 } };
const recruit: UnitDef = { id: 'recruit', cost: 0, cooldown: 4, hp: 10, tags: ['reserve'] };
const regular: UnitDef = { id: 'regular', cost: 0, cooldown: 4, hp: 10 };

const alarm: SignalDef = {
  max: 100,
  decayPerSecond: 2,
  releasePerSecond: 20,
  storeDecayPerSecond: 5,
  marrowBoost: 1,
  recruitBoost: 1,
  recruitTag: 'reserve',
  fromWounds: { capacity: 4, perSecond: 2 },
};
const withAlarm = (overrides: Partial<SignalDef> = {}): Content => ({
  units: [...base.units, bunker, picky, sentinel, siren, padded, recruit, regular],
  enemies: [grunt, marked],
  signals: { alarm: { ...alarm, ...overrides } },
});
const content = withAlarm();
/** No decay at all, so amounts can be checked exactly. */
const still = withAlarm({ decayPerSecond: 0, storeDecayPerSecond: 0 });
const deck = ['bunker', 'picky', 'sentinel', 'siren', 'padded', 'recruit', 'regular', 'fighter'];
const wave = (enemy: string) => [{ at: 0, enemy, lane: 1, count: 1, gap: 0 }];
const setup = (enemy: string, emitter?: string, rules: Content = content) => {
  const sim = createSim(level({ deck, waves: wave(enemy), startEnergy: 0 }), rules, 1);
  sim.placeUnit('bunker', 1, 2);
  if (emitter) sim.placeUnit(emitter, 1, 1);
  return sim;
};
/** A board with no enemies and sentinels holding the given charges (points), for exact pool checks. */
const stocked = (charges: number[], rules: Content = still) => {
  const endless = { type: 'survive', seconds: 999 } as const;
  const sim = createSim(level({ deck, startEnergy: 0, win: endless }), rules, 1);
  charges.forEach((points, i) => {
    sim.placeUnit('sentinel', i % 3, Math.floor(i / 3));
    sim.state.units[sim.state.units.length - 1]!.charge = points * 1000;
  });
  return sim;
};
const unitOf = (sim: Sim, defId: string) => sim.state.units.find((u) => u.defId === defId)!;
const unitSource = (sim: Sim, defId: string) => ({ kind: 'unit', uid: unitOf(sim, defId).uid }) as const;
const points = (sim: Sim): number[] => sim.state.units.map((u) => u.charge / 1000);

describe('attack requirements', () => {
  it('ignores enemies that lack a required tag and attacks those that have it', () => {
    for (const [enemy, expectHit] of [['grunt', false], ['marked', true]] as const) {
      const sim = createSim(level({ deck, waves: wave(enemy) }), content, 1);
      sim.placeUnit('picky', 1, 2);
      run(sim, 4);
      const survivor = sim.state.enemies[0];
      // A dead enemy is gone from the state, which also counts as having been hit.
      expect(!survivor || survivor.hp < 40).toBe(expectHit);
    }
  });

  it('units without requirements still attack anything', () => {
    const sim = createSim(level({ deck, waves: wave('grunt') }), content, 1);
    sim.placeUnit('fighter', 1, 2);
    run(sim, 1.5);
    expect(sim.state.enemies[0]!.hp).toBeLessThan(40);
  });
});

describe('signal sources: charge', () => {
  it('do not charge with nothing to detect', () => {
    const sim = setup('grunt', 'sentinel');
    run(sim, 6);
    expect(sim.charge(unitSource(sim, 'sentinel'))).toBe(0);
    expect(unitOf(sim, 'sentinel').alarmed).toBe(false);
  });

  it('charge at their rate while they detect a matching enemy, without raising the meter on their own', () => {
    const sim = setup('marked', 'sentinel');
    run(sim, 1);
    expect(sim.charge(unitSource(sim, 'sentinel'))).toBe(0);
    run(sim, 1);
    // In range from second 1 (pos 4000): one second at 15 points of a 30-point capacity.
    expect(sim.charge(unitSource(sim, 'sentinel'))).toBeCloseTo(0.5, 1);
    expect(unitOf(sim, 'sentinel').alarmed).toBe(true);
    run(sim, 5);
    expect(sim.charge(unitSource(sim, 'sentinel'))).toBe(1);
    expect(sim.stored('alarm')).toBe(30);
    expect(sim.signal('alarm')).toBe(0);
  });

  it('report null for things that are not sources', () => {
    const sim = setup('marked', 'sentinel');
    expect(sim.charge({ kind: 'unit', uid: unitOf(sim, 'bunker').uid })).toBeNull();
    expect(sim.charge({ kind: 'unit', uid: 999 })).toBeNull();
    // Without wounds every lane is open from the start, but none of them is a wound.
    expect(sim.charge({ kind: 'wound', lane: 1 })).toBeNull();
  });

  it('pool the charge of every source of the signal', () => {
    expect(stocked([30, 10, 5]).stored('alarm')).toBe(45);
    expect(stocked([]).stored('alarm')).toBe(0);
    expect(stocked([30]).stored('nope')).toBe(0);
  });
});

describe('signal sources: charge from damage', () => {
  it('a unit with perDamage stores charge in proportion to the damage it takes, up to its capacity', () => {
    const sim = setup('grunt', undefined, still);
    sim.placeUnit('padded', 1, 3);
    run(sim, 2.5);
    // The grunt (10 damage a hit) reached the padded unit at second 1 and has hit it once or twice.
    const hits = 1000 - unitOf(sim, 'padded').hp;
    expect(hits).toBeGreaterThan(0);
    expect(sim.stored('alarm')).toBe(hits);
    expect(unitOf(sim, 'padded').alarmed).toBe(false);
    run(sim, 5);
    expect(sim.charge(unitSource(sim, 'padded'))).toBe(1);
    expect(sim.stored('alarm')).toBe(20);
  });

  it('is inert without the signal (level 1-2 case)', () => {
    const sim = createSim(level({ deck, waves: wave('grunt'), signals: [] }), content, 1);
    sim.placeUnit('padded', 1, 3);
    run(sim, 5);
    expect(sim.charge(unitSource(sim, 'padded'))).toBeNull();
    expect(sim.stored('alarm')).toBe(0);
  });
});

describe('holding the release', () => {
  it('drains the pool into the meter at a steady rate while held, and stops when let go', () => {
    const sim = stocked([30]);
    sim.setReleasing(true);
    run(sim, 0.5);
    expect(sim.signal('alarm')).toBeCloseTo(0.1, 5);
    expect(sim.stored('alarm')).toBeCloseTo(20, 5);
    sim.setReleasing(false);
    run(sim, 1);
    expect(sim.signal('alarm')).toBeCloseTo(0.1, 5);
    expect(sim.stored('alarm')).toBeCloseTo(20, 5);
  });

  it('never releases more than the pooled charge', () => {
    const sim = stocked([3, 2]);
    sim.setReleasing(true);
    run(sim, 3);
    expect(sim.signal('alarm')).toBeCloseTo(0.05, 5);
    expect(sim.stored('alarm')).toBe(0);
  });

  it('releases nothing with an empty pool', () => {
    const sim = stocked([0]);
    sim.setReleasing(true);
    expect(run(sim, 2).some((e) => e.type === 'signal_released')).toBe(false);
    expect(sim.signal('alarm')).toBe(0);
  });

  it('takes from every source in proportion to what it holds', () => {
    const sim = stocked([30, 10]);
    sim.setReleasing(true);
    run(sim, 0.5);
    const [a, b] = points(sim);
    expect(a).toBeCloseTo(22.5, 1);
    expect(b).toBeCloseTo(7.5, 1);
    expect(a! + b!).toBeCloseTo(30, 5);
  });

  it('more charged cells fill the meter higher', () => {
    const one = stocked([30]);
    const three = stocked([30, 30, 30]);
    for (const sim of [one, three]) {
      sim.setReleasing(true);
      run(sim, 10);
    }
    expect(one.signal('alarm')).toBeCloseTo(0.3, 5);
    expect(three.signal('alarm')).toBeCloseTo(0.9, 5);
  });

  it('stops at the meter maximum and keeps the rest stored', () => {
    const sim = stocked([30, 30, 30, 30]);
    sim.setReleasing(true);
    run(sim, 10);
    expect(sim.signal('alarm')).toBe(1);
    expect(sim.stored('alarm')).toBeCloseTo(20, 5);
  });

  it('reports every released amount, and keeps a running total for later mechanics', () => {
    const sim = stocked([12]);
    sim.setReleasing(true);
    const released = run(sim, 2).flatMap((e) => (e.type === 'signal_released' ? [e] : []));
    expect(released.every((e) => e.signal === 'alarm' && e.amount > 0)).toBe(true);
    expect(released.reduce((sum, e) => sum + e.amount, 0)).toBeCloseTo(12, 5);
    expect(sim.state.released.alarm).toBe(12_000);
  });

  it('keeps charging sources topped up while held: generation and release both flow', () => {
    const sim = setup('marked', 'sentinel', still);
    run(sim, 4);
    sim.setReleasing(true);
    run(sim, 2);
    // Two seconds at 20/s drained against 15/s still generated: the meter got the full 40.
    expect(sim.signal('alarm')).toBeCloseTo(0.4, 5);
    expect(sim.stored('alarm')).toBeGreaterThan(18);
    expect(sim.stored('alarm')).toBeLessThan(22);
  });

  it('is deterministic: the same holds give the same state', () => {
    const play = () => {
      const sim = setup('marked', 'sentinel');
      for (let s = 0; s < 12; s++) {
        sim.setReleasing(s % 3 === 0);
        run(sim, 1);
      }
      return sim.state;
    };
    expect(play()).toEqual(play());
  });
});

describe('decay', () => {
  it('the meter decays slowly back to zero', () => {
    const sim = stocked([30], withAlarm({ storeDecayPerSecond: 0 }));
    sim.setReleasing(true);
    run(sim, 1.5);
    sim.setReleasing(false);
    const top = sim.signal('alarm');
    run(sim, 1);
    expect(sim.signal('alarm')).toBeCloseTo(top - 0.02, 3);
    run(sim, 20);
    expect(sim.signal('alarm')).toBe(0);
  });

  it('stored charge decays once a source has gone a second without gaining any', () => {
    const sim = stocked([30], withAlarm({ decayPerSecond: 0 }));
    run(sim, 0.95);
    expect(sim.stored('alarm')).toBe(30);
    run(sim, 2.05);
    // Idle for 3 seconds: 2 of them decaying at 5 points a second.
    expect(sim.stored('alarm')).toBeCloseTo(20, 0);
    run(sim, 10);
    expect(sim.stored('alarm')).toBe(0);
  });

  it('a source that keeps generating does not decay', () => {
    const sim = setup('marked', 'sentinel');
    run(sim, 6);
    expect(sim.stored('alarm')).toBe(30);
  });
});

describe('wounds as signal sources', () => {
  const wounded = (signals?: string[]) =>
    createSim(level({ deck, startEnergy: 0, wounds: [{ at: 1, lane: 2 }], signals }), content, 1);

  it('charge a little while open and their charge joins the pool', () => {
    const sim = wounded();
    run(sim, 1);
    expect(sim.charge({ kind: 'wound', lane: 2 })).toBeNull();
    run(sim, 1);
    expect(sim.charge({ kind: 'wound', lane: 2 })).toBeCloseTo(0.5, 1);
    run(sim, 5);
    expect(sim.charge({ kind: 'wound', lane: 2 })).toBe(1);
    expect(sim.stored('alarm')).toBe(4);
    sim.setReleasing(true);
    run(sim, 0.1);
    expect(sim.stored('alarm')).toBeLessThan(4);
    expect(sim.signal('alarm')).toBeGreaterThan(0);
  });

  it('are not sources while the lane is closed', () => {
    const sim = wounded();
    run(sim, 5);
    expect(sim.charge({ kind: 'wound', lane: 0 })).toBeNull();
  });

  it('are inert in a level without a signal that wounds feed (level 1-2 case)', () => {
    const sim = wounded([]);
    run(sim, 5);
    expect(sim.charge({ kind: 'wound', lane: 2 })).toBeNull();
    expect(sim.stored('alarm')).toBe(0);
  });
});

describe('signals', () => {
  it('are inert in a level that does not list them', () => {
    const sim = createSim(level({ deck, waves: wave('marked'), signals: [] }), content, 1);
    sim.placeUnit('bunker', 1, 2);
    sim.placeUnit('siren', 1, 1);
    sim.setReleasing(true);
    run(sim, 12);
    expect(sim.charge(unitSource(sim, 'siren'))).toBeNull();
    expect(unitOf(sim, 'siren').alarmed).toBe(false);
    expect(sim.signal('alarm')).toBe(0);
    expect(sim.state.energy).toBe(150);
  });

  it('report 0 for unknown signals', () => {
    expect(setup('grunt').signal('nope')).toBe(0);
  });
});

describe('marrow', () => {
  it('reports its progress toward the next batch', () => {
    const sim = createSim(level({ deck }), content, 1);
    expect(sim.marrowFraction()).toBe(0);
    run(sim, 2.5);
    expect(sim.marrowFraction()).toBeCloseTo(0.5, 5);
    run(sim, 2.5);
    expect(sim.marrowFraction()).toBe(0);
    expect(sim.state.energy).toBe(125);
  });

  it('produces faster while the player releases a boosting signal, and only then', () => {
    const released = setup('marked', 'siren');
    const kept = setup('marked', 'siren');
    run(released, 3);
    run(kept, 3);
    released.setReleasing(true);
    run(released, 12);
    run(kept, 12);
    // 15 seconds: 3 batches at base speed; the meter the player fills adds at least one more.
    expect(kept.state.energy).toBe(75);
    expect(released.state.energy).toBeGreaterThanOrEqual(100);
  });
});

describe('recruitment', () => {
  it('shortens the redeploy cooldown of tagged units while the signal is high', () => {
    const sim = stocked([30, 30, 30, 30]);
    sim.setReleasing(true);
    run(sim, 5);
    sim.placeUnit('recruit', 2, 4);
    sim.placeUnit('regular', 2, 3);
    run(sim, 2);
    expect(sim.placeUnit('recruit', 0, 4)).toEqual({ ok: true });
    expect(sim.placeUnit('regular', 1, 4)).toEqual({ ok: false, reason: 'on_cooldown' });
  });

  it('leaves cooldowns alone while the signal is at zero', () => {
    const sim = stocked([30]);
    sim.placeUnit('recruit', 2, 4);
    run(sim, 2);
    expect(sim.placeUnit('recruit', 0, 4)).toEqual({ ok: false, reason: 'on_cooldown' });
  });
});
