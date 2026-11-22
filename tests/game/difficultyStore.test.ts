import { describe, expect, it } from 'vitest';
import { createDifficultyStore } from '../../src/game/difficulty';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('difficulty store', () => {
  it('starts on normal', () => {
    expect(createDifficultyStore(fakeStorage()).load()).toBe('normal');
  });

  it('remembers the choice across instances', () => {
    const storage = fakeStorage();
    createDifficultyStore(storage).save('sepsis');
    expect(createDifficultyStore(storage).load()).toBe('sepsis');
  });

  it.each([['"hard"'], ['not json'], ['null']])('falls back to normal on unknown saved data %s', (raw) => {
    expect(createDifficultyStore(fakeStorage({ 'inmuno-td.difficulty.v1': raw })).load()).toBe('normal');
  });

  it('keeps the choice in memory when storage is missing or throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    for (const storage of [undefined, broken]) {
      const store = createDifficultyStore(storage);
      expect(store.load()).toBe('normal');
      store.save('sepsis');
      expect(store.load()).toBe('sepsis');
    }
  });
});
