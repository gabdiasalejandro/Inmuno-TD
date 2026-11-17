import { describe, expect, it } from 'vitest';
import { createSim, secondsToTicks, type Content, type EnemyDef, type LevelDef, type Sim, type SimEvent, type StatusDef, type UnitDef } from '../../src/sim';
import { content as base, grunt, level } from './fixtures';

/**
 * Engine rules for unit statuses: an enemy that marks the cell it reaches instead of attacking it,
 * a mark that bursts into new enemies when it runs out, a shared ward that keeps neighbours from
 * being marked, and a unit that only attacks marked own units. Neutral ids: engine rules only.
 */

function run(sim: Sim, seconds: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < secondsToTicks(seconds) && sim.state.status === 'playing'; i++) events.push(...sim.step());
  return events;
}

const marked: StatusDef = { duration: 2, burst: { enemy: 'spore', min: 2, max: 2 }, shares: { status: 'warded', radius: 1 } };
const warded: StatusDef = { duration: 3, prevents: ['marked'] };

const post: UnitDef = { id: 'post', cost: 0, cooldown: 0, hp: 1_000_000, tags: ['cell'] };
const stone: UnitDef = { id: 'stone', cost: 0, cooldown: 0, hp: 1_000_000 };
const hunter: UnitDef = {
  id: 'hunter',
  cost: 0,
  cooldown: 0,
  hp: 1_000_000,
  attack: { type: 'strike', damage: 10_000_000, rate: 1, range: 1, targets: 'own', status: ['marked'] },
};
const eater: UnitDef = { id: 'eater', cost: 0, cooldown: 0, hp: 1_000_000, attack: { type: 'melee', damage: 100, rate: 10, range: 1 } };
const spore: EnemyDef = { ...grunt, id: 'spore', hp: 10, speed: 1, infects: { status: 'marked', requires: ['cell'] } };

const content: Content = {
  units: [...base.units, post, stone, hunter, eater],
  enemies: [grunt, spore],
  statuses: { marked, warded },
};
const deck = ['post', 'stone', 'hunter', 'eater'];
const endless = { type: 'survive', seconds: 999 } as const;

/** Three lanes of five columns; one spore enters lane 1 at the start unless told otherwise. */
function sim(overrides: Partial<LevelDef> = {}): Sim {
  return createSim(
    level({ deck, win: endless, waves: [{ at: 0, enemy: 'spore', lane: 1, count: 1, gap: 0 }], marrow: { amount: 0, interval: 5 }, ...overrides }),
    content,
    1,
  );
}

const unitAt = (s: Sim, row: number, col: number) => s.state.units.find((u) => u.row === row && u.col === col);
const has = (s: Sim, row: number, col: number, status: string): boolean => (unitAt(s, row, col)?.statuses[status] ?? 0) > s.state.tick;

describe('an enemy that infects instead of attacking', () => {
  it('marks the first cell it reaches and is consumed, without attacking it', () => {
    const s = sim();
    s.placeUnit('post', 1, 2);
    const events = run(s, 3);
    expect(has(s, 1, 2, 'marked')).toBe(true);
    expect(s.state.enemies).toHaveLength(0);
    expect(events.some((e) => e.type === 'enemy_consumed')).toBe(true);
    expect(events.some((e) => e.type === 'enemy_attacked')).toBe(false);
    expect(events.some((e) => e.type === 'enemy_died')).toBe(false);
    expect(unitAt(s, 1, 2)!.hp).toBe(1_000_000);
  });

  it('attacks a blocking unit without the required tag like any enemy', () => {
    const s = sim();
    s.placeUnit('stone', 1, 2);
    const events = run(s, 4);
    expect(events.some((e) => e.type === 'enemy_attacked')).toBe(true);
    expect(s.state.enemies).toHaveLength(1);
  });

  it('can be killed by an ordinary attacker before it reaches anything', () => {
    const s = sim();
    s.placeUnit('eater', 1, 0);
    const events = run(s, 6);
    expect(events.some((e) => e.type === 'enemy_died')).toBe(true);
    expect(s.state.status).toBe('playing');
  });
});

describe('a status that bursts when it runs out', () => {
  it('kills the cell after its duration and releases new enemies into its lane and the neighbour lanes', () => {
    const s = sim();
    s.placeUnit('post', 1, 2);
    run(s, 2.2);
    expect(has(s, 1, 2, 'marked')).toBe(true);
    const events = run(s, 2);
    expect(unitAt(s, 1, 2)).toBeUndefined();
    expect(events.some((e) => e.type === 'unit_died' && e.row === 1 && e.col === 2)).toBe(true);
    const burst = events.find((e) => e.type === 'status_burst');
    expect(burst).toMatchObject({ type: 'status_burst', status: 'marked', row: 1, col: 2 });
    const released = events.filter((e) => e.type === 'enemy_spawned');
    expect(released).toHaveLength(2);
    // The first goes into the burst cell's own lane, the others into neighbour lanes.
    expect(released.map((e) => (e.type === 'enemy_spawned' ? e.lane : -1))[0]).toBe(1);
    for (const e of released) if (e.type === 'enemy_spawned') expect([0, 1, 2]).toContain(e.lane);
  });

  it('is deterministic for a given seed', () => {
    const lanes = () => {
      const s = sim();
      s.placeUnit('post', 1, 2);
      return run(s, 5).flatMap((e) => (e.type === 'enemy_spawned' ? [e.lane] : []));
    };
    expect(lanes()).toEqual(lanes());
  });

  it('keeps a clear level from being won while a marked cell is still to burst', () => {
    const s = createSim(
      level({ deck, waves: [{ at: 0, enemy: 'spore', lane: 1, count: 1, gap: 0 }], marrow: { amount: 0, interval: 5 } }),
      content,
      1,
    );
    s.placeUnit('post', 1, 2);
    run(s, 3);
    expect(s.state.enemies).toHaveLength(0);
    expect(s.state.status).toBe('playing');
  });
});

