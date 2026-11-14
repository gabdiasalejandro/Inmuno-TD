import { describe, expect, it } from 'vitest';
import { marrowCharge, marrowExcitement } from '../../src/game/marrow';
import { createSim } from '../../src/sim';
import type { Content, LevelDef } from '../../src/sim';

// This file used to pin the tick-based `marrowCharge(tick, interval, alpha)`. The ring is now
// driven by the sim's own `marrowFraction()`, so these tests pin the new contract instead.

describe('marrowCharge', () => {
  it('passes the sim fraction through, clamped just below 1', () => {
    expect(marrowCharge(0)).toBe(0);
    expect(marrowCharge(0.4)).toBeCloseTo(0.4);
    expect(marrowCharge(1)).toBeLessThan(1);
    expect(marrowCharge(7)).toBeLessThan(1);
  });

  it('treats negative or non-finite input as empty', () => {
    expect(marrowCharge(-0.3)).toBe(0);
    expect(marrowCharge(Number.NaN)).toBe(0);
  });
});

describe('marrowExcitement', () => {
  it('is 0 without cytokines, ignores a trace, and reaches 1 at full signal', () => {
    expect(marrowExcitement(0)).toBe(0);
    expect(marrowExcitement(0.02)).toBe(0);
    expect(marrowExcitement(1)).toBe(1);
  });

  it('grows monotonically and stays within 0..1', () => {
    let last = 0;
    for (let s = 0; s <= 1.001; s += 0.05) {
      const e = marrowExcitement(s);
      expect(e).toBeGreaterThanOrEqual(last);
      expect(e).toBeLessThanOrEqual(1);
      last = e;
    }
    expect(marrowExcitement(5)).toBe(1);
    expect(marrowExcitement(-1)).toBe(0);
  });
});

describe('sim marrow fraction as the ring source', () => {
  const level: LevelDef = {
    id: 't',
    grid: { rows: 1, cols: 3 },
    startEnergy: 0,
    marrow: { amount: 25, interval: 2 },
    deck: [],
    waves: [],
  };
  const content: Content = { units: [], enemies: [] };

  it('is empty on the same ticks the sim reports energy_gained (no boost)', () => {
    const sim = createSim(level, content, 1);
    for (let i = 0; i < 200; i++) {
      const gained = sim.step().some((e) => e.type === 'energy_gained');
      expect(marrowCharge(sim.marrowFraction()) === 0).toBe(gained);
    }
  });

  it('only ever grows between batches', () => {
    const sim = createSim(level, content, 1);
    let last = 0;
    for (let i = 0; i < 200; i++) {
      const gained = sim.step().some((e) => e.type === 'energy_gained');
      const now = marrowCharge(sim.marrowFraction());
      if (!gained) expect(now).toBeGreaterThan(last);
      last = now;
    }
  });
});
