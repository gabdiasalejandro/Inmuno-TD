import { describe, expect, it } from 'vitest';
import { content } from '../../src/data';
import { createSim, secondsToTicks, type LevelDef, type Sim, type SimEvent } from '../../src/sim';
import { engagedCol } from '../../src/sim/world';
import { level } from './fixtures';

const POWER_DECK = ['epitelio', 'macrofago', 'neutrofilo', 'complemento'];

function setup(overrides: Partial<LevelDef> = {}): Sim {
  return createSim(
    level({
      grid: { rows: 5, cols: 9 },
      deck: POWER_DECK,
      startEnergy: 1000,
      marrow: { amount: 0, interval: 5 },
      signals: ['citocinas', 'inflamacion'],
      ...overrides,
    }),
    content,
    1,
  );
}

/** Advances the sim by `seconds`, returning each step's events with the tick it ended on. */
function run(sim: Sim, seconds: number): Array<{ tick: number; events: SimEvent[] }> {
  const steps: Array<{ tick: number; events: SimEvent[] }> = [];
  for (let i = 0; i < secondsToTicks(seconds); i++) {
    const events = sim.step();
    steps.push({ tick: sim.state.tick, events });
  }
  return steps;
}

const allEvents = (steps: Array<{ events: SimEvent[] }>): SimEvent[] => steps.flatMap((step) => step.events);

describe('complement is a one-use power, not a unit', () => {
  it('is refused as a unit', () => {
    const sim = setup();
    expect(sim.placeUnit('complemento', 2, 4)).toEqual({ ok: false, reason: 'not_a_unit' });
  });

  it('is refused on a level whose deck does not hold it', () => {
    const sim = setup({ deck: ['epitelio', 'macrofago'] });
    expect(sim.playPower('complemento', 2, 4)).toEqual({ ok: false, reason: 'not_in_deck' });
  });

  it('can be played once per level', () => {
    const sim = setup();
    expect(sim.playPower('complemento', 2, 4)).toEqual({ ok: true });
    expect(sim.playPower('complemento', 1, 4)).toEqual({ ok: false, reason: 'already_used' });
  });

  it('is refused on cells off the grid', () => {
    const sim = setup();
    expect(sim.playPower('complemento', 9, 4)).toEqual({ ok: false, reason: 'out_of_bounds' });
  });

  it('is refused for a unit that is not a power', () => {
    const sim = setup();
    expect(sim.playPower('epitelio', 2, 4)).toEqual({ ok: false, reason: 'not_a_power' });
  });
});

