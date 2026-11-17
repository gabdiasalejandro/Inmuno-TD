import { describe, expect, it } from 'vitest';
import { activeSignalNames, cytokineEffects, gaugeSignal, lostResultKey, shownSignalNames, bacteriaRemaining, digestFraction, isClearLevel, isRecruitBoosted, levelProgress, scheduledEnemies } from '../../src/game/levelView';
import type { LevelDef, SignalDef, UnitDef } from '../../src/sim';

const signals: Record<string, SignalDef> = {
  citocinas: { max: 100, decayPerSecond: 6, marrowBoost: 1, recruitBoost: 1.5, recruitTag: 'reclutable' },
};

function level(extra: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 't',
    grid: { rows: 1, cols: 3 },
    startEnergy: 0,
    marrow: { amount: 25, interval: 5 },
    deck: [],
    waves: [
      { at: 1, enemy: 'b', lane: 0, count: 3, gap: 1 },
      { at: 9, enemy: 'b', lane: 0, count: 2, gap: 1 },
    ],
    ...extra,
  };
}

describe('activeSignalNames', () => {
  it('lists every content signal when the level does not restrict them', () => {
    expect(activeSignalNames(level(), signals)).toEqual(['citocinas']);
  });

  it('lists only the signals the level names', () => {
    expect(activeSignalNames(level({ signals: ['citocinas'] }), signals)).toEqual(['citocinas']);
  });

  it('is empty when the level turns every signal off or the content has none', () => {
    expect(activeSignalNames(level({ signals: [] }), signals)).toEqual([]);
    expect(activeSignalNames(level(), undefined)).toEqual([]);
  });

  it('ignores level names the content does not define', () => {
    expect(activeSignalNames(level({ signals: ['nope'] }), signals)).toEqual([]);
  });
});

describe('shownSignalNames', () => {
  const macro = { id: 'm', cost: 100, cooldown: 12, hp: 400, emits: { signal: 'citocinas', capacity: 40, perSecond: 7, range: 2 } } as UnitDef;
  const wall = { id: 'e', cost: 50, cooldown: 8, hp: 300 } as UnitDef;

  it('shows a signal only when it is active and some card of the deck can raise it', () => {
    expect(shownSignalNames(level({ deck: ['m', 'e'], signals: ['citocinas'] }), signals, [macro, wall])).toEqual(['citocinas']);
    expect(shownSignalNames(level({ deck: ['m', 'e'] }), signals, [macro, wall])).toEqual(['citocinas']);
  });

  it('hides it when the level turns it off or nothing in the deck emits it (level 1-1 case)', () => {
    expect(shownSignalNames(level({ deck: ['m'], signals: [] }), signals, [macro])).toEqual([]);
    expect(shownSignalNames(level({ deck: ['e'] }), signals, [macro, wall])).toEqual([]);
  });
});

describe('isClearLevel', () => {
  it('is true for clear and for the default, false for survive', () => {
    expect(isClearLevel(level())).toBe(true);
    expect(isClearLevel(level({ win: { type: 'clear' } }))).toBe(true);
    expect(isClearLevel(level({ win: { type: 'survive', seconds: 60 } }))).toBe(false);
  });
});

describe('bacteriaRemaining', () => {
  it('counts every scheduled enemy and subtracts the ones already dead', () => {
    expect(scheduledEnemies(level())).toBe(5);
    expect(bacteriaRemaining(level(), 0)).toBe(5);
    expect(bacteriaRemaining(level(), 2)).toBe(3);
  });

  it('never goes below zero', () => {
    expect(bacteriaRemaining(level(), 99)).toBe(0);
  });
});

describe('levelProgress', () => {
  it('runs from 0 at the start to 1 when every bacterium is dead', () => {
    expect(levelProgress(5, 5)).toBe(0);
    expect(levelProgress(2, 5)).toBeCloseTo(0.6);
    expect(levelProgress(0, 5)).toBe(1);
  });

  it('clamps and survives a level with no enemies', () => {
    expect(levelProgress(-3, 5)).toBe(1);
    expect(levelProgress(9, 5)).toBe(0);
    expect(levelProgress(0, 0)).toBe(0);
  });
});

