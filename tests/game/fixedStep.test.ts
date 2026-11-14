import { describe, expect, it } from 'vitest';
import { createStepper } from '../../src/game/fixedStep';

describe('fixed-step accumulator', () => {
  it('runs one step per full step of elapsed time', () => {
    const s = createStepper(50, 5);
    expect(s.advance(50).steps).toBe(1);
    expect(s.advance(100).steps).toBe(2);
  });

  it('runs no step for a tiny frame and carries the remainder over', () => {
    const s = createStepper(50, 5);
    const first = s.advance(16);
    expect(first.steps).toBe(0);
    expect(first.alpha).toBeCloseTo(16 / 50);
    s.advance(16);
    s.advance(16);
    const fourth = s.advance(16);
    expect(fourth.steps).toBe(1);
    expect(fourth.alpha).toBeCloseTo(14 / 50);
  });

  it('caps the steps of a huge frame and discards the backlog', () => {
    const s = createStepper(50, 5);
    expect(s.advance(60_000).steps).toBe(5);
    const next = s.advance(10);
    expect(next.steps).toBe(0);
    expect(next.alpha).toBeLessThan(1);
  });

  it('ignores negative and non-finite deltas', () => {
    const s = createStepper(50, 5);
    expect(s.advance(-100).steps).toBe(0);
    expect(s.advance(Number.NaN).steps).toBe(0);
    expect(s.advance(50).steps).toBe(1);
  });

  it('reset drops accumulated time', () => {
    const s = createStepper(50, 5);
    s.advance(40);
    s.reset();
    expect(s.advance(40).steps).toBe(0);
  });
});