describe('a status shared with the neighbours', () => {
  it('wards the own units around a newly marked cell (8-neighbourhood) for its duration, not farther ones', () => {
    const s = sim();
    s.placeUnit('post', 1, 2);
    s.placeUnit('post', 0, 3);
    s.placeUnit('post', 2, 1);
    s.placeUnit('post', 1, 0);
    run(s, 2.2);
    expect(has(s, 1, 2, 'marked')).toBe(true);
    expect(has(s, 1, 2, 'warded')).toBe(false);
    expect(has(s, 0, 3, 'warded')).toBe(true);
    expect(has(s, 2, 1, 'warded')).toBe(true);
    expect(has(s, 1, 0, 'warded')).toBe(false);
  });

  it('a warded cell cannot be marked: the spore walks on through it', () => {
    const s = sim({ waves: [{ at: 0, enemy: 'spore', lane: 1, count: 1, gap: 0 }, { at: 0, enemy: 'spore', lane: 0, count: 1, gap: 0 }] });
    // Lane 0 is reached first: its cell (0,2) gets marked and wards (1,3) before the lane-1 spore arrives.
    s.placeUnit('post', 0, 3);
    s.placeUnit('post', 1, 2);
    run(s, 2.2);
    expect(has(s, 0, 3, 'marked')).toBe(true);
    expect(has(s, 1, 2, 'warded')).toBe(true);
    run(s, 1);
    expect(has(s, 1, 2, 'marked')).toBe(false);
    // The lane-1 spore went through the warded cell and keeps walking toward the base.
    expect(s.state.enemies.some((e) => e.lane === 1 && e.pos < 2000)).toBe(true);
  });

  it('a spore that is lost on resisting cells is used up on a warded cell without marking it', () => {
    const lost: Content = { ...content, enemies: content.enemies.map((e) => (e.id === 'spore' ? { ...spore, infects: { ...spore.infects!, resisted: 'lost' as const } } : e)) };
    const s = createSim(
      level({
        deck,
        win: endless,
        marrow: { amount: 0, interval: 5 },
        waves: [{ at: 0, enemy: 'spore', lane: 1, count: 1, gap: 0 }, { at: 0, enemy: 'spore', lane: 0, count: 1, gap: 0 }],
      }),
      lost,
      1,
    );
    s.placeUnit('post', 0, 3);
    s.placeUnit('post', 1, 2);
    const events = run(s, 2.5);
    expect(has(s, 1, 2, 'warded')).toBe(true);
    expect(has(s, 1, 2, 'marked')).toBe(false);
    expect(events.filter((e) => e.type === 'enemy_consumed')).toHaveLength(2);
    expect(s.state.enemies).toHaveLength(0);
  });

  it('wears off after its duration', () => {
    const s = sim();
    s.placeUnit('post', 1, 2);
    s.placeUnit('post', 0, 2);
    run(s, 2.2);
    expect(has(s, 0, 2, 'warded')).toBe(true);
    run(s, 3.2);
    expect(has(s, 0, 2, 'warded')).toBe(false);
  });
});

describe('a unit that attacks marked own units', () => {
  it('kills a marked cell within its radius before it bursts, so nothing is released', () => {
    const s = sim();
    s.placeUnit('post', 1, 2);
    s.placeUnit('hunter', 0, 1);
    const events = run(s, 5);
    expect(unitAt(s, 1, 2)).toBeUndefined();
    expect(events.some((e) => e.type === 'cell_attacked')).toBe(true);
    expect(events.some((e) => e.type === 'status_burst')).toBe(false);
    expect(events.filter((e) => e.type === 'enemy_spawned')).toHaveLength(1);
  });

  it('never attacks unmarked own units nor enemies', () => {
    const s = sim();
    s.placeUnit('hunter', 1, 1);
    s.placeUnit('stone', 1, 2);
    const events = run(s, 4);
    expect(events.some((e) => e.type === 'unit_attacked' || e.type === 'cell_attacked')).toBe(false);
    expect(s.state.enemies).toHaveLength(1);
    expect(unitAt(s, 1, 2)!.hp).toBeLessThan(1_000_000);
  });

  it('does not reach a marked cell outside its radius', () => {
    const s = sim();
    s.placeUnit('post', 1, 2);
    s.placeUnit('hunter', 0, 4);
    const events = run(s, 3);
    expect(events.some((e) => e.type === 'cell_attacked')).toBe(false);
  });
});
