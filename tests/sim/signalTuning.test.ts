import { describe, expect, it } from 'vitest';
import { content, levels } from '../../src/data';
import { createWorld, tunedSignals } from '../../src/sim/world';
import type { LevelDef } from '../../src/sim';

const base = levels['1-4']!;
const tuned: LevelDef = { ...base, signalTuning: { inflamacion: { decayPerSecond: 2 } } };

describe('signal tuning per level', () => {
  it('replaces only the tuned fields of the tuned signal', () => {
    const signals = tunedSignals(tuned, content.signals);
    expect(signals.inflamacion!.decayPerSecond).toBe(2);
    expect(signals.inflamacion!.harm).toEqual(content.signals!.inflamacion!.harm);
    expect(signals.citocinas).toBe(content.signals!.citocinas);
    expect(content.signals!.inflamacion!.decayPerSecond).toBe(1.1);
  });

  it('returns the content signals untouched when the level tunes nothing', () => {
    expect(tunedSignals(base, content.signals)).toBe(content.signals);
  });

  it('is what the simulation plays with', () => {
    const world = createWorld(tuned, content, 1);
    expect(Object.fromEntries(world.signalDefs).inflamacion!.decayPerSecond).toBe(2);
  });
});
