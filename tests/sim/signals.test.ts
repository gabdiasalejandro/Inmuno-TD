import { describe, expect, it } from 'vitest';
import { createSim, secondsToTicks, type Content, type EnemyDef, type Sim, type UnitDef } from '../../src/sim';
import { content as base, grunt, level } from './fixtures';

function run(sim: Sim, seconds: number): void {
  for (let i = 0; i < secondsToTicks(seconds); i++) sim.step();
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
const sentinel: UnitDef = {
  id: 'sentinel',
  cost: 0,
  cooldown: 0,
  hp: 60,
  emits: { signal: 'alarm', perSecond: 20, range: 2, requires: ['PAMP'] },
};
const siren: UnitDef = { ...sentinel, id: 'siren', emits: { ...sentinel.emits!, perSecond: 100_000 } };
const recruit: UnitDef = { id: 'recruit', cost: 0, cooldown: 4, hp: 10, tags: ['reserve'] };
const regular: UnitDef = { id: 'regular', cost: 0, cooldown: 4, hp: 10 };

const content: Content = {
  units: [...base.units, bunker, picky, sentinel, siren, recruit, regular],
  enemies: [grunt, marked],
  signals: {
    alarm: { max: 100, decayPerSecond: 10, marrowBoost: 1, recruitBoost: 1, recruitTag: 'reserve' },
  },
};
const deck = ['bunker', 'picky', 'sentinel', 'siren', 'recruit', 'regular', 'fighter'];
const wave = (enemy: string) => [{ at: 0, enemy, lane: 1, count: 1, gap: 0 }];
const setup = (enemy: string, emitter?: string) => {
  const sim = createSim(level({ deck, waves: wave(enemy), startEnergy: 0 }), content, 1);
  sim.placeUnit('bunker', 1, 2);
  if (emitter) sim.placeUnit(emitter, 1, 1);
  return sim;
};

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

describe('signals', () => {
  it('start at zero and stay there with nothing to detect', () => {
    const sim = setup('grunt', 'sentinel');
    run(sim, 6);
    expect(sim.signal('alarm')).toBe(0);
    expect(sim.state.units.find((u) => u.defId === 'sentinel')!.alarmed).toBe(false);
  });

  it('rise while an emitter detects a matching enemy in range, minus decay', () => {
    const sim = setup('marked', 'sentinel');
    run(sim, 1);
    expect(sim.signal('alarm')).toBe(0);
    run(sim, 2);
    // In range from second 1 (pos 4000): net +10 per second for 2 seconds, out of 100.
    expect(sim.signal('alarm')).toBeCloseTo(0.2, 2);
    expect(sim.state.units.find((u) => u.defId === 'sentinel')!.alarmed).toBe(true);
  });

  it('are capped at their maximum', () => {
    const sim = setup('marked', 'siren');
    run(sim, 5);
    expect(sim.signal('alarm')).toBe(1);
  });

  it('decay back to zero when detection stops', () => {
    const endless = { type: 'survive', seconds: 999 } as const;
    const sim = createSim(level({ deck, waves: wave('marked'), win: endless }), content, 1);
    sim.placeUnit('siren', 1, 1);
    sim.placeUnit('fighter', 1, 2);
    run(sim, 20);
    expect(sim.state.enemies).toHaveLength(0);
    expect(sim.signal('alarm')).toBe(0);
  });

  it('are inert in a level that does not list them', () => {
    const sim = createSim(level({ deck, waves: wave('marked'), signals: [] }), content, 1);
    sim.placeUnit('bunker', 1, 2);
    sim.placeUnit('siren', 1, 1);
    run(sim, 12);
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

  it('produces up to twice as fast while a boosting signal is at its maximum', () => {
    const calm = setup('grunt', 'siren');
    const alarmed = setup('marked', 'siren');
    run(calm, 22);
    run(alarmed, 22);
    expect(calm.state.energy).toBe(100);
    // Saturated from second 1 on: 21 seconds at double speed plus 1 calm second is 8 batches.
    expect(alarmed.state.energy).toBeGreaterThanOrEqual(200);
    expect(alarmed.state.energy).toBeLessThanOrEqual(225);
  });
});

describe('recruitment', () => {
  it('shortens the redeploy cooldown of tagged units while the signal is high', () => {
    const sim = setup('marked', 'siren');
    run(sim, 5);
    sim.placeUnit('recruit', 0, 0);
    sim.placeUnit('regular', 0, 1);
    run(sim, 2);
    expect(sim.placeUnit('recruit', 0, 2)).toEqual({ ok: true });
    expect(sim.placeUnit('regular', 0, 3)).toEqual({ ok: false, reason: 'on_cooldown' });
  });

  it('leaves cooldowns alone while the signal is at zero', () => {
    const sim = setup('grunt', 'siren');
    sim.placeUnit('recruit', 0, 0);
    run(sim, 2);
    expect(sim.placeUnit('recruit', 0, 2)).toEqual({ ok: false, reason: 'on_cooldown' });
  });
});
