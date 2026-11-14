import { describe, expect, it } from 'vitest';
import { openAlmanacFromSearch, startLevelFromSearch } from '../../src/game/boot';

const levels = { '1-1': {}, '1-2': {} };

describe('startLevelFromSearch', () => {
  it('returns the level id when it exists', () => {
    expect(startLevelFromSearch('?level=1-1', levels)).toBe('1-1');
  });

  it('returns null for an unknown id', () => {
    expect(startLevelFromSearch('?level=9-9', levels)).toBeNull();
  });

  it('returns null when the parameter is absent or empty', () => {
    expect(startLevelFromSearch('', levels)).toBeNull();
    expect(startLevelFromSearch('?foo=bar', levels)).toBeNull();
    expect(startLevelFromSearch('?level=', levels)).toBeNull();
  });

  it('does not treat inherited object keys as levels', () => {
    expect(startLevelFromSearch('?level=constructor', levels)).toBeNull();
    expect(startLevelFromSearch('?level=toString', levels)).toBeNull();
  });
});

describe('openAlmanacFromSearch', () => {
  it('is true only for ?almanac=1', () => {
    expect(openAlmanacFromSearch('?almanac=1')).toBe(true);
    expect(openAlmanacFromSearch('?level=1-1&almanac=1')).toBe(true);
  });

  it('is false when absent or any other value', () => {
    expect(openAlmanacFromSearch('')).toBe(false);
    expect(openAlmanacFromSearch('?almanac=0')).toBe(false);
    expect(openAlmanacFromSearch('?almanac=')).toBe(false);
    expect(openAlmanacFromSearch('?almanacs=1')).toBe(false);
  });
});
