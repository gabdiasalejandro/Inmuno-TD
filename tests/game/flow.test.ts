import { describe, expect, it } from 'vitest';
import { nextLevelId, resultActions } from '../../src/game/flow';

const worlds = [
  { id: '1', levels: ['1-1', '1-2', '1-3'] },
  { id: '2', levels: ['2-1'] },
];

describe('nextLevelId', () => {
  it('returns the following level of the same world when it exists', () => {
    expect(nextLevelId('1-1', worlds, { '1-1': {}, '1-2': {} })).toBe('1-2');
  });

  it('returns null when the following level is listed but not built yet', () => {
    expect(nextLevelId('1-1', worlds, { '1-1': {} })).toBeNull();
  });

  it('continues into the next world after the last level of a world', () => {
    expect(nextLevelId('1-3', worlds, { '1-3': {}, '2-1': {} })).toBe('2-1');
  });

  it('returns null for the last level and for unknown ids', () => {
    expect(nextLevelId('2-1', worlds, { '2-1': {} })).toBeNull();
    expect(nextLevelId('9-9', worlds, { '1-1': {} })).toBeNull();
  });
});

describe('resultActions', () => {
  it('offers retry and menu after a loss, even if a next level exists', () => {
    expect(resultActions('lost', '1-2')).toEqual(['retry', 'menu']);
  });

  it('offers next level first after a win when it exists', () => {
    expect(resultActions('won', '1-2')).toEqual(['next', 'retry', 'menu']);
    expect(resultActions('won', null)).toEqual(['retry', 'menu']);
  });
});
