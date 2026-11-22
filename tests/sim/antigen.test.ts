import { describe, expect, it } from 'vitest';
import { createSim, secondsToTicks, type Content, type LevelDef, type Sim, type SimEvent, type UnitDef } from '../../src/sim';
import { content as base, level } from './fixtures';

/** A unit that neither attacks nor blocks and picks up antigen from enemies dying around it. */
const scout: UnitDef = { id: 'scout', cost: 10, cooldown: 0, hp: 50, blocks: false, collects: { radius: 1, capacity: 2, speed: 2 } };
/** A fighter that kills a grunt with one hit as soon as it is in range. */
const sniper: UnitDef = { id: 'sniper', cost: 10, cooldown: 0, hp: 500, attack: { type: 'melee', damage: 100, rate: 1, range: 1 } };
const content: Content = { ...base, units: [...base.units, scout, sniper] };

function setup(overrides: Partial<LevelDef> = {}): Sim {
  return createSim(
    level({ grid: { rows: 3, cols: 8 }, startEnergy: 1000, deck: ['scout', 'sniper', 'wall'], ...overrides }),
    content,
    1,
  );
}

function run(sim: Sim, seconds: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < secondsToTicks(seconds) && sim.state.status === 'playing'; i++) events.push(...sim.step());
  return events;
}

const grunts = (at: number, lane: number, count = 1, gap = 1) => ({ at, enemy: 'grunt', lane, count, gap });

describe('antigen pickup', () => {
  it('a collecting unit takes one antigen per enemy that dies in a cell around it, and none from a far one', () => {
    const sim = setup({ waves: [grunts(0, 1), grunts(0, 2)], win: { type: 'survive', seconds: 99 } });
    // Both grunts die at the sniper's reach (column 6); only the lane-1 one is next to the scout.
    sim.placeUnit('sniper', 1, 5);
    sim.placeUnit('sniper', 2, 5);
    sim.placeUnit('scout', 0, 6);
    const events = run(sim, 4);
    expect(events.filter((e) => e.type === 'enemy_died')).toHaveLength(2);
    expect(events.filter((e) => e.type === 'antigen_taken')).toHaveLength(1);
    expect(sim.state.units.find((u) => u.defId === 'scout')!.antigen).toBe(1);
  });

  it('does not stop enemies: a grunt walks through the cell of a collecting unit', () => {
    const sim = setup({ waves: [grunts(0, 0)], win: { type: 'survive', seconds: 99 } });
    sim.placeUnit('scout', 0, 6);
    const events = run(sim, 3);
    expect(events.some((e) => e.type === 'enemy_attacked')).toBe(false);
    expect(sim.state.enemies[0]!.pos).toBeLessThan(6000);
  });
});

describe('migration to the lymph node', () => {
  function loaded(): { sim: Sim; events: SimEvent[] } {
    const sim = setup({ waves: [grunts(0, 1, 2, 1)], win: { type: 'survive', seconds: 99 } });
    sim.placeUnit('sniper', 1, 5);
    sim.placeUnit('scout', 0, 6);
    return { sim, events: run(sim, 5) };
  }

  it('leaves its cell once full and walks along its lane, carrying the antigen', () => {
    const { sim, events } = loaded();
    const left = events.find((e) => e.type === 'unit_migrated');
    expect(left).toMatchObject({ row: 0, col: 6, antigen: 2 });
    expect(sim.state.units.some((u) => u.defId === 'scout')).toBe(false);
    expect(sim.placeUnit('wall', 0, 6)).toEqual({ ok: true });
  });

  it('delivers its whole load at the left edge after walking there at its speed, and is gone', () => {
    const sim = setup({ waves: [grunts(0, 1, 2, 1)], win: { type: 'survive', seconds: 99 } });
    sim.placeUnit('sniper', 1, 5);
    sim.placeUnit('scout', 0, 6);
    const tickOf: Record<string, number> = {};
    const seen: SimEvent[] = [];
    for (let i = 0; i < secondsToTicks(10); i++) {
      for (const event of sim.step()) {
        tickOf[event.type] ??= sim.state.tick;
        seen.push(event);
      }
      if (tickOf.unit_migrated !== undefined && tickOf.antigen_delivered === undefined) expect(sim.state.couriers).toHaveLength(1);
    }
    expect(seen.find((e) => e.type === 'antigen_delivered')).toMatchObject({ row: 0, amount: 2 });
    // Six cells at two cells per second: three seconds of walking.
    expect(tickOf.antigen_delivered! - tickOf.unit_migrated!).toBe(secondsToTicks(3));
    expect(sim.state.antigenDelivered).toBe(2);
    expect(sim.state.couriers).toHaveLength(0);
  });
});