describe('complement cascade', () => {
  it('runs C3b, C3a, C5a, C5b in that order, each 0.8 seconds after the one before', () => {
    const sim = setup({ waves: [] });
    run(sim, 0.1);
    sim.playPower('complemento', 2, 4);
    const steps = run(sim, 3);
    const fired = steps.flatMap((step) =>
      step.events.filter((e) => e.type === 'power_step').map((e) => ({ kind: (e as { kind: string }).kind, tick: step.tick })),
    );
    expect(fired.map((f) => f.kind)).toEqual(['opsonize', 'inflammation', 'recruit', 'attack']);
    const gaps = fired.slice(1).map((f, i) => f.tick - fired[i]!.tick);
    // The first step runs on the tick after the play; later ones keep their 0.8 s spacing.
    expect(gaps).toEqual([15, 16, 16]);
  });

  it('opsonizes the enemies in the 3x3 area and not the others', () => {
    const sim = setup({
      waves: [
        { at: 0, enemy: 'bacteria_gram_pos', lane: 2, count: 1, gap: 1 },
        { at: 0, enemy: 'bacteria_gram_pos', lane: 0, count: 1, gap: 1 },
      ],
    });
    run(sim, 0.1);
    const [inside, outside] = [...sim.state.enemies].sort((a, b) => (a.lane === 2 ? -1 : 1) - (b.lane === 2 ? -1 : 1));
    sim.playPower('complemento', 2, engagedCol(inside!.pos));
    run(sim, 0.1);
    expect(inside!.statuses?.opsonizado ?? 0).toBeGreaterThan(sim.state.tick);
    expect(outside!.statuses?.opsonizado ?? 0).toBe(0);
  });

  it('raises inflammation by its amount when the level has that signal', () => {
    const sim = setup({ waves: [] });
    sim.playPower('complemento', 2, 4);
    const steps = run(sim, 1);
    const step = allEvents(steps).find((e) => e.type === 'power_step' && e.kind === 'inflammation');
    expect(step).toMatchObject({ amount: 4 });
    expect(sim.signal('inflamacion')).toBeGreaterThan(0);
  });

  it('places a neutrophil on the played cell without costing energy or cooldown', () => {
    const sim = setup({ waves: [] });
    sim.playPower('complemento', 2, 4);
    run(sim, 2);
    const neutrophil = sim.state.units.find((unit) => unit.defId === 'neutrofilo');
    expect(neutrophil).toMatchObject({ row: 2, col: 4 });
    expect(sim.state.energy).toBe(1000);
    expect(sim.state.deployReadyAt.neutrofilo).toBeUndefined();
  });

  it('places the neutrophil in the nearest free cell of its lane when the played cell is taken', () => {
    const sim = setup({ waves: [] });
    sim.placeUnit('epitelio', 2, 4);
    sim.playPower('complemento', 2, 4);
    run(sim, 2);
    const neutrophil = sim.state.units.find((unit) => unit.defId === 'neutrofilo');
    expect(neutrophil).toMatchObject({ row: 2, col: 3 });
  });

  it('only perforates gram-negative enemies: a gram-positive one in the area survives', () => {
    const sim = setup({
      waves: [
        { at: 0, enemy: 'bacteria_gram_pos', lane: 2, count: 1, gap: 1 },
        { at: 0, enemy: 'bacteria_gram_neg', lane: 2, count: 1, gap: 1 },
      ],
    });
    run(sim, 0.1);
    const gramPos = sim.state.enemies.find((e) => e.defId === 'bacteria_gram_pos')!;
    const gramNeg = sim.state.enemies.find((e) => e.defId === 'bacteria_gram_neg')!;
    sim.playPower('complemento', 2, engagedCol(gramNeg.pos));
    const steps = run(sim, 3);
    const attacked = allEvents(steps).find((e) => e.type === 'power_step' && e.kind === 'attack');
    expect(attacked).toMatchObject({ enemies: [gramNeg.uid] });
    expect(attacked && 'enemies' in attacked && attacked.enemies).not.toContain(gramPos.uid);
  });

  it('perforates at most three gram-negative enemies', () => {
    const sim = setup({
      waves: [{ at: 0, enemy: 'bacteria_gram_neg', lane: 2, count: 5, gap: 0.1 }],
    });
    run(sim, 0.5);
    const front = sim.state.enemies.reduce((a, b) => (b.pos < a.pos ? b : a));
    sim.playPower('complemento', 2, engagedCol(front.pos));
    const steps = run(sim, 3);
    const attacked = allEvents(steps).find((e) => e.type === 'power_step' && e.kind === 'attack');
    expect(attacked).toMatchObject({ enemies: expect.any(Array) });
    const hit = attacked && 'enemies' in attacked ? attacked.enemies : [];
    expect(hit).toHaveLength(3);
  });
});

describe('opsonization changes phagocytosis', () => {
  it('a capsulated enemy is not seen by phagocytes until it is opsonized', () => {
    const sim = setup({
      waves: [{ at: 0, enemy: 'bacteria_capsulada', lane: 2, count: 1, gap: 1 }],
      deck: ['epitelio', 'macrofago'],
    });
    sim.placeUnit('macrofago', 2, 6);
    const steps = run(sim, 15);
    const hits = allEvents(steps).filter((e) => e.type === 'unit_attacked');
    expect(hits).toHaveLength(0);
  });

  it('an opsonized enemy takes 1.5x phagocytosis damage', () => {
    const sim = setup({
      waves: [{ at: 0, enemy: 'bacteria_gram_pos', lane: 2, count: 1, gap: 1 }],
      deck: ['epitelio', 'macrofago'],
    });
    sim.placeUnit('macrofago', 2, 6);
    run(sim, 0.1);
    const enemy = sim.state.enemies[0]!;
    enemy.statuses = { opsonizado: sim.state.tick + secondsToTicks(30) };
    const steps = run(sim, 15);
    const hit = allEvents(steps).find((e) => e.type === 'unit_attacked' && e.target === enemy.uid);
    expect(hit).toMatchObject({ damage: 60 });
  });
});
