import { describe, expect, it } from 'vitest';
import { fitScale, formatClock, formatGain, formatMultiplier, isSpedUp } from '../../src/ui/format';

describe('formatClock', () => {
  it('formats seconds as m:ss', () => {
    expect(formatClock(90)).toBe('1:30');
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(0)).toBe('0:00');
  });

  it('rounds up fractions and clamps negatives to zero', () => {
    expect(formatClock(4.2)).toBe('0:05');
    expect(formatClock(-3)).toBe('0:00');
  });
});

describe('formatGain', () => {
  it('shows a signed amount', () => {
    expect(formatGain(25)).toBe('+25');
    expect(formatGain(0)).toBe('+0');
  });
});

describe('fitScale', () => {
  it('is 1 when the content fits and shrinks it to the limit otherwise', () => {
    expect(fitScale(400, 1000)).toBe(1);
    expect(fitScale(2000, 1000)).toBeCloseTo(0.5);
  });

  it('is 1 for degenerate widths', () => {
    expect(fitScale(0, 1000)).toBe(1);
    expect(fitScale(100, 0)).toBe(1);
  });
});

describe('formatMultiplier', () => {
  it('shows one decimal at most and drops a trailing .0', () => {
    expect(formatMultiplier(1)).toBe('x1');
    expect(formatMultiplier(1.4)).toBe('x1.4');
    expect(formatMultiplier(2)).toBe('x2');
    expect(formatMultiplier(2.5)).toBe('x2.5');
  });

  it('rounds to the nearest tenth, so a tiny rise still reads x1', () => {
    expect(formatMultiplier(1.04)).toBe('x1');
    expect(formatMultiplier(1.06)).toBe('x1.1');
    expect(formatMultiplier(1.96)).toBe('x2');
  });

  it('tells when the shown value is above x1', () => {
    expect(isSpedUp(1)).toBe(false);
    expect(isSpedUp(1.04)).toBe(false);
    expect(isSpedUp(1.06)).toBe(true);
  });
});