describe('digestFraction', () => {
  it('is 1 right after an attack, falls linearly to 0, and is 0 when ready', () => {
    // rate 0.25 = one attack every 4 s = 80 ticks
    expect(digestFraction(100, 20, 0.25)).toBe(1);
    expect(digestFraction(100, 60, 0.25)).toBeCloseTo(0.5);
    expect(digestFraction(100, 100, 0.25)).toBe(0);
    expect(digestFraction(0, 50, 0.25)).toBe(0);
  });

  it('never leaves 0..1 and survives a zero rate', () => {
    expect(digestFraction(500, 0, 0.25)).toBe(1);
    expect(digestFraction(10, 0, 0)).toBe(0);
  });
});

describe('isRecruitBoosted', () => {
  const neutro = { id: 'n', cost: 25, cooldown: 6, hp: 40, tags: ['reclutable'] } as UnitDef;
  const epi = { id: 'e', cost: 50, cooldown: 8, hp: 300, tags: ['barrera'] } as UnitDef;

  it('is true only for tagged units while an active signal is raised', () => {
    expect(isRecruitBoosted(neutro, signals, ['citocinas'], () => 0.5)).toBe(true);
    expect(isRecruitBoosted(epi, signals, ['citocinas'], () => 0.5)).toBe(false);
  });

  it('is false when the signal is low, inactive in the level, or boosts nothing', () => {
    expect(isRecruitBoosted(neutro, signals, ['citocinas'], () => 0.01)).toBe(false);
    expect(isRecruitBoosted(neutro, signals, [], () => 1)).toBe(false);
    expect(isRecruitBoosted(neutro, undefined, ['citocinas'], () => 1)).toBe(false);
  });
});

describe('cytokineEffects', () => {
  it('reads x1 for both effects at zero cytokines', () => {
    expect(cytokineEffects(signals, ['citocinas'], () => 0)).toEqual({ marrow: 1, recruit: 1 });
  });

  it('applies 1 + boost * level with the boosts of the data, not constants', () => {
    expect(cytokineEffects(signals, ['citocinas'], () => 0.5)).toEqual({ marrow: 1.5, recruit: 1.75 });
    expect(cytokineEffects(signals, ['citocinas'], () => 1)).toEqual({ marrow: 2, recruit: 2.5 });
    const other = { citocinas: { max: 100, decayPerSecond: 6, marrowBoost: 0.4, recruitBoost: 3 } };
    expect(cytokineEffects(other, ['citocinas'], () => 0.5)).toEqual({ marrow: 1.2, recruit: 2.5 });
  });

  it('ignores signals that are not active and signals without boosts', () => {
    expect(cytokineEffects(signals, [], () => 1)).toEqual({ marrow: 1, recruit: 1 });
    expect(cytokineEffects({ calm: { max: 10, decayPerSecond: 1 } }, ['calm'], () => 1)).toEqual({ marrow: 1, recruit: 1 });
    expect(cytokineEffects(undefined, ['citocinas'], () => 1)).toEqual({ marrow: 1, recruit: 1 });
  });
});


describe('gaugeSignal', () => {
  const withHeat: Record<string, SignalDef> = {
    ...signals,
    inflamacion: { max: 100, decayPerSecond: 1, harm: { from: 0.4, hpPercentPerSecond: 2 }, defeatAt: 1 },
  };

  it('is the active signal that harms or can lose the level, with its tier thresholds', () => {
    expect(gaugeSignal(level({ signals: ['citocinas', 'inflamacion'] }), withHeat)).toEqual({ name: 'inflamacion', harmFrom: 0.4, defeatAt: 1 });
  });

  it('is null where that signal is not active, or where no signal harms', () => {
    expect(gaugeSignal(level({ signals: ['citocinas'] }), withHeat)).toBeNull();
    expect(gaugeSignal(level({ signals: ['citocinas'] }), signals)).toBeNull();
  });
});

describe('lostResultKey', () => {
  it('names the signal that lost the level, and the breach otherwise', () => {
    expect(lostResultKey({ type: 'signal', signal: 'inflamacion' })).toBe('result.lost.inflamacion');
    expect(lostResultKey({ type: 'breach' })).toBe('result.lost');
    expect(lostResultKey(null)).toBe('result.lost');
  });
});
