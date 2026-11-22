import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, applyOverride, levels, normalOverrides, resolveLevel } from '../../src/data';

const DIR = join(import.meta.dirname, '..', '..', 'src', 'data', 'difficulty', 'normal');
const files = existsSync(DIR) ? readdirSync(DIR).filter((name) => name.endsWith('.json')) : [];

describe('difficulties', () => {
  it('offers normal first and sepsis second', () => {
    expect(DIFFICULTIES).toEqual(['normal', 'sepsis']);
  });

  it.each(Object.keys(levels))('sepsis plays level %s exactly as its base file', (id) => {
    expect(resolveLevel(id, 'sepsis')).toBe(levels[id]);
  });

  it('normal plays the base file when the level has no override', () => {
    const plain = Object.keys(levels).find((id) => !(id in normalOverrides))!;
    expect(resolveLevel(plain, 'normal')).toEqual(levels[plain]);
  });

  it('returns undefined for an unknown level', () => {
    expect(resolveLevel('9-9', 'normal')).toBeUndefined();
  });

  it('an override replaces whole top-level fields and keeps the rest', () => {
    const base = levels['1-1']!;
    const waves = [{ at: 5, enemy: 'bacteria_gram_pos', lane: 2, count: 1, gap: 0 }];
    const merged = applyOverride(base, { startEnergy: 500, waves });
    expect(merged.startEnergy).toBe(500);
    expect(merged.waves).toEqual(waves);
    expect(merged.deck).toEqual(base.deck);
    expect(merged.id).toBe(base.id);
    expect(base.startEnergy).toBe(75);
  });

  it('registers every normal override file under its level id, with no manual list', () => {
    expect(Object.keys(normalOverrides).sort()).toEqual(files.map((name) => name.replace(/\.json$/, '')).sort());
  });

  it.each(Object.keys(normalOverrides).length ? Object.keys(normalOverrides) : ['(none)'])('override %s targets a real level and only known fields', (id) => {
    if (id === '(none)') return;
    expect(levels[id], `level ${id}`).toBeDefined();
    const override = normalOverrides[id]!;
    expect(override).not.toHaveProperty('id');
    const known = new Set(Object.values(levels).flatMap((level) => Object.keys(level)));
    for (const key of Object.keys(override)) expect(known.has(key), `field ${key}`).toBe(true);
  });
});