describe('antigen win condition', () => {
  it('is not won by clearing the board without delivered antigen', () => {
    const sim = setup({ waves: [grunts(0, 1)], win: { type: 'antigen', count: 2 } });
    sim.placeUnit('sniper', 1, 5);
    run(sim, 10);
    expect(sim.state.enemies).toHaveLength(0);
    expect(sim.state.status).toBe('playing');
  });

  it('is won once enough antigen reached the edge and the board is clear', () => {
    const sim = setup({ waves: [grunts(0, 1, 2, 1)], win: { type: 'antigen', count: 2 } });
    sim.placeUnit('sniper', 1, 5);
    sim.placeUnit('scout', 0, 6);
    run(sim, 15);
    expect(sim.state.antigenDelivered).toBe(2);
    expect(sim.state.status).toBe('won');
  });
});

describe('a returning pathogen', () => {
  const waves = [grunts(0, 1), grunts(10, 2)];

  it('repeats the waves from `from` once the board is clear while antigen is still missing', () => {
    const sim = setup({ waves, win: { type: 'antigen', count: 2 }, returns: { from: 10, after: 3 } });
    sim.placeUnit('sniper', 1, 5);
    sim.placeUnit('sniper', 2, 5);
    const events = run(sim, 40);
    const returned = events.filter((e) => e.type === 'pathogen_returned');
    expect(returned.length).toBeGreaterThanOrEqual(2);
    expect(returned[0]).toMatchObject({ count: 1 });
    // Only the lane-2 wave comes back: it is the one at or after `from`.
    const lanes = events.filter((e) => e.type === 'enemy_spawned').map((e) => (e as { lane: number }).lane);
    expect(lanes.slice(0, 2)).toEqual([1, 2]);
    expect(new Set(lanes.slice(2))).toEqual(new Set([2]));
    expect(sim.state.status).toBe('playing');
  });

  it('does not come back once the antigen needed is delivered or on its way', () => {
    const sim = setup({ waves: [grunts(0, 1, 2, 1)], win: { type: 'antigen', count: 2 }, returns: { from: 0, after: 3 } });
    sim.placeUnit('sniper', 1, 5);
    sim.placeUnit('scout', 0, 6);
    const events = run(sim, 20);
    expect(events.some((e) => e.type === 'pathogen_returned')).toBe(false);
    expect(sim.state.status).toBe('won');
  });

  it('each return raises a chronic floor of a signal that its decay cannot go under', () => {
    const signals = { harm: { max: 100, decayPerSecond: 50, defeatAt: 1 } };
    const sim = createSim(
      level({
        grid: { rows: 3, cols: 8 },
        startEnergy: 1000,
        deck: ['sniper'],
        waves,
        win: { type: 'antigen', count: 2 },
        returns: { from: 10, after: 3, chronic: { signal: 'harm', points: 30 } },
      }),
      { ...content, signals },
      1,
    );
    sim.placeUnit('sniper', 1, 5);
    sim.placeUnit('sniper', 2, 5);
    const events = run(sim, 16);
    const returned = events.filter((e) => e.type === 'pathogen_returned').length;
    expect(returned).toBeGreaterThanOrEqual(1);
    // Decay (50 points per second) has had time to empty the signal, but it rests on the floor.
    expect(sim.signal('harm')).toBeCloseTo(0.3 * returned);
    run(sim, 200);
    // Four returns reach 120 points: the signal hits its defeat level and the level is lost.
    expect(sim.state.status).toBe('lost');
    expect(sim.state.defeat).toEqual({ type: 'signal', signal: 'harm' });
  });

  it('does nothing on a level that does not declare returns', () => {
    const sim = setup({ waves: [grunts(0, 1)], win: { type: 'antigen', count: 2 } });
    sim.placeUnit('sniper', 1, 5);
    const events = run(sim, 30);
    expect(events.some((e) => e.type === 'pathogen_returned')).toBe(false);
    expect(events.filter((e) => e.type === 'enemy_spawned')).toHaveLength(1);
  });
});
