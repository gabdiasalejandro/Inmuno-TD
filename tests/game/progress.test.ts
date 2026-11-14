import { describe, expect, it } from 'vitest';
import { createProgressStore, isUnlocked } from '../../src/game/progress';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('progress store', () => {
  it('starts empty and remembers completed levels across instances', () => {
    const storage = fakeStorage();
    expect(createProgressStore(storage).load()).toEqual({ completed: [] });
    createProgressStore(storage).markCompleted('1-1');
    expect(createProgressStore(storage).load()).toEqual({ completed: ['1-1'] });
  });

  it('does not duplicate a level completed twice', () => {
    const store = createProgressStore(fakeStorage());
    store.markCompleted('1-1');
    expect(store.markCompleted('1-1')).toEqual({ completed: ['1-1'] });
  });

  it.each([['not json'], ['{"completed":"nope"}'], ['null'], ['{"completed":[1,"1-2"]}']])(
    'recovers from corrupt saved data %s',
    (raw) => {
      const store = createProgressStore(fakeStorage({ 'inmuno-td.progress.v1': raw }));
      expect(store.load().completed.every((id) => typeof id === 'string')).toBe(true);
      expect(store.markCompleted('1-1').completed).toContain('1-1');
    },
  );

  it('keeps working in memory when storage is missing or throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    for (const storage of [undefined, broken]) {
      const store = createProgressStore(storage);
      expect(store.markCompleted('1-1')).toEqual({ completed: ['1-1'] });
      expect(store.load()).toEqual({ completed: ['1-1'] });
    }
  });
});

describe('isUnlocked', () => {
  const order = ['1-1', '1-2', '1-3'];

  it('unlocks the first level and whatever follows a completed one', () => {
    expect(isUnlocked(order, [], '1-1')).toBe(true);
    expect(isUnlocked(order, [], '1-2')).toBe(false);
    expect(isUnlocked(order, ['1-1'], '1-2')).toBe(true);
    expect(isUnlocked(order, ['1-1'], '1-3')).toBe(false);
  });

  it('never unlocks a level that is not in the list', () => {
    expect(isUnlocked(order, ['1-1'], '9-9')).toBe(false);
  });
});
