import { describe, expect, it } from 'vitest';
import { createSim, secondsToTicks, type Content, type Sim, type SimEvent, type UnitDef } from '../../src/sim';
import { content, level } from './fixtures';

function run(sim: Sim, seconds: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < secondsToTicks(seconds); i++) events.push(...sim.step());
  return events;
}

const goo: UnitDef = { id: 'goo', cost: 10, cooldown: 1, hp: 10, blocks: false, slow: 0.5 };
const withGoo: Content = { units: [...content.units, goo], enemies: content.enemies };
const oneGrunt = [{ at: 0, enemy: 'grunt', lane: 1, count: 1, gap: 0 }];

describe('survive win condition', () => {
  const survive = { type: 'survive', seconds: 3 } as const;

  it('wins when the timer runs out even if enemies are still alive', () => {
    const sim = createSim(level({ waves: oneGrunt, win: survive }), content, 1);
    sim.placeUnit('wall', 1, 2);
    run(sim, 2.95);
    expect(sim.state.status).toBe('playing');
    const events = run(sim, 0.05);
    expect(sim.state.status).toBe('won');
    expect(sim.state.enemies).toHaveLength(1);
    expect(events.filter((e) => e.type === 'won')).toHaveLength(1);
  });

  it('does not win early when every enemy is dead', () => {
    const sim = createSim(level({ waves: oneGrunt, win: { type: 'survive', seconds: 20 } }), content, 1);
    sim.placeUnit('fighter', 1, 0);
    run(sim, 10);
    expect(sim.state.enemies).toHaveLength(0);
    expect(sim.state.status).toBe('playing');
  });

  it('is still lost if an enemy crosses before the timer', () => {
    const sim = createSim(level({ waves: oneGrunt, win: { type: 'survive', seconds: 30 } }), content, 1);
    run(sim, 6);
    expect(sim.state.status).toBe('lost');
  });

  it('keeps the default: clearing every wave wins', () => {
    const sim = createSim(level({ waves: oneGrunt }), content, 1);
    sim.placeUnit('fighter', 1, 0);
    run(sim, 10);
    expect(sim.state.status).toBe('won');
  });
});

describe('non-blocking units that slow', () => {
  it('lets enemies through at reduced speed, only inside its cell, without being attacked', () => {
    const sim = createSim(level({ waves: oneGrunt, deck: ['goo'] }), withGoo, 1);
    sim.placeUnit('goo', 1, 3);
    run(sim, 1);
    expect(sim.state.enemies[0]!.pos).toBe(4000);
    run(sim, 1);
    expect(sim.state.enemies[0]!.pos).toBe(3500);
    run(sim, 1);
    expect(sim.state.enemies[0]!.pos).toBe(3000);
    run(sim, 1);
    expect(sim.state.enemies[0]!.pos).toBe(2000);
    expect(sim.state.units[0]!.hp).toBe(10);
  });

  it('blocking units keep blocking as before', () => {
    const sim = createSim(level({ waves: oneGrunt }), content, 1);
    sim.placeUnit('wall', 1, 2);
    run(sim, 6);
    expect(sim.state.enemies[0]!.pos).toBe(3000);
  });
});

describe('wounds', () => {
  it('open a lane at their scheduled time and report it', () => {
    const sim = createSim(level({ wounds: [{ at: 2, lane: 1 }] }), content, 1);
    const before = run(sim, 2);
    expect(sim.state.openLanes).toEqual([]);
    expect(before.some((e) => e.type === 'wound_opened')).toBe(false);
    expect(sim.step()).toContainEqual({ type: 'wound_opened', lane: 1 });
    expect(sim.state.openLanes).toEqual([1]);
  });

  it('treats every lane as open when the level declares no wounds', () => {
    const sim = createSim(level(), content, 1);
    expect(sim.state.openLanes).toEqual([0, 1, 2]);
  });

  it('rejects a wound outside the grid', () => {
    expect(() => createSim(level({ wounds: [{ at: 0, lane: 9 }] }), content, 1)).toThrow(/lane/);
  });
});
